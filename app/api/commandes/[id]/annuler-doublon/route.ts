import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/auth/rbac";
import { peutModifier } from "@/lib/auth/permissions";
import { handleApiError } from "@/lib/api-errors";
import { applyStockMovement } from "@/lib/services/stock";
import { rafraichirAlerteLivraison } from "@/lib/jobs/alertes";

export const runtime = "nodejs";

const schema = z.object({ motif: z.string().trim().max(200).optional() });

/**
 * Annule une commande déjà validée / livrée qui est un DOUBLON d'une autre commande (ex. saisie au bureau
 * puis ressaisie par le commercial). Rien n'est supprimé :
 *  - le stock sorti pour cette commande est remis (mouvement d'entrée « Annulation doublon ») ;
 *  - chaque encaissement est neutralisé par une écriture de caisse de sortie liée au doublon
 *    (le solde de caisse redevient juste et l'historique reste lisible) ;
 *  - la commande passe en « Annulée » ; la vente du commercial (statistiques) n'est pas touchée.
 * Refusé s'il existe un avoir ou un retour (la correction passe alors par ces documents).
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireModule("commandes");
    if (!peutModifier(session.role)) {
      return NextResponse.json({ error: "Seul un administrateur peut annuler un doublon livré." }, { status: 403 });
    }
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    const motif = parsed.success ? parsed.data.motif : undefined;

    const commande = await prisma.commande.findUnique({
      where: { id: params.id },
      select: { id: true, statut: true, pointVente: { select: { nom: true } } },
    });
    if (!commande) return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
    if (commande.statut !== "EN_LIVRAISON" && commande.statut !== "LIVREE") {
      return NextResponse.json({ error: "Seule une commande validée ou livrée peut être annulée comme doublon (sinon, utilisez « Annuler »)." }, { status: 409 });
    }
    const [nbAvoirs, nbRetours] = await Promise.all([
      prisma.factureAvoir.count({ where: { commandeId: params.id } }),
      prisma.factureRetour.count({ where: { commandeId: params.id } }),
    ]);
    if (nbAvoirs + nbRetours > 0) {
      return NextResponse.json({ error: "Cette commande a déjà un avoir ou un retour : corrigez-la avec ces documents." }, { status: 409 });
    }

    const resume = await prisma.$transaction(async (tx) => {
      // 1. Stock : on remet ce qui est sorti pour cette commande (net des mouvements existants).
      const mouvements = await tx.mouvementStock.findMany({
        where: { referenceType: "COMMANDE", referenceId: params.id },
        select: { produitId: true, type: true, quantiteSachets: true },
      });
      const sorti = new Map<string, number>();
      for (const m of mouvements) {
        sorti.set(m.produitId, (sorti.get(m.produitId) ?? 0) + (m.type === "SORTIE" ? 1 : -1) * m.quantiteSachets);
      }
      let sachetsRemis = 0;
      for (const [produitId, qte] of sorti) {
        if (qte <= 0) continue;
        await applyStockMovement(tx, {
          uuidClient: `doublon-${params.id}-${produitId}-${Date.now()}`,
          produitId,
          type: "ENTREE",
          quantiteSachets: qte,
          referenceType: "COMMANDE",
          referenceId: params.id,
          note: `Annulation doublon livré${motif ? ` — ${motif}` : ""}`,
        });
        sachetsRemis += qte;
      }

      // 2. Caisse : chaque encaissement de cette commande est neutralisé par une sortie liée au doublon.
      const paiements = await tx.paiement.findMany({ where: { commandeId: params.id }, select: { montant: true, modePaiement: true, datePaiement: true } });
      let montantNeutralise = 0;
      for (const p of paiements) {
        const m = Number(p.montant);
        if (m <= 0) continue;
        await tx.operationCaisse.create({
          data: {
            type: "DEPENSE",
            canal: p.modePaiement === "MOBILE_MONEY" ? "MOBILE_MONEY" : p.modePaiement === "BANQUE" ? "BANQUE" : "ESPECES",
            montant: m,
            categorie: "Annulation d'un encaissement en doublon",
            note: `${commande.pointVente.nom}${motif ? ` — ${motif}` : ""}`,
            referenceType: "DOUBLON",
            referenceId: params.id,
            createdById: session.userId,
            // Daté du jour de l'encaissement annulé : la journée du jour n'est pas faussée.
            dateOperation: p.datePaiement,
          },
        });
        montantNeutralise += m;
      }

      // 3. La commande est annulée (conservée pour l'historique).
      await tx.commande.update({ where: { id: params.id }, data: { statut: "ANNULEE", valideeAt: null } });
      return { sachetsRemis, montantNeutralise };
    });

    await rafraichirAlerteLivraison(params.id);
    return NextResponse.json({ ok: true, ...resume });
  } catch (error) {
    return handleApiError(error);
  }
}
