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
 * Déduit (ou ajoute) du stock avec verrou optimiste (colonne `version`).
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
  }
) {
  const { uuidClient, produitId, type, quantiteSachets, referenceType, referenceId } =
    params;

  const stock = await tx.stock.findUnique({ where: { produitId } });
  if (!stock) {
    throw new Error(`Aucune fiche stock pour le produit ${produitId}.`);
  }

  const delta = type === "SORTIE" ? -quantiteSachets : quantiteSachets;
  const nouvelleQuantite = stock.quantiteSachets + delta;

  if (nouvelleQuantite < 0) {
    throw new InsufficientStockError(produitId);
  }

  const updated = await tx.stock.updateMany({
    where: { produitId, version: stock.version },
    data: { quantiteSachets: nouvelleQuantite, version: { increment: 1 } },
  });

  if (updated.count === 0) {
    // Une autre transaction a modifié le stock entre notre lecture et notre
    // écriture — on abandonne plutôt que de risquer une incohérence.
    throw new InsufficientStockError(produitId);
  }

  await tx.mouvementStock.create({
    data: {
      uuidClient,
      produitId,
      type,
      quantiteSachets,
      referenceType,
      referenceId,
    },
  });
}
