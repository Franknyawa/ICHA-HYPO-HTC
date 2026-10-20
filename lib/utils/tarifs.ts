// Calcul des prix — partagé par les formulaires terrain (hors ligne), la
// création de commande en back office et le serveur, pour que tout le monde
// applique exactement la même règle.
//
// Ordre d'application, du plus général au plus précis :
//   1. prix de base du produit,
//   2. prix spécifique au type de boutique (s'il existe),
//   3. grille tarifaire : le prix du CARTON dépend alors de la quantité de
//      cartons commandée pour ce produit (s'il existe un palier qui la couvre).

export type ProduitTarif = {
  id: string;
  prixSachet: number;
  prixFilet: number | null;
  prixCarton: number;
};

export type PrixTypeTarif = {
  produitId: string;
  typeId: string;
  prixSachet: number;
  prixFilet: number | null;
  prixCarton: number;
};

export type PalierTarif = {
  produitId: string;
  minCartons: number;
  maxCartons: number | null;
  prixCarton: number;
};

export type Quantites = { sachets: number; filets: number; cartons: number };
export type PrixUnitaires = { sachet: number; filet: number; carton: number };

export function palierPour(paliers: PalierTarif[], produitId: string, cartons: number): PalierTarif | null {
  if (cartons <= 0) return null;
  return (
    paliers.find(
      (p) => p.produitId === produitId && cartons >= p.minCartons && (p.maxCartons === null || cartons <= p.maxCartons)
    ) ?? null
  );
}

export function prixUnitaires(
  produit: ProduitTarif,
  opts: { typeId?: string | null; prixParType?: PrixTypeTarif[]; paliers?: PalierTarif[]; cartons?: number }
): PrixUnitaires {
  let sachet = produit.prixSachet;
  let filet = produit.prixFilet ?? 0;
  let carton = produit.prixCarton;

  if (opts.typeId) {
    const surcharge = opts.prixParType?.find((x) => x.produitId === produit.id && x.typeId === opts.typeId);
    if (surcharge) {
      sachet = surcharge.prixSachet;
      filet = surcharge.prixFilet ?? filet;
      carton = surcharge.prixCarton;
    }
  }

  const palier = palierPour(opts.paliers ?? [], produit.id, opts.cartons ?? 0);
  if (palier) carton = palier.prixCarton;

  return { sachet, filet, carton };
}

export function sousTotal(prix: PrixUnitaires, q: Quantites): number {
  return Math.round(q.sachets * prix.sachet + q.filets * prix.filet + q.cartons * prix.carton);
}

/** Calcule d'un coup prix appliqués + montant d'une ligne de commande. */
export function calculerLigne(
  produit: ProduitTarif,
  q: Quantites,
  opts: { typeId?: string | null; prixParType?: PrixTypeTarif[]; paliers?: PalierTarif[] }
) {
  const prix = prixUnitaires(produit, { ...opts, cartons: q.cartons });
  return { prix, montant: sousTotal(prix, q) };
}

/** Vérifie une grille : paliers triés, sans chevauchement. Renvoie un message d'erreur ou null. */
export function validerGrille(paliers: { minCartons: number; maxCartons: number | null }[]): string | null {
  const tries = [...paliers].sort((a, b) => a.minCartons - b.minCartons);
  for (let i = 0; i < tries.length; i++) {
    const p = tries[i];
    if (p.maxCartons !== null && p.maxCartons < p.minCartons) {
      return `Le palier ${p.minCartons}–${p.maxCartons} est incohérent (le maximum est inférieur au minimum).`;
    }
    const suivant = tries[i + 1];
    if (suivant) {
      if (p.maxCartons === null) return "Seul le dernier palier peut être sans limite haute.";
      if (suivant.minCartons <= p.maxCartons) {
        return `Les paliers ${p.minCartons}–${p.maxCartons} et ${suivant.minCartons}–${suivant.maxCartons ?? "∞"} se chevauchent.`;
      }
    }
  }
  return null;
}
