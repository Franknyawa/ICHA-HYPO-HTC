import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";
import { calculerLigne } from "@/lib/utils/tarifs";

export const runtime = "nodejs";

const schema = z.discriminatedUnion("action", [
  // Le prospect a été relancé : on note la relance et on fixe la suivante.
  z.object({ action: z.literal("relance"), dateRelance: z.string().datetime(), note: z.string().max(500).optional() }),
  // Converti : l'admin saisit les cartons demandés → commande « à traiter » créée aussitôt.
  z.object({
    action: z.literal("converti"),
    lignes: z.array(z.object({ produitCode: z.string(), nbCartons: z.number().int().min(0).max(100_000) })).min(1),
    modePaiement: z.enum(["ESPECES", "MOBILE_MONEY", "BANQUE", "CREDIT_PARTIEL", "CREDIT_TOTAL"]).optional(),
  }),
  z.object({ action: z.literal("abandonne") }),
  z.object({ action: z.literal("reouvrir"), dateRelance: z.string().datetime() }),
]);

/** Met à jour un prospect indécis (Admin / Super Admin ; le superviseur consulte seulement). */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireModule("relances");
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Données invalides." }, { status: 400 });
    const d = parsed.data;

    const existant = await prisma.prospectIndecis.findUnique({ where: { id: params.id }, select: { note: true, statut: true, pointVenteId: true, commercialId: true, pointVente: { select: { typeId: true } } } });
    if (!existant) return NextResponse.json({ error: "Prospect introuvable." }, { status: 404 });

    if (d.action === "relance") {
      const horodatage = new Date().toLocaleDateString("fr-FR");
      const note = d.note?.trim() ? `${existant.note ? existant.note + "\n" : ""}[${horodatage}] ${d.note.trim()}` : existant.note;
      await prisma.prospectIndecis.update({
        where: { id: params.id },
        data: {
          statut: "A_RELANCER",
          dateRelance: new Date(d.dateRelance),
          nbRelances: { increment: 1 },
          derniereRelanceAt: new Date(),
          note,
        },
      });
    } else if (d.action === "converti") {
      if (existant.statut === "CONVERTI") return NextResponse.json({ error: "Ce prospect est déjà converti." }, { status: 409 });
      const lignesUtiles = d.lignes.filter((l) => l.nbCartons > 0);
      if (lignesUtiles.length === 0) return NextResponse.json({ error: "Indiquez au moins un carton." }, { status: 400 });

      const [produits, prixParType, paliers] = await Promise.all([
        prisma.produit.findMany({ where: { actif: true } }),
        prisma.prixParType.findMany(),
        prisma.palierPrix.findMany(),
      ]);
      const parCode = new Map(produits.map((p) => [p.code, p]));
      const ctx = {
        typeId: existant.pointVente.typeId,
        prixParType: prixParType.map((x) => ({ produitId: x.produitId, typeId: x.typeId, prixSachet: Number(x.prixSachet), prixFilet: x.prixFilet === null ? null : Number(x.prixFilet), prixCarton: Number(x.prixCarton) })),
        paliers: paliers.map((x) => ({ produitId: x.produitId, minCartons: x.minCartons, maxCartons: x.maxCartons, prixCarton: Number(x.prixCarton) })),
      };
      let total = 0;
      const lignes = lignesUtiles.map((l) => {
        const p = parCode.get(l.produitCode);
        if (!p) throw new Error(`Produit inconnu : ${l.produitCode}`);
        const { prix, montant } = calculerLigne(
          { id: p.id, prixSachet: Number(p.prixSachet), prixFilet: p.prixFilet === null ? null : Number(p.prixFilet), prixCarton: Number(p.prixCarton) },
          { sachets: 0, filets: 0, cartons: l.nbCartons },
          ctx
        );
        total += montant;
        return { produitId: p.id, nbSachets: 0, nbFilets: 0, nbCartons: l.nbCartons, prixSachet: prix.sachet, prixFilet: prix.filet, prixCarton: prix.carton, montant };
      });

      // Même schéma qu'une commande terrain : Vente (stats) + Commande EN_ATTENTE liée + Bon de commande.
      const cle = crypto.randomUUID();
      await prisma.$transaction(
        async (tx) => {
          const vente = await tx.vente.create({
            data: {
              uuidClient: cle,
              pointVenteId: existant.pointVenteId,
              commercialId: existant.commercialId,
              montantTotal: total,
              modePaiement: d.modePaiement,
              lignes: { create: lignes },
            },
            select: { id: true },
          });
          const commande = await tx.commande.create({
            data: {
              uuidClient: `${cle}:cmd`,
              venteId: vente.id,
              pointVenteId: existant.pointVenteId,
              commercialId: existant.commercialId,
              montantTotal: total,
              modePaiement: d.modePaiement,
              lignes: { create: lignes },
            },
            select: { id: true },
          });
          await tx.bonCommande.create({ data: { commandeId: commande.id, venteId: vente.id } });
          await tx.prospectIndecis.update({ where: { id: params.id }, data: { statut: "CONVERTI" } });
        },
        { timeout: 20000, maxWait: 10000 }
      );
    } else if (d.action === "abandonne") {
      await prisma.prospectIndecis.update({ where: { id: params.id }, data: { statut: "ABANDONNE" } });
    } else {
      await prisma.prospectIndecis.update({
        where: { id: params.id },
        data: { statut: "A_RELANCER", dateRelance: new Date(d.dateRelance) },
      });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
