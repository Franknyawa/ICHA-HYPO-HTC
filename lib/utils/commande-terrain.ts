// Préparation d'une commande saisie sur le terrain : applique les prix
// (base → type de boutique → grille tarifaire), fige les prix par ligne et
// prépare les lignes imprimées sur le bon de commande.

import {
  calculerLigne,
  calculerLigneDetail,
  type PalierTarif,
  type PrixTypeTarif,
  type ProduitTarif,
  type Quantites,
} from "./tarifs";
import type { LigneSource } from "./documents";

export type ProduitForm = ProduitTarif & {
  code: string;
  nom: string;
  designation?: string | null;
  volumeMl?: number | null;
};

export type QuantitesParCode = Record<string, Quantites>;

export type LignePayload = {
  produitCode: string;
  nbSachets: number;
  nbFilets: number;
  nbCartons: number;
  prixSachet: number;
  prixFilet: number;
  prixCarton: number;
  montant: number;
  /** Ligne de vente au détail (sachets / filets à prix fixe). */
  detail?: boolean;
};

export type CommandePreparee = {
  lignes: LignePayload[];
  sources: LigneSource[];
  total: number;
  sousTotaux: Map<string, number>;
  /** Sous-totaux de la vente au détail, par produit. */
  sousTotauxDetail: Map<string, number>;
};

export function preparerCommande(
  produits: ProduitForm[],
  quantites: QuantitesParCode,
  ctx: { typeId?: string | null; prixParType?: PrixTypeTarif[]; paliers?: PalierTarif[] },
  detail?: QuantitesParCode
): CommandePreparee {
  const lignes: LignePayload[] = [];
  const sources: LigneSource[] = [];
  const sousTotaux = new Map<string, number>();
  const sousTotauxDetail = new Map<string, number>();
  let total = 0;

  for (const p of produits) {
    const q = quantites[p.code] ?? { sachets: 0, filets: 0, cartons: 0 };
    const { prix, montant, quantites: qn } = calculerLigne(p, q, ctx);
    sousTotaux.set(p.code, montant);
    if (q.sachets === 0 && q.filets === 0 && q.cartons === 0) continue;
    total += montant;
    lignes.push({
      produitCode: p.code,
      nbSachets: qn.sachets,
      nbFilets: qn.filets,
      nbCartons: qn.cartons,
      prixSachet: prix.sachet,
      prixFilet: prix.filet,
      prixCarton: prix.carton,
      montant,
    });
    sources.push({
      produitCode: p.code,
      produitNom: p.nom,
      designation: p.designation,
      sachetsParCarton: p.sachetsParCarton,
      sachetsParFilet: p.sachetsParFilet,
      volumeMl: p.volumeMl,
      nbSachets: qn.sachets,
      nbFilets: qn.filets,
      nbCartons: qn.cartons,
      prixSachet: prix.sachet,
      prixFilet: prix.filet,
      prixCarton: prix.carton,
      montant,
    });
  }

  // Vente au détail : lignes séparées, sachets à 100 F et filets à 1 000 F.
  if (detail) {
    for (const p of produits) {
      const d = detail[p.code];
      if (!d) continue;
      const q = { sachets: d.sachets, filets: p.prixFilet !== null ? d.filets : 0 };
      const { prix, montant } = calculerLigneDetail(q);
      sousTotauxDetail.set(p.code, montant);
      if (q.sachets === 0 && q.filets === 0) continue;
      total += montant;
      lignes.push({
        produitCode: p.code,
        nbSachets: q.sachets,
        nbFilets: q.filets,
        nbCartons: 0,
        prixSachet: prix.sachet,
        prixFilet: prix.filet,
        prixCarton: p.prixCarton,
        montant,
        detail: true,
      });
      sources.push({
        produitCode: p.code,
        produitNom: p.nom,
        designation: p.designation,
        sachetsParCarton: p.sachetsParCarton,
        sachetsParFilet: p.sachetsParFilet,
        volumeMl: p.volumeMl,
        nbSachets: q.sachets,
        nbFilets: q.filets,
        nbCartons: 0,
        prixSachet: prix.sachet,
        prixFilet: prix.filet,
        prixCarton: p.prixCarton,
        montant,
        detail: true,
      });
    }
  }
  return { lignes, sources, total, sousTotaux, sousTotauxDetail };
}
