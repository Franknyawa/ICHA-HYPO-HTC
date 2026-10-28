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


// ---------------------------------------------------------------------------
// Vente en cartons (gros) ou au détail (sachets / filets à l'unité)
// ---------------------------------------------------------------------------
// Une ligne « détail » est une vente de sachets (100 F) ou de filets (1000 F) à l'unité ;
// toutes les autres lignes (cartons, demi-cartons) sont des ventes en cartons.
// Utile pour le marketing : part des ventes en cartons et part au détail.

export type Vol = {
  /** Cartons vendus en cartons (demi-cartons compris). */
  gros: number;
  /** Vente au détail exprimée en cartons, uniquement pour calculer des pourcentages. */
  detailEq: number;
  /** Sachets vendus à l'unité. */
  sd: number;
  /** Filets vendus à l'unité. */
  fd: number;
};

export const volVide = (): Vol => ({ gros: 0, detailEq: 0, sd: 0, fd: 0 });

export function volLigne(l: LigneQte & { detail?: boolean | null }, p: ProduitConv): Vol {
  const eq = cartonsEq(l, p);
  return l.detail ? { gros: 0, detailEq: eq, sd: l.nbSachets, fd: l.nbFilets } : { gros: eq, detailEq: 0, sd: 0, fd: 0 };
}

export function volAjouter(a: Vol, b: Vol): Vol {
  a.gros += b.gros;
  a.detailEq += b.detailEq;
  a.sd += b.sd;
  a.fd += b.fd;
  return a;
}

/** « 120 sachets · 2 filets » (ou « — » quand rien n'a été vendu au détail). */
export function texteDetail(v: Pick<Vol, "sd" | "fd">): string {
  const parts = [
    v.sd > 0 ? `${new Intl.NumberFormat("fr-FR").format(Math.round(v.sd))} sachet${v.sd > 1 ? "s" : ""}` : "",
    v.fd > 0 ? `${new Intl.NumberFormat("fr-FR").format(Math.round(v.fd))} filet${v.fd > 1 ? "s" : ""}` : "",
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "—";
}

/** Part des ventes en cartons et au détail, en % (somme = 100). */
export function partsVente(v: Pick<Vol, "gros" | "detailEq">): { cartons: number; detail: number } | null {
  const total = v.gros + v.detailEq;
  if (total <= 0) return null;
  const detail = Math.round((v.detailEq / total) * 1000) / 10;
  return { cartons: Math.round((100 - detail) * 10) / 10, detail };
}

export function texteParts(v: Pick<Vol, "gros" | "detailEq">): string {
  const p = partsVente(v);
  const f = (n: number) => String(n).replace(".", ",");
  return p ? `${f(p.cartons)} % cartons · ${f(p.detail)} % détail` : "—";
}
