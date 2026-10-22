/**
 * Quantité d'une ligne exprimée en cartons, filets et sachets convertis.
 * Sert à toutes les statistiques (tableau de bord, objectifs, rapports) :
 * compter seulement `nbCartons` ignorait les ventes au détail.
 */
export type LigneQte = { nbSachets: number; nbFilets: number; nbCartons: number };
export type ProduitConv = { sachetsParCarton: number; filetsParCarton: number | null };

export const SELECT_CONV = { sachetsParCarton: true, filetsParCarton: true } as const;

export function cartonsEq(l: LigneQte, p: ProduitConv): number {
  const filets = p.filetsParCarton && p.filetsParCarton > 0 ? l.nbFilets / p.filetsParCarton : 0;
  const sachets = p.sachetsParCarton > 0 ? l.nbSachets / p.sachetsParCarton : 0;
  return l.nbCartons + filets + sachets;
}

export function arrondiCartons(n: number): number {
  return Math.round(n * 10) / 10;
}
