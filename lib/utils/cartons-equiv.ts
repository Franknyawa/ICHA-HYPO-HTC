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

/** « 1/2 carton », « 1 1/2 carton », « 2,3 cartons » : lisible pour un commercial. */
export function libelleCartons(n: number): string {
  const r = Math.round(n * 100) / 100;
  const entier = Math.floor(r + 1e-9);
  const reste = Math.round((r - entier) * 100) / 100;
  const frac: Record<number, string> = { 0.25: "1/4", 0.5: "1/2", 0.75: "3/4" };
  let txt: string;
  if (reste === 0) txt = String(entier);
  else if (frac[reste]) txt = entier > 0 ? `${entier} ${frac[reste]}` : frac[reste];
  else txt = String(r).replace(".", ",");
  return `${txt} carton${r > 1 ? "s" : ""}`;
}

/** « 1 carton, 2 filets, 56 sachets » (unités saisies, au singulier/pluriel). */
export function detailQte(l: LigneQte): string {
  return (
    [
      l.nbCartons > 0 ? `${l.nbCartons} carton${l.nbCartons > 1 ? "s" : ""}` : "",
      l.nbFilets > 0 ? `${l.nbFilets} filet${l.nbFilets > 1 ? "s" : ""}` : "",
      l.nbSachets > 0 ? `${l.nbSachets} sachet${l.nbSachets > 1 ? "s" : ""}` : "",
    ]
      .filter(Boolean)
      .join(", ") || "—"
  );
}
