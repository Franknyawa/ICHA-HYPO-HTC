// Éléments communs aux documents imprimés (bon de commande, facture, bon de
// livraison) : identité de l'entreprise, numérotation, désignations, lignes.

import { sousTotal } from "./tarifs";

export const ENTREPRISE = {
  nom: "ICHA IMPORT",
  activites: "Importation, Commerce Général, Prestation de Services",
  pied:
    "ICHA IMPORT - Immeuble le CAURIS BP 7367 Douala Cameroun. NC : M012216966656, RC/DLA/2022/A/333. " +
    "TEL : + (237) 690 98 81 33 / + (237) 696 48 70 22. Email : secretcameroun@gmail.com",
} as const;

const pad5 = (n: number) => String(n).padStart(5, "0");

export const numeroFacture = (n: number) => `FVICHA ${pad5(n)}`;
export const numeroAvoir = (n: number) => `FA${pad5(n)}`;
export const numeroRetour = (n: number) => `FR${pad5(n)}`;
export const numeroBonCommande = (n: number) => `BCICHA ${pad5(n)}`;
export const numeroBonLivraison = (n: number) => `BLICHA ${pad5(n)}`;

export type ModePaiementId = "ESPECES" | "MOBILE_MONEY" | "BANQUE" | "CREDIT_PARTIEL" | "CREDIT_TOTAL";

export const LIBELLE_MODE_PAIEMENT: Record<ModePaiementId, string> = {
  ESPECES: "Espèces",
  MOBILE_MONEY: "OM/MOMO",
  BANQUE: "Opération bancaire",
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

/** « 5 cartons », « 1 filet », « 12 sachets » : l'unité est toujours écrite. */
export function texteQuantite(unite: "carton" | "filet" | "sachet", n: number): string {
  const r = Math.round(n * 100) / 100;
  return `${r.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} ${unite}${r > 1 ? "s" : ""}`;
}

export type LigneSource = {
  produitCode: string;
  produitNom: string;
  designation?: string | null;
  sachetsParCarton?: number | null;
  sachetsParFilet?: number | null;
  volumeMl?: number | null;
  nbSachets: number;
  nbFilets: number;
  nbCartons: number;
  prixSachet?: number | null;
  prixFilet?: number | null;
  prixCarton?: number | null;
  /** Prix catalogue du carton (sert à calculer la remise de palier). */
  prixCartonBase?: number | null;
  /** Montant total enregistré pour la ligne produit (sert à retrouver un prix manquant). */
  montant?: number | null;
  /** Vente au détail : sachets / filets facturés à l'unité (100 F / 1 000 F). */
  detail?: boolean;
};

export type LigneDocument = {
  reference: string;
  designation: string;
  quantite: number;
  /** Texte affiché avec son unité : « 5 cartons », « 3 filets », « 12 sachets ». */
  quantiteTexte: string;
  unite: "carton" | "filet" | "sachet";
  prixUnitaire: number | null;
  total: number | null;
  /** Remise de palier en % (produits HYPO uniquement) ; prixReference = prix catalogue avant remise. */
  remisePct?: number | null;
  prixReference?: number | null;
};

/**
 * Une ligne imprimée par produit ET par unité réellement commandée. Un
 * commercial qui ne saisit que des cartons obtient donc une seule ligne,
 * quantité « 5 » sans mention de sachet ni de filet.
 */
export function lignesDocument(sources: LigneSource[]): LigneDocument[] {
  return lignesCartons(sources).map((l) =>
    l.unite === "carton" ? { ...l, quantiteTexte: texteQuantite("carton", l.quantite) } : l
  );
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
  /** Nom affiché sur la ligne de signature : « Signature Dora ». */
  signataire?: string | null;
};

export function adresseTexte(a: AdresseClient): string {
  return [a.quartier, a.repere, a.ville].filter(Boolean).join(", ");
}

/** « 2 », « 2,5 », « 0,25 » : au plus 2 décimales, virgule française. */
export function formaterCartons(n: number): string {
  const r = Math.round(n * 100) / 100;
  return r.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
}

/**
 * Lignes de facture avec un seul référentiel : le carton. Les filets et les
 * sachets sont convertis en équivalent carton (ex. 12 sachets d'un carton de
 * 24 = 0,5 carton). Une ligne par produit ; le total reste la somme exacte
 * des montants d'origine, le prix unitaire est le prix du carton équivalent.
 */
export function lignesCartons(toutes: LigneSource[]): LigneDocument[] {
  const sources = toutes.filter((x) => !x.detail);
  const detail = toutes.filter((x) => x.detail);
  const parProduit = new Map<string, { source: LigneSource; cartons: number; total: number | null; pur: boolean }>();
  for (const s of sources) {
    const parCarton = s.sachetsParCarton && s.sachetsParCarton > 0 ? s.sachetsParCarton : 1;
    const parFilet = s.sachetsParFilet && s.sachetsParFilet > 0 ? s.sachetsParFilet : 1;
    const cartons = s.nbCartons + (s.nbFilets * parFilet) / parCarton + s.nbSachets / parCarton;
    if (cartons <= 0) continue;
    // Total de la ligne : montant enregistré, sinon somme des prix unitaires.
    const calcule = sousTotal(
      { carton: s.prixCarton ?? 0, filet: s.prixFilet ?? 0, sachet: s.prixSachet ?? 0 },
      { cartons: s.nbCartons, filets: s.nbFilets, sachets: s.nbSachets },
      s
    );
    const total = s.montant && s.montant > 0 ? s.montant : calcule > 0 ? calcule : null;
    const cle = s.produitCode;
    const cur = parProduit.get(cle);
    const purCarton = s.nbFilets === 0 && s.nbSachets === 0;
    if (cur) {
      cur.pur = cur.pur && purCarton;
      cur.cartons += cartons;
      cur.total = cur.total === null || total === null ? null : cur.total + total;
    } else {
      parProduit.set(cle, { source: s, cartons, total, pur: purCarton });
    }
  }
  const lignesDetail: LigneDocument[] = [];
  for (const s of detail) {
    const base = designationProduit({ nom: s.produitNom, designation: s.designation, sachetsParCarton: s.sachetsParCarton, volumeMl: s.volumeMl });
    const unites: { unite: "filet" | "sachet"; qte: number; prix: number }[] = [
      { unite: "sachet", qte: s.nbSachets, prix: s.prixSachet ?? 100 },
      { unite: "filet", qte: s.nbFilets, prix: s.prixFilet ?? 1000 },
    ];
    for (const u of unites.filter((x) => x.qte > 0)) {
      lignesDetail.push({
        reference: s.produitCode,
        designation: `${base} — vente au détail (${u.unite})`,
        quantite: u.qte,
        quantiteTexte: texteQuantite(u.unite, u.qte),
        unite: u.unite,
        prixUnitaire: u.prix,
        total: Math.round(u.prix * u.qte),
        remisePct: null,
        prixReference: null,
      });
    }
  }

  const lignesGros = Array.from(parProduit.values()).map(({ source, cartons, total, pur }) => {
    const prixUnitaire = total === null ? null : Math.round(total / cartons);
    // Remise de palier : uniquement HYPO, sur des CARTONS entiers (la grille ne s'applique pas
    // aux sachets ni aux filets), quand le prix du carton tombe sous le prix catalogue.
    const base = source.prixCartonBase ?? null;
    const remise =
      source.produitCode === "HYPO" && pur && base && prixUnitaire !== null && prixUnitaire < base
        ? Math.round((1 - prixUnitaire / base) * 10000) / 100
        : null;
    return {
      reference: source.produitCode,
      designation: designationProduit({
        nom: source.produitNom,
        designation: source.designation,
        sachetsParCarton: source.sachetsParCarton,
        volumeMl: source.volumeMl,
      }),
      quantite: cartons,
      quantiteTexte: formaterCartons(cartons),
      unite: "carton" as const,
      prixUnitaire,
      total: total === null ? null : Math.round(total),
      remisePct: remise,
      prixReference: remise !== null ? base : null,
    };
  });
  return [...lignesGros, ...lignesDetail];
}
