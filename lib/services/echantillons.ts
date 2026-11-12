import type { Prisma, PrismaClient } from "@prisma/client";
import { applyStockMovement, InsufficientStockError } from "@/lib/services/stock";

type Tx = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

export type LigneEchantillon = { produitCode: string; sachets: number };

/**
 * Échantillons donnés au client : les sachets sortent du stock SANS être facturés
 * (aucune vente, aucune commande, aucun montant). Un mouvement « ECHANTILLON » par produit,
 * visible dans la page Stock (sorties hors vente).
 *
 * - Idempotent : `cle` + code produit forment l'identifiant du mouvement, un rejeu ne débite pas deux fois.
 * - Ne bloque JAMAIS l'enregistrement de la visite : si le stock est insuffisant, on débite ce qui reste
 *   et la note l'indique.
 */
export async function enregistrerEchantillons(
  tx: Tx,
  params: { cle: string; lignes: LigneEchantillon[]; referenceId?: string; note: string }
) {
  const demandes = new Map<string, number>();
  for (const l of params.lignes) {
    if (l.sachets > 0) demandes.set(l.produitCode, (demandes.get(l.produitCode) ?? 0) + Math.floor(l.sachets));
  }
  if (demandes.size === 0) return [];

  const produits = await tx.produit.findMany({
    where: { code: { in: [...demandes.keys()] } },
    select: { id: true, code: true, stock: { select: { quantiteSachets: true } } },
  });
  const sortie: { code: string; demandes: number; debites: number }[] = [];
  for (const p of produits) {
    const uuidClient = `${params.cle}:echantillon:${p.code}`;
    const deja = await tx.mouvementStock.findUnique({ where: { uuidClient }, select: { id: true } });
    if (deja) continue;
    const voulu = demandes.get(p.code) ?? 0;
    const dispo = Math.max(0, p.stock?.quantiteSachets ?? 0);
    const quantite = Math.min(voulu, dispo);
    if (quantite <= 0) continue;
    try {
      await applyStockMovement(tx, {
        uuidClient,
        produitId: p.id,
        type: "SORTIE",
        quantiteSachets: quantite,
        referenceType: "ECHANTILLON",
        referenceId: params.referenceId,
        note: quantite < voulu ? `${params.note} · stock insuffisant : ${quantite} sur ${voulu} sachets débités` : params.note,
      });
      sortie.push({ code: p.code, demandes: voulu, debites: quantite });
    } catch (e) {
      if (!(e instanceof InsufficientStockError)) throw e;
    }
  }
  return sortie;
}

export type _Tx = Prisma.TransactionClient;
