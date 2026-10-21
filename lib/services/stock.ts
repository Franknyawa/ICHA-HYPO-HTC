import type { Prisma, PrismaClient, TypeMouvementStock } from "@prisma/client";

export class InsufficientStockError extends Error {
  constructor(produitId: string) {
    super(`Stock insuffisant pour le produit ${produitId}.`);
    this.name = "InsufficientStockError";
  }
}

type TxClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

/**
 * Déduit (ou ajoute) du stock de façon atomique (la colonne `version` est conservée comme compteur de modifications).
 * Doit être appelé À L'INTÉRIEUR d'une transaction Prisma ($transaction) —
 * si la mise à jour touche 0 ligne (version déjà changée par une écriture
 * concurrente), on lève une erreur qui fait échouer toute la transaction :
 * ni la vente ni le mouvement de stock ne sont enregistrés (§17/§18 CDC).
 */
export async function applyStockMovement(
  tx: TxClient,
  params: {
    uuidClient: string;
    produitId: string;
    type: TypeMouvementStock; // "SORTIE" pour une vente, "ENTREE" pour un réassort
    quantiteSachets: number;
    referenceType?: string;
    referenceId?: string;
    /** Précision libre : motif d'une avarie, bénéficiaire d'un gift… */
    note?: string;
  }
) {
  const { uuidClient, produitId, type, quantiteSachets, referenceType, referenceId, note } =
    params;

  const stock = await tx.stock.findUnique({ where: { produitId } });
  if (!stock) {
    throw new Error(`Aucune fiche stock pour le produit ${produitId}.`);
  }

  // Mise à jour ATOMIQUE en base : pour une sortie, la condition « quantité suffisante »
  // est vérifiée dans la même requête que le débit. Deux validations simultanées ne
  // peuvent donc ni rendre le stock négatif ni se bloquer à tort l'une l'autre.
  if (type === "SORTIE") {
    const res = await tx.stock.updateMany({
      where: { produitId, quantiteSachets: { gte: quantiteSachets } },
      data: { quantiteSachets: { decrement: quantiteSachets }, version: { increment: 1 } },
    });
    if (res.count === 0) throw new InsufficientStockError(produitId);
  } else {
    await tx.stock.update({
      where: { produitId },
      data: { quantiteSachets: { increment: quantiteSachets }, version: { increment: 1 } },
    });
  }

  await tx.mouvementStock.create({
    data: {
      uuidClient,
      produitId,
      type,
      quantiteSachets,
      referenceType,
      referenceId,
      note,
    },
  });
}
