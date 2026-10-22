// Préparation d'une commande saisie sur le terrain : applique les prix
// (base → type de boutique → grille tarifaire), fige les prix par ligne et
// prépare les lignes imprimées sur le bon de commande.

import {
  calculerLigne,
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
};

export type CommandePreparee = {
  lignes: LignePayload[];
  sources: LigneSource[];
  total: number;
  sousTotaux: Map<string, number>;
};

export function preparerCommande(
  produits: ProduitForm[],
  quantites: QuantitesParCode,
  ctx: { typeId?: string | null; prixParType?: PrixTypeTarif[]; paliers?: PalierTarif[] }
): CommandePreparee {
  const lignes: LignePayload[] = [];
  const sources: LigneSource[] = [];
  const sousTotaux = new Map<string, number>();
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
  return { lignes, sources, total, sousTotaux };
}
