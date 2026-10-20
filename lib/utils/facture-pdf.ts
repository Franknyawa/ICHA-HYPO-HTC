// Facture PDF — partagée par la liste admin des factures et l'onglet Commandes.
// Mise en page : en-tête de marque, bloc facture (numéro, agent) à gauche,
// bloc point de vente à droite, tableau Code / Désignation / Quantité /
// Prix unitaire / Prix total, mode de paiement, montant en lettres,
// signatures et pied de page légal.

import { formatFcfa, formatMontant } from "./format";
import { montantEnLettres } from "./nombre-en-lettres";
import type { AdresseClient, LigneDocument } from "./documents";
import {
  assurerPlace,
  C,
  dessinerBloc,
  dessinerEnTete,
  dessinerPieds,
  dessinerSignatures,
  MARGE,
  HAUTEUR_EN_TETE,
  nomFichier,
  nouveauDocument,
  STYLE_TABLE,
} from "./pdf-document";

export type FactureData = {
  /** Déjà formaté : « FVICHA 00001 ». */
  numero: string;
  date: Date;
  agentNom?: string | null;
  client: AdresseClient;
  lignes: LigneDocument[];
  montantTotal: number;
  modePaiementLabel: string;
  /** Somme déjà encaissée (paiements validés). */
  dejaRegle?: number;
};

export async function genererFacturePdf(data: FactureData) {
  const { doc, autoTable, largeur } = await nouveauDocument();
  dessinerEnTete(doc, largeur, data.date);

  // --- Blocs : facture (gauche) / point de vente (droite) --------------------
  const yBlocs = HAUTEUR_EN_TETE + 8;
  const wBloc = (largeur - 2 * MARGE - 6) / 2;
  dessinerBloc(doc, {
    x: MARGE,
    y: yBlocs,
    largeur: wBloc,
    hauteur: 34,
    etiquette: "FACTURE",
    titre: data.numero,
    lignes: [`Agent de facturation : ${data.agentNom || "—"}`],
    accent: true,
  });
  dessinerBloc(doc, {
    x: MARGE + wBloc + 6,
    y: yBlocs,
    largeur: wBloc,
    hauteur: 34,
    etiquette: "POINT DE VENTE",
    titre: data.client.nom,
    lignes: [
      data.client.ville ? `Ville : ${data.client.ville}` : "",
      data.client.quartier ? `Quartier : ${data.client.quartier}` : "",
      data.client.telephone ? `Tél. : ${data.client.telephone}` : "",
    ].filter(Boolean),
  });

  // --- Détails de facturation ------------------------------------------------
  autoTable(doc, {
    ...STYLE_TABLE,
    startY: yBlocs + 42,
    head: [["Code / Référence", "Désignation", "Quantité", "Prix unitaire", "Prix total"]],
    body: data.lignes.map((l) => [
      l.reference,
      l.designation,
      l.quantiteTexte,
      l.prixUnitaire === null ? "—" : formatMontant(l.prixUnitaire),
      l.total === null ? "—" : formatMontant(l.total),
    ]),
    columnStyles: {
      0: { cellWidth: 28, fontStyle: "bold" },
      2: { halign: "center", cellWidth: 24 },
      3: { halign: "right", cellWidth: 28 },
      4: { halign: "right", cellWidth: 30, fontStyle: "bold" },
    },
  });

  // --- Totaux ------------------------------------------------------------------
  let y = (doc as any).lastAutoTable.finalY + 8;
  y = assurerPlace(doc, y, 70);
  const wTotal = 84;
  const xTotal = largeur - MARGE - wTotal;

  doc.setDrawColor(...C.grisBordure);
  doc.setLineWidth(0.3);
  doc.line(xTotal - 4, y - 4, largeur - MARGE, y - 4);

  const ligneTotal = (libelle: string, valeur: string, opts?: { gras?: boolean; couleur?: [number, number, number] }) => {
    doc.setFont("helvetica", opts?.gras ? "bold" : "normal");
    doc.setFontSize(opts?.gras ? 11 : 9.5);
    doc.setTextColor(...C.grisTexte);
    doc.text(libelle, xTotal, y);
    doc.setTextColor(...(opts?.couleur ?? C.encre));
    doc.text(valeur, largeur - MARGE, y, { align: "right" });
    y += 7;
  };
  ligneTotal("Montant total", formatFcfa(data.montantTotal), { gras: true });
  ligneTotal("Moyen de paiement", data.modePaiementLabel);
  const regle = data.dejaRegle ?? 0;
  if (regle > 0) {
    ligneTotal("Déjà réglé", formatFcfa(regle), { couleur: C.teal });
    const reste = Math.max(0, data.montantTotal - regle);
    if (reste > 0) ligneTotal("Reste à payer", formatFcfa(reste), { gras: true, couleur: C.alerte });
  }

  // --- Montant en lettres ------------------------------------------------------
  y += 3;
  y = assurerPlace(doc, y, 40);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9.5);
  doc.setTextColor(...C.encre);
  const phrase = `Arrêter la présente facture à la somme en Francs de : ${montantEnLettres(data.montantTotal)}.`;
  const lignesPhrase = doc.splitTextToSize(phrase, largeur - 2 * MARGE);
  doc.text(lignesPhrase, MARGE, y);
  y += lignesPhrase.length * 5 + 16;

  // --- Signatures --------------------------------------------------------------
  y = assurerPlace(doc, y, 22);
  dessinerSignatures(doc, y + 10, ["Signature ETS ICHA IMPORT", "Signature Client"]);

  dessinerPieds(doc);
  doc.save(nomFichier("facture", data.numero, data.client.nom));
}
