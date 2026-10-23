import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";
import { applyStockMovement, InsufficientStockError } from "@/lib/services/stock";
import { convertToSachets } from "@/lib/services/produits";
import { rafraichirAlerteLivraison } from "@/lib/jobs/alertes";

export const runtime = "nodejs";

const schema = z.object({
  statut: z.enum(["EN_ATTENTE", "EN_LIVRAISON", "LIVREE", "ANNULEE"]).optional(),
  // Date de livraison ajustée par l'admin (AAAA-MM-JJ) ; null pour l'effacer.
  dateLivraisonPrevue: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
}).refine((d) => d.statut !== undefined || d.dateLivraisonPrevue !== undefined, { message: "Rien à modifier." });

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Seul un admin change le statut d'une commande — décision de gestion,
    // pas une action terrain du commercial.
    await requireModule("commandes");

    const json = await req.json().catch(() => null);
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Données invalides." }, { status: 400 });
    }

    const existante = await prisma.commande.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        statut: true,
        valideeAt: true,
        dateLivraisonPrevue: true,
        commercialId: true,
        pointVente: {
          select: {
            nom: true,
            vendeur: true,
            quartier: { select: { nom: true } },
            ville: { select: { nom: true } },
          },
        },
      },
    });

    if (!existante) {
      return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
    }

    const nouvelleDate =
      parsed.data.dateLivraisonPrevue === undefined
        ? undefined
        : parsed.data.dateLivraisonPrevue === null
          ? null
          : new Date(`${parsed.data.dateLivraisonPrevue}T12:00:00`);
    const dateChangee =
      nouvelleDate !== undefined &&
      (nouvelleDate?.toDateString() ?? null) !== (existante.dateLivraisonPrevue?.toDateString() ?? null);

    // Ajustement de la date seule (sans changer le statut).
    if (parsed.data.statut === undefined) {
      if (existante.statut === "ANNULEE" || existante.statut === "LIVREE") {
        return NextResponse.json({ error: "La date d'une commande livrée ou annulée ne se modifie plus." }, { status: 409 });
      }
      const maj = await prisma.commande.update({
        where: { id: params.id },
        data: { dateLivraisonPrevue: nouvelleDate },
        select: { id: true, statut: true },
      });
      if (dateChangee) await rafraichirAlerteLivraison(params.id);
      return NextResponse.json(maj);
    }
    const statutCible = parsed.data.statut;

    // Une commande déjà (en partie) encaissée ne peut pas être annulée ni repasser en attente :
    // l'argent resterait en caisse sans commande. Il faut passer par une facture d'avoir.
    if (statutCible === "ANNULEE" || statutCible === "EN_ATTENTE") {
      const [nbPaiements, nbAvoirs, nbRetours] = await Promise.all([
        prisma.paiement.count({ where: { commandeId: params.id } }),
        prisma.factureAvoir.count({ where: { commandeId: params.id } }),
        prisma.factureRetour.count({ where: { commandeId: params.id } }),
      ]);
      if (nbPaiements + nbAvoirs + nbRetours > 0) {
        return NextResponse.json(
          { error: "Cette commande a déjà des paiements, avoirs ou retours : elle ne peut plus être annulée. Établissez une facture d'avoir pour la corriger." },
          { status: 409 }
        );
      }
    }

    // Le stock n'est débité que lorsque l'admin clique sur « Livrée » (la marchandise
    // reste disponible tant qu'elle n'est pas partie) ; il est remis en stock si la
    // commande est annulée ou réactivée. On compare ce
    // qui est déjà sorti (mouvements de cette commande) à ce qui doit l'être :
    // l'opération est donc idempotente et ne débite jamais deux fois.
    const doitEtreSortie = statutCible === "LIVREE";
    const doitEtreValidee = ["EN_LIVRAISON", "LIVREE"].includes(statutCible);

    let commande;
    try {
      commande = await prisma.$transaction(async (tx) => {
        const lignes = await tx.commandeLigne.findMany({
          where: { commandeId: params.id },
          select: {
            produitId: true,
            nbSachets: true,
            nbFilets: true,
            nbCartons: true,
            produit: { select: { sachetsParFilet: true, sachetsParCarton: true } },
          },
        });

        const voulu = new Map<string, number>();
        if (doitEtreSortie) {
          for (const l of lignes) {
            voulu.set(l.produitId, (voulu.get(l.produitId) ?? 0) + convertToSachets(l.produit, l));
          }
        }

        const mouvements = await tx.mouvementStock.findMany({
          where: { referenceType: "COMMANDE", referenceId: params.id },
          select: { produitId: true, type: true, quantiteSachets: true },
        });
        const sorti = new Map<string, number>();
        for (const m of mouvements) {
          const signe = m.type === "SORTIE" ? 1 : -1;
          sorti.set(m.produitId, (sorti.get(m.produitId) ?? 0) + signe * m.quantiteSachets);
        }

        const produitIds = new Set([...voulu.keys(), ...sorti.keys()]);
        for (const produitId of produitIds) {
          const ecart = (voulu.get(produitId) ?? 0) - (sorti.get(produitId) ?? 0);
          if (ecart === 0) continue;
          await applyStockMovement(tx, {
            uuidClient: `cmd-${params.id}-${produitId}-${Date.now()}`,
            produitId,
            type: ecart > 0 ? "SORTIE" : "ENTREE",
            quantiteSachets: Math.abs(ecart),
            referenceType: "COMMANDE",
            referenceId: params.id,
            note: ecart > 0 ? "Livraison de commande" : "Annulation / réactivation de commande",
          });
        }

        return tx.commande.update({
          where: { id: params.id },
          data: {
            statut: statutCible,
            ...(nouvelleDate !== undefined ? { dateLivraisonPrevue: nouvelleDate } : {}),
            // Date de la 1re validation ; effacée si la commande redevient « en attente » ou est annulée.
            valideeAt: doitEtreValidee ? (existante.valideeAt ?? new Date()) : null,
          },
          select: { id: true, statut: true },
        });
      });
    } catch (e) {
      if (e instanceof InsufficientStockError) {
        return NextResponse.json(
          { error: "Stock insuffisant pour livrer cette commande. Réapprovisionnez le stock puis réessayez." },
          { status: 409 }
        );
      }
      throw e;
    }

    // Quand l'admin valide une commande (passage en livraison), le
    // commercial qui l'a enregistrée est notifié — il n'a autrement aucun
    // moyen de savoir que sa commande a été traitée avant qu'elle arrive.
    if (dateChangee || statutCible === "EN_LIVRAISON" || statutCible === "ANNULEE" || statutCible === "LIVREE") {
      await rafraichirAlerteLivraison(params.id);
    }

    if (statutCible === "EN_LIVRAISON" && existante.statut !== "EN_LIVRAISON") {
      const nomVendeur = existante.pointVente.vendeur || existante.pointVente.nom;
      const quartier = existante.pointVente.quartier?.nom || existante.pointVente.ville?.nom || "";
      const message = quartier
        ? `Commande de ${nomVendeur} (${quartier}) : en cours de livraison.`
        : `Commande de ${nomVendeur} : en cours de livraison.`;

      await prisma.notification.create({
        data: { userId: existante.commercialId, message },
      });
    }

    return NextResponse.json(commande);
  } catch (error) {
    return handleApiError(error);
  }
}
