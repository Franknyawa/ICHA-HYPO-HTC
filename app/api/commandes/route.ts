import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";
import { listCommandes } from "@/lib/queries/commandes";
import { ajouterVentesDetail } from "@/lib/services/client-divers";
import { calculerLignesCommande, ErreurCalcul } from "@/lib/services/commande-calcul";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    await requireModule("commandes");

    const sp = req.nextUrl.searchParams;
    const result = await listCommandes({
      page: sp.get("page") ? Number(sp.get("page")) : undefined,
      pageSize: sp.get("pageSize") ? Number(sp.get("pageSize")) : undefined,
      statut:
        (sp.get("statut") as "EN_ATTENTE" | "EN_LIVRAISON" | "LIVREE" | "ANNULEE" | null) ??
        undefined,
      villeId: sp.get("villeId") ?? undefined,
      commercialId: sp.get("commercialId") ?? undefined,
      dateFrom: sp.get("dateFrom") ?? undefined,
      dateTo: sp.get("dateTo") ?? undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}

const QTE = z.number().int().min(0).max(100_000).default(0);
// Cartons : les demi-cartons (0,5 / 1,5…) sont acceptés.
const QTE_CARTONS = z.number().min(0).max(100_000).multipleOf(0.5).default(0);

const schema = z
  .object({
    pointVenteId: z.string().uuid().optional(),
    nouveauPointVente: z
      .object({
        nom: z.string().trim().min(2).max(160),
        vendeur: z.string().trim().max(160).optional(),
        telephoneVendeur: z.string().trim().max(40).optional(),
        villeId: z.string().uuid(),
        quartierNom: z.string().trim().max(120).optional(),
        repere: z.string().trim().max(300).optional(),
        typeId: z.string().uuid().optional().nullable(),
      })
      .optional(),
    commercialId: z.string().uuid().optional(),
    lignes: z.array(z.object({ produitCode: z.string(), nbSachets: QTE, nbFilets: QTE, nbCartons: QTE_CARTONS, detail: z.boolean().optional() })).min(1),
    modePaiement: z.enum(["ESPECES", "MOBILE_MONEY", "CREDIT_PARTIEL", "CREDIT_TOTAL"]).optional(),
    dateLivraisonPrevue: z.string().datetime().optional(),
  })
  // Une vente uniquement au détail va sur le « client divers » : aucun point de vente à choisir.
  .refine((d) => d.pointVenteId || d.nouveauPointVente || d.lignes.every((l) => l.detail), { message: "Choisissez ou créez un point de vente." });

/**
 * Commande saisie au bureau. Même traitement que sur le terrain : prix figés
 * (base → type de boutique → grille), commande « en attente », créance à
 * encaisser. Un nouveau client entre dans la liste des points de vente.
 * Les prix sont TOUJOURS recalculés ici, jamais repris du navigateur.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireModule("commandes");
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Données invalides." }, { status: 400 });
    }
    const d = parsed.data;

    const lignesUtiles = d.lignes.filter((l) => l.nbSachets + l.nbFilets + l.nbCartons > 0);
    if (lignesUtiles.length === 0) return NextResponse.json({ error: "Indiquez au moins une quantité." }, { status: 400 });

    const [produits, prixParType, paliers] = await Promise.all([
      prisma.produit.findMany({ where: { actif: true } }),
      prisma.prixParType.findMany(),
      prisma.palierPrix.findMany(),
    ]);

    const commande = await prisma.$transaction(async (tx) => {
      let pointVenteId = d.pointVenteId;
      let typeId: string | null = null;

      if (pointVenteId) {
        const pv = await tx.pointVente.findUnique({ where: { id: pointVenteId }, select: { typeId: true } });
        if (!pv) throw new ErreurMetier("Point de vente introuvable.", 404);
        typeId = pv.typeId;
      } else if (d.nouveauPointVente) {
        const n = d.nouveauPointVente;
        const doublon = await tx.pointVente.findFirst({
          where: { villeId: n.villeId, nom: { equals: n.nom, mode: "insensitive" }, archivedAt: null },
          select: { id: true },
        });
        if (doublon) {
          throw new ErreurMetier("Ce point de vente existe déjà dans cette ville : sélectionnez-le dans la recherche.", 409);
        }
        let quartierId: string | undefined;
        const quartierNom = n.quartierNom?.replace(/\s+/g, " ").trim();
        if (quartierNom) {
          const existant = await tx.quartier.findFirst({
            where: { villeId: n.villeId, nom: { equals: quartierNom, mode: "insensitive" } },
            select: { id: true },
          });
          quartierId = existant ? existant.id : (await tx.quartier.create({ data: { nom: quartierNom, villeId: n.villeId } })).id;
        }
        const cree = await tx.pointVente.create({
          data: {
            nom: n.nom,
            vendeur: n.vendeur || undefined,
            telephoneVendeur: n.telephoneVendeur || undefined,
            villeId: n.villeId,
            quartierId,
            repere: n.repere || undefined,
            typeId: n.typeId ?? undefined,
            typesIds: n.typeId ? [n.typeId] : [],
            createdById: session.userId,
          },
        });
        pointVenteId = cree.id;
        typeId = n.typeId ?? null;
      }
      if (!pointVenteId && !lignesUtiles.every((l) => l.detail)) throw new ErreurMetier("Point de vente manquant.", 400);

      const toutes = calculerLignesCommande(lignesUtiles, { produits, prixParType, paliers, typeId });
      // Vente au détail : portée par la facture unique « CLIENT DIVERS » du jour, pas par ce client.
      const lignesDivers = toutes.filter((l) => l.detail);
      const lignes = toutes.filter((l) => !l.detail);

      const lignesClient = lignes;
      const role = session.role === "SUPERVISEUR" ? "Superviseur" : "Admin";
      const saisiePar = `${role} · ${[session.prenom, session.nom].filter(Boolean).join(" ") || "bureau"}`;
      const idDivers = lignesDivers.length
        ? await ajouterVentesDetail(tx, {
            lignes: lignesDivers,
            commercialId: d.commercialId ?? session.userId,
            userId: session.userId,
            date: new Date(),
          })
        : null;
      if (lignesClient.length === 0) {
        const c = await tx.commande.findUniqueOrThrow({ where: { id: idDivers! }, select: { id: true, montantTotal: true } });
        return c;
      }
      return tx.commande.create({
        data: {
          uuidClient: crypto.randomUUID(),
          saisiePar,
          pointVenteId: pointVenteId!,
          commercialId: d.commercialId ?? session.userId,
          dateLivraisonPrevue: d.dateLivraisonPrevue ? new Date(d.dateLivraisonPrevue) : undefined,
          montantTotal: lignesClient.reduce((t, l) => t + l.montant, 0),
          modePaiement: d.modePaiement,
          lignes: { create: lignesClient },
        },
        select: { id: true, montantTotal: true },
      });
    });

    return NextResponse.json({ id: commande.id, montantTotal: Number(commande.montantTotal) }, { status: 201 });
  } catch (error) {
    if (error instanceof ErreurCalcul) return NextResponse.json({ error: error.message }, { status: error.statut });
    if (error instanceof ErreurMetier) return NextResponse.json({ error: error.message }, { status: error.statut });
    return handleApiError(error);
  }
}

class ErreurMetier extends Error {
  constructor(message: string, public statut: number) {
    super(message);
  }
}
