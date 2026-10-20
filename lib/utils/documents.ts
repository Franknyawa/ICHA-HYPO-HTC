// Éléments communs aux documents imprimés (bon de commande, facture, bon de
// livraison) : identité de l'entreprise, numérotation, désignations, lignes.

export const ENTREPRISE = {
  nom: "ICHA IMPORT",
  activites: "Importation, Commerce Général, Prestation de Services",
  pied:
    "ICHA IMPORT - Immeuble le CAURIS BP 7367 Douala Cameroun. NC : M012216966656, RC/DLA/2022/A/333. " +
    "TEL : + (237) 690 98 81 33 / + (237) 696 48 70 22. Email : secretcameroun@gmail.com",
} as const;

const pad5 = (n: number) => String(n).padStart(5, "0");

export const numeroFacture = (n: number) => `FVICHA ${pad5(n)}`;
export const numeroBonLivraison = (n: number) => `BLICHA ${pad5(n)}`;

export type ModePaiementId = "ESPECES" | "MOBILE_MONEY" | "CREDIT_PARTIEL" | "CREDIT_TOTAL";

export const LIBELLE_MODE_PAIEMENT: Record<ModePaiementId, string> = {
  ESPECES: "Espèces",
  MOBILE_MONEY: "OM/MOMO",
  CREDIT_PARTIEL: "Crédit partiel",
  CREDIT_TOTAL: "Crédit total",
};

export function libelleModePaiement(mode: string | null | undefined): string {
  if (!mode) return "À définir";
  return LIBELLE_MODE_PAIEMENT[mode as ModePaiementId] ?? mode;
}

type ProduitDesignation = {
  nom: string;
  designation?: string | null;
  sachetsParCarton?: number | null;
  volumeMl?: number | null;
};

/** Libellé imprimé d'un produit : la désignation saisie, sinon construite automatiquement. */
export function designationProduit(p: ProduitDesignation): string {
  if (p.designation && p.designation.trim()) return p.designation.trim();
  if (p.sachetsParCarton && p.volumeMl) {
    return `${p.nom} carton de ${p.sachetsParCarton} sachets de ${p.volumeMl}ml`;
  }
  return p.nom;
}

export type LigneSource = {
  produitCode: string;
  produitNom: string;
  designation?: string | null;
  sachetsParCarton?: number | null;
  volumeMl?: number | null;
  nbSachets: number;
  nbFilets: number;
  nbCartons: number;
  prixSachet?: number | null;
  prixFilet?: number | null;
  prixCarton?: number | null;
  /** Montant total enregistré pour la ligne produit (sert à retrouver un prix manquant). */
  montant?: number | null;
};

export type LigneDocument = {
  reference: string;
  designation: string;
  quantite: number;
  /** Texte affiché : « 5 » pour des cartons, « 12 sachets » / « 3 filets » sinon. */
  quantiteTexte: string;
  unite: "carton" | "filet" | "sachet";
  prixUnitaire: number | null;
  total: number | null;
};

/**
 * Une ligne imprimée par produit ET par unité réellement commandée. Un
 * commercial qui ne saisit que des cartons obtient donc une seule ligne,
 * quantité « 5 » sans mention de sachet ni de filet.
 */
export function lignesDocument(sources: LigneSource[]): LigneDocument[] {
  const lignes: LigneDocument[] = [];
  for (const s of sources) {
    const base = designationProduit({
      nom: s.produitNom,
      designation: s.designation,
      sachetsParCarton: s.sachetsParCarton,
      volumeMl: s.volumeMl,
    });
    const unites: { unite: LigneDocument["unite"]; qte: number; prix: number | null | undefined }[] = [
      { unite: "carton", qte: s.nbCartons, prix: s.prixCarton },
      { unite: "filet", qte: s.nbFilets, prix: s.prixFilet },
      { unite: "sachet", qte: s.nbSachets, prix: s.prixSachet },
    ];
    const utilisees = unites.filter((u) => u.qte > 0);
    for (const u of utilisees) {
      let prix: number | null = u.prix ?? null;
      // Ancienne ligne sans prix enregistré : si une seule unité est utilisée,
      // le prix se déduit du montant de la ligne.
      if ((prix === null || prix === 0) && utilisees.length === 1 && s.montant) {
        prix = Math.round(s.montant / u.qte);
      }
      lignes.push({
        reference: s.produitCode,
        designation: u.unite === "carton" ? base : `${base} — vente au ${u.unite}`,
        quantite: u.qte,
        quantiteTexte: u.unite === "carton" ? String(u.qte) : `${u.qte} ${u.unite}s`,
        unite: u.unite,
        prixUnitaire: prix,
        total: prix === null ? null : Math.round(prix * u.qte),
      });
    }
  }
  return lignes;
}

export function totalLignes(lignes: LigneDocument[]): number {
  return lignes.reduce((s, l) => s + (l.total ?? 0), 0);
}

export type AdresseClient = {
  nom: string;
  ville?: string | null;
  quartier?: string | null;
  repere?: string | null;
  telephone?: string | null;
};

export function adresseTexte(a: AdresseClient): string {
  return [a.quartier, a.repere, a.ville].filter(Boolean).join(", ");
}
