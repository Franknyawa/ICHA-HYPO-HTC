import type { Produit, PrixParType, PalierPrix } from "@prisma/client";
import { calculerLigne, calculerLigneDetail } from "@/lib/utils/tarifs";

export type EntreeLigne = { produitCode: string; nbSachets: number; nbFilets: number; nbCartons: number; detail?: boolean };

export type LigneCalculee = {
  produitId: string;
  nbSachets: number;
  nbFilets: number;
  nbCartons: number;
  prixSachet: number;
  prixFilet: number;
  prixCarton: number;
  montant: number;
  detail: boolean;
};

export class ErreurCalcul extends Error {
  constructor(message: string, public statut = 400) {
    super(message);
  }
}

/**
 * Recalcule côté serveur les lignes d'une commande (jamais les prix du navigateur) :
 * base → type de boutique → grille par quantité ; ventes au détail à prix fixe.
 */
export function calculerLignesCommande(
  entrees: EntreeLigne[],
  ref: { produits: Produit[]; prixParType: PrixParType[]; paliers: PalierPrix[]; typeId: string | null }
): LigneCalculee[] {
  const produitParCode = new Map(ref.produits.map((p) => [p.code, p]));
  const ctx = {
    typeId: ref.typeId,
    prixParType: ref.prixParType.map((x) => ({
      produitId: x.produitId,
      typeId: x.typeId,
      prixSachet: Number(x.prixSachet),
      prixFilet: x.prixFilet === null ? null : Number(x.prixFilet),
      prixCarton: Number(x.prixCarton),
    })),
    paliers: ref.paliers.map((x) => ({
      produitId: x.produitId,
      minCartons: x.minCartons,
      maxCartons: x.maxCartons,
      prixCarton: Number(x.prixCarton),
    })),
  };

  return entrees
    .filter((l) => l.nbSachets + l.nbFilets + l.nbCartons > 0)
    .map((l) => {
      const p = produitParCode.get(l.produitCode);
      if (!p) throw new ErreurCalcul(`Produit inconnu : ${l.produitCode}`);
      if (l.detail) {
        // Vente au détail : sachets 100 F, filets 1 000 F (filets seulement pour les produits à filets).
        const { prix, montant, quantites: qd } = calculerLigneDetail({ sachets: l.nbSachets, filets: p.prixFilet === null ? 0 : l.nbFilets });
        return { produitId: p.id, nbSachets: qd.sachets, nbFilets: qd.filets, nbCartons: 0, prixSachet: prix.sachet, prixFilet: prix.filet, prixCarton: Number(p.prixCarton), montant, detail: true };
      }
      const { prix, montant, quantites: qn } = calculerLigne(
        { id: p.id, prixSachet: Number(p.prixSachet), prixFilet: p.prixFilet === null ? null : Number(p.prixFilet), prixCarton: Number(p.prixCarton), sachetsParCarton: p.sachetsParCarton, sachetsParFilet: p.sachetsParFilet },
        { sachets: l.nbSachets, filets: l.nbFilets, cartons: l.nbCartons },
        ctx
      );
      return { produitId: p.id, nbSachets: qn.sachets, nbFilets: qn.filets, nbCartons: qn.cartons, prixSachet: prix.sachet, prixFilet: prix.filet, prixCarton: prix.carton, montant, detail: false };
    });
}
