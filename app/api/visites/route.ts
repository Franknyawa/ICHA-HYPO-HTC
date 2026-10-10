import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireAdmin } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";
import { getPaginationParams, buildPaginatedResponse } from "@/lib/pagination";
import { createVisiteSchema } from "@/lib/validations/visite";
import { applyStockMovement, InsufficientStockError } from "@/lib/services/stock";
import { convertToSachets } from "@/lib/services/produits";
import { uploadPhoto, isTrustedPhotoUrl } from "@/lib/services/storage";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";

// Une visite saisie hors ligne est synchronisée plus tard : on tolère donc
// un passé assez long (60 jours), mais quasiment aucun futur (horloge d'un
// téléphone légèrement en avance).
const DATE_PASSE_MAX_MS = 60 * 24 * 60 * 60 * 1000;
const DATE_FUTURE_TOLEREE_MS = 10 * 60 * 1000;

export async function GET(req: NextRequest) {
  try {
    // Liste globale de toutes les visites : réservée à l'admin. L'app terrain
    // n'appelle jamais cette route (elle ne fait que POST), et un commercial
    // n'a pas à lire les visites de ses collègues.
    await requireAdmin();

    const sp = req.nextUrl.searchParams;
    const { page, pageSize, skip, take } = getPaginationParams(sp);

    const commercialId = sp.get("commercialId") ?? undefined;
    const binomeId = sp.get("binomeId") ?? undefined;
    const villeId = sp.get("villeId") ?? undefined;
    const dateFrom = sp.get("dateFrom") ?? undefined;
    const dateTo = sp.get("dateTo") ?? undefined;

    const where: Prisma.VisiteWhereInput = {
      ...(commercialId ? { commercialId } : {}),
      ...(binomeId ? { binomeId } : {}),
      ...(villeId ? { pointVente: { villeId } } : {}),
      ...(dateFrom || dateTo
        ? {
            dateVisite: {
              ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
              ...(dateTo ? { lte: new Date(dateTo) } : {}),
            },
          }
        : {}),
    };

    const [data, total] = await prisma.$transaction([
      prisma.visite.findMany({
        where,
        skip,
        take,
        orderBy: { dateVisite: "desc" },
        include: {
          pointVente: { select: { id: true, nom: true, villeId: true } },
          commercial: { select: { id: true, nom: true, prenom: true } },
          binome: { select: { id: true, nom: true } },
        },
      }),
      prisma.visite.count({ where }),
    ]);

    return NextResponse.json(buildPaginatedResponse(data, total, page, pageSize));
  } catch (error) {
    return handleApiError(error);
  }
}

// Un mode de paiement CREDIT_* implique un crédit — dérivé ici plutôt que
// redemandé au commercial (évite une case à cocher redondante avec le menu).
function isCredit(mode: string) {
  return mode === "CREDIT_PARTIEL" || mode === "CREDIT_TOTAL";
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();

    const json = await req.json().catch(() => null);
    const parsed = createVisiteSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Données invalides.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const input = parsed.data;

    // Idempotence au niveau visite : si ce uuidClient a déjà été synchronisé
    // (ex. double envoi après coupure réseau), on renvoie l'existant sans
    // rien recréer — §15/16 doc infra.
    const existingVisite = await prisma.visite.findUnique({
      where: { uuidClient: input.uuidClient },
      include: { ventes: { include: { lignes: true, paiements: true } } },
    });
    if (existingVisite) {
      return NextResponse.json(existingVisite, { status: 200 });
    }

    // --- Contrôles de plausibilité (après l'idempotence, pour ne jamais
    // refuser le rejeu d'une visite déjà enregistrée) -------------------
    const maintenant = Date.now();
    const dateVisiteMs = new Date(input.dateVisite).getTime();
    if (
      dateVisiteMs > maintenant + DATE_FUTURE_TOLEREE_MS ||
      dateVisiteMs < maintenant - DATE_PASSE_MAX_MS
    ) {
      return NextResponse.json(
        { error: "Date de visite invalide (dans le futur ou trop ancienne)." },
        { status: 400 }
      );
    }

    if (
      input.vente?.paiement &&
      input.vente.paiement.montant > input.vente.montantTotal + 0.01
    ) {
      return NextResponse.json(
        { error: "Le paiement ne peut pas dépasser le montant de la vente." },
        { status: 400 }
      );
    }

    if (input.photos.some((p) => !p.url.startsWith("data:") && !isTrustedPhotoUrl(p.url))) {
      return NextResponse.json({ error: "URL de photo non autorisée." }, { status: 400 });
    }

    // Photos reçues en data URL (repli hors ligne du formulaire) : envoyées
    // au stockage ICI, avant la transaction, pour ne jamais enregistrer
    // plusieurs centaines de Ko de base64 dans la table `photos`. Si le
    // stockage est indisponible, on garde le data URL plutôt que de perdre
    // la photo (comportement historique).
    const photosTraitees = await Promise.all(
      input.photos.map(async (p) => {
        const m = /^data:image\/(png|jpe?g);base64,/.exec(p.url);
        if (!m) return p;
        try {
          const ext = m[1] === "png" ? "png" : "jpg";
          const url = await uploadPhoto(p.url, `photos/${session.userId}/${p.uuidClient}.${ext}`);
          return { ...p, url };
        } catch (e) {
          console.error("Upload photo (repli serveur) échoué :", e);
          return p;
        }
      })
    );

    const result = await prisma.$transaction(
      async (tx) => {
      // 1. Point de vente — existant ou créé à la volée
      let pointVenteId = input.pointVenteId;

      if (!pointVenteId && input.nouveauPointVente) {
        const npv = input.nouveauPointVente;

        if (npv.uuidClient) {
          const existingPv = await tx.pointVente.findUnique({
            where: { id: npv.uuidClient },
          });
          if (existingPv) pointVenteId = existingPv.id;
        }

        if (!pointVenteId) {
          // Quartier en texte libre : find-or-create sous la ville choisie.
          let quartierId: string | undefined;
          if (npv.quartierNom && npv.quartierNom.trim()) {
            const quartierNom = npv.quartierNom.trim();
            const existingQuartier = await tx.quartier.findUnique({
              where: { villeId_nom: { villeId: npv.villeId, nom: quartierNom } },
            });
            quartierId = existingQuartier
              ? existingQuartier.id
              : (await tx.quartier.create({ data: { nom: quartierNom, villeId: npv.villeId } })).id;
          }

          const created = await tx.pointVente.create({
            data: {
              ...(npv.uuidClient ? { id: npv.uuidClient } : {}),
              nom: npv.nom,
              vendeur: npv.vendeur,
              telephoneVendeur: npv.telephoneVendeur,
              telephonePatron: npv.telephonePatron,
              villeId: npv.villeId,
              quartierId,
              repere: npv.repere,
              typeId: npv.typeId,
              presentoir: npv.presentoir,
              latitude: input.latitude,
              longitude: input.longitude,
              precisionGps: input.precisionGps,
              createdById: session.userId,
            },
          });
          pointVenteId = created.id;
        }
      }

      if (!pointVenteId) {
        throw new Error("Point de vente manquant.");
      }

      // 2. Visite
      const visite = await tx.visite.create({
        data: {
          uuidClient: input.uuidClient,
          commercialId: session.userId,
          // Le binôme vient TOUJOURS de la session : un client ne peut pas
          // attribuer sa visite (et donc ses chiffres d'objectifs) à un autre.
          binomeId: session.binomeId,
          pointVenteId,
          dateVisite: new Date(input.dateVisite),
          observation: input.observation,
          latitude: input.latitude,
          longitude: input.longitude,
          precisionGps: input.precisionGps,
        },
      });

      // 3. Photos
      if (photosTraitees.length > 0) {
        await tx.photo.createMany({
          data: photosTraitees.map((p) => ({
            uuidClient: p.uuidClient,
            visiteId: visite.id,
            pointVenteId,
            url: p.url,
            type: p.type,
            uploadedById: session.userId,
          })),
          skipDuplicates: true,
        });
      }

      const produits = await tx.produit.findMany();
      const produitParCode = new Map(produits.map((p) => [p.code, p]));

      // 4. Vente + lignes + déduction de stock (transactionnel, §17 CDC) +
      //    paiement éventuel
      let vente = null;
      if (input.vente) {
        vente = await tx.vente.create({
          data: {
            uuidClient: input.vente.uuidClient,
            visiteId: visite.id,
            pointVenteId,
            clientId: input.vente.clientId,
            commercialId: session.userId,
            // Date de la visite (et non de l'envoi) : une vente saisie hors ligne
            // et synchronisée le lendemain doit compter pour le bon jour.
            dateVente: new Date(input.dateVisite),
            montantTotal: input.vente.montantTotal,
            lignes: {
              create: input.vente.lignes.map((l) => {
                const produit = produitParCode.get(l.produitCode);
                if (!produit) throw new Error(`Produit inconnu : ${l.produitCode}`);
                return {
                  produitId: produit.id,
                  nbSachets: l.nbSachets,
                  nbFilets: l.nbFilets,
                  nbCartons: l.nbCartons,
                  montant: 0, // pas de prix par produit saisi sur le terrain (MVP)
                };
              }),
            },
          },
          include: { lignes: true },
        });

        for (const ligne of input.vente.lignes) {
          const produit = produitParCode.get(ligne.produitCode);
          if (!produit) continue;
          const quantiteSachets = convertToSachets(produit, ligne);
          if (quantiteSachets === 0) continue;

          await applyStockMovement(tx, {
            uuidClient: `${input.vente.uuidClient}-${produit.code}`,
            produitId: produit.id,
            type: "SORTIE",
            quantiteSachets,
            referenceType: "VENTE",
            referenceId: vente.id,
          });
        }

        if (input.vente.paiement) {
          await tx.paiement.create({
            data: {
              uuidClient: input.vente.paiement.uuidClient,
              venteId: vente.id,
              montant: input.vente.paiement.montant,
              modePaiement: input.vente.paiement.modePaiement,
              estCredit: isCredit(input.vente.paiement.modePaiement),
            },
          });
        }
      }

      // 5. Commande (livraison future — distincte de la vente immédiate)
      let commande = null;
      if (input.commande) {
        commande = await tx.commande.create({
          data: {
            uuidClient: input.commande.uuidClient,
            pointVenteId,
            clientId: input.commande.clientId,
            commercialId: session.userId,
            dateCommande: new Date(input.dateVisite),
            dateLivraisonPrevue: input.commande.dateLivraisonPrevue
              ? new Date(input.commande.dateLivraisonPrevue)
              : undefined,
            lignes: {
              create: input.commande.lignes.map((l) => {
                const produit = produitParCode.get(l.produitCode);
                if (!produit) throw new Error(`Produit inconnu : ${l.produitCode}`);
                return {
                  produitId: produit.id,
                  nbSachets: l.nbSachets,
                  nbFilets: l.nbFilets,
                  nbCartons: l.nbCartons,
                };
              }),
            },
          },
        });
      }

      return { visite, vente, commande };
      },
      {
        // Délai généreux : l'écriture d'une photo en base64 (voir README —
        // limitation connue, en attendant un vrai stockage objet) plus la
        // latence réseau vers Supabase peuvent largement dépasser les 5s
        // par défaut de Prisma.
        timeout: 20000,
        maxWait: 10000,
      }
    );

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof InsufficientStockError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return handleApiError(error);
  }
}
