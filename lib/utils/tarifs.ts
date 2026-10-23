// Calcul des prix — partagé par les formulaires terrain (hors ligne), la
// création de commande en back office et le serveur, pour que tout le monde
// applique exactement la même règle.
//
// Ordre d'application, du plus général au plus précis :
//   1. prix de base du produit,
//   2. prix spécifique au type de boutique (s'il existe),
//   3. grille tarifaire : le prix du CARTON dépend alors de la quantité de
//      cartons commandée pour ce produit (s'il existe un palier qui la couvre).

export type ConversionTarif = {
  sachetsParCarton?: number | null;
  sachetsParFilet?: number | null;
};

export type ProduitTarif = ConversionTarif & {
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

/** Nombre de sachets d'un demi-carton (56 pour HYPO, 60 pour HTC), ou null si inconnu. */
export function sachetsDemiCarton(conv?: ConversionTarif): number | null {
  const spc = conv?.sachetsParCarton ?? 0;
  return spc > 0 && spc % 2 === 0 ? spc / 2 : null;
}

/**
 * Le champ « cartons » accepte les demi-cartons (0,5 / 1,5…). La base ne stocke que des
 * entiers : le demi-carton est converti en filets (HTC : 6) ou en sachets (HYPO : 56).
 * Il sera facturé au prix du carton / 2 (4 500 HYPO, 4 800 HTC), voir `sousTotal`.
 */
export function normaliserCartons(q: Quantites, conv?: ConversionTarif): Quantites {
  const ent = Math.floor(q.cartons + 1e-9);
  const demis = Math.round((q.cartons - ent) * 2);
  if (demis === 0) return { ...q, cartons: ent };
  const demi = sachetsDemiCarton(conv);
  if (demi === null) return { ...q, cartons: ent + (demis >= 2 ? 1 : 0) };
  const spf = conv?.sachetsParFilet ?? 0;
  const enFilets = spf > 0 && demi % spf === 0;
  return {
    cartons: ent + (demis >= 2 ? 1 : 0),
    sachets: q.sachets + (enFilets || demis >= 2 ? 0 : demi),
    filets: q.filets + (enFilets && demis < 2 ? demi / spf : 0),
  };
}

/**
 * Montant d'une ligne. Règle « base carton » : tout ensemble de sachets / filets qui forme un
 * demi-carton (56 sachets HYPO, 60 sachets ou 6 filets HTC) est facturé au demi-prix du carton
 * (4 500 / 4 800 FCFA), pas au sachet. Le reste (moins d'un demi-carton) est facturé à l'unité.
 */
export function sousTotal(prix: PrixUnitaires, q: Quantites, conv?: ConversionTarif, detail = false): number {
  // Vente au détail : chaque sachet / filet à son prix unitaire, sans regroupement en demi-cartons.
  if (detail) return Math.round(q.sachets * prix.sachet + q.filets * prix.filet + q.cartons * prix.carton);
  const demi = sachetsDemiCarton(conv);
  const spf = conv?.sachetsParFilet ?? 0;
  if (demi === null) return Math.round(q.sachets * prix.sachet + q.filets * prix.filet + q.cartons * prix.carton);

  const sachetsEq = q.sachets + (spf > 0 ? q.filets * spf : 0);
  const filetsSepares = spf > 0 ? 0 : q.filets;
  const nbDemis = Math.floor(sachetsEq / demi);
  const reste = sachetsEq - nbDemis * demi;
  const restFilets = spf > 0 ? Math.floor(reste / spf) : 0;
  const restSachets = reste - restFilets * spf;
  return Math.round(
    q.cartons * prix.carton +
      nbDemis * (prix.carton / 2) +
      restFilets * prix.filet +
      restSachets * prix.sachet +
      filetsSepares * prix.filet
  );
}

/** Prix de la vente au détail, identiques pour tous les produits : sachet 100 F, filet 1 000 F. */
export const PRIX_DETAIL = { sachet: 100, filet: 1000 } as const;

/** Ligne de vente au détail : sachets (tous produits) et filets (produits à filets), prix fixes. */
export function calculerLigneDetail(q: { sachets: number; filets: number }) {
  const prix = { sachet: PRIX_DETAIL.sachet, filet: PRIX_DETAIL.filet, carton: 0 };
  const quantites = { sachets: q.sachets, filets: q.filets, cartons: 0 };
  return { prix, montant: sousTotal(prix, quantites, undefined, true), quantites };
}

/** Valeur d'une ligne au prix catalogue du produit (estimations, rapports). */
export function valeurCatalogueLigne(
  l: { nbSachets: number; nbFilets: number; nbCartons: number; detail?: boolean },
  p: ConversionTarif & { prixSachet: unknown; prixFilet: unknown; prixCarton: unknown }
): number {
  if (l.detail) return calculerLigneDetail({ sachets: l.nbSachets, filets: l.nbFilets }).montant;
  return sousTotal(
    { sachet: Number(p.prixSachet), filet: Number(p.prixFilet ?? 0), carton: Number(p.prixCarton) },
    { sachets: l.nbSachets, filets: l.nbFilets, cartons: l.nbCartons },
    p
  );
}

/** Calcule d'un coup prix appliqués + montant d'une ligne de commande. */
export function calculerLigne(
  produit: ProduitTarif,
  q: Quantites,
  opts: { typeId?: string | null; prixParType?: PrixTypeTarif[]; paliers?: PalierTarif[] }
) {
  const quantites = normaliserCartons(q, produit);
  const prix = prixUnitaires(produit, { ...opts, cartons: quantites.cartons });
  return { prix, montant: sousTotal(prix, quantites, produit), quantites };
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
