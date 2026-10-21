// Fiche client PDF : identité du point de vente, synthèse Facturation (débit) /
// Caisse (crédit), détail par facture et relevé de compte avec solde cumulé.

import { formatMontant, formatFcfa } from "./format";
import {
  assurerPlace,
  C,
  dessinerBloc,
  dessinerEnTete,
  dessinerPieds,
  HAUTEUR_EN_TETE,
  MARGE,
  nomFichier,
  nouveauDocument,
  STYLE_TABLE,
} from "./pdf-document";

export type FicheClientData = {
  nom: string;
  interlocuteur: string | null;
  telephone: string | null;
  type: string;
  adresse: string;
  synthese: { facture: number; encaisse: number; avoirs: number; retours: number; reste: number };
  factures: { piece: string; date: string; produits: string; montant: number; avoirs: number; retours: number; paye: number; reste: number }[];
  ecritures: { date: string; piece: string; libelle: string; debit: number; credit: number; solde: number }[];
};

const jour = (iso: string) => new Date(iso).toLocaleDateString("fr-FR");
const montant = (n: number) => (n ? formatMontant(n) : "");

export async function genererFicheClientPdf(d: FicheClientData) {
  const { doc, autoTable, largeur } = await nouveauDocument();
  dessinerEnTete(doc, largeur, new Date());

  const yBlocs = HAUTEUR_EN_TETE + 8;
  const wBloc = (largeur - 2 * MARGE - 6) / 2;
  dessinerBloc(doc, {
    x: MARGE, y: yBlocs, largeur: wBloc, hauteur: 40,
    etiquette: "FICHE CLIENT", titre: d.nom,
    lignes: [d.type, d.adresse, d.interlocuteur ? `Contact : ${d.interlocuteur}` : "", d.telephone ? `Tél. : ${d.telephone}` : ""].filter(Boolean),
    accent: true,
  });
  dessinerBloc(doc, {
    x: MARGE + wBloc + 6, y: yBlocs, largeur: wBloc, hauteur: 40,
    etiquette: "SITUATION DU COMPTE", titre: `Reste à encaisser : ${formatFcfa(d.synthese.reste)}`,
    lignes: [
      `Facturation (débit) : ${formatFcfa(d.synthese.facture)}`,
      `Encaissé : ${formatFcfa(d.synthese.encaisse)}`,
      `Avoirs : ${formatFcfa(d.synthese.avoirs)} · Retours : ${formatFcfa(d.synthese.retours)}`,
    ],
  });

  // --- Détail par facture -------------------------------------------------
  let y = yBlocs + 48;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(...C.brand);
  doc.text("Factures", MARGE, y);
  autoTable(doc, {
    ...STYLE_TABLE,
    startY: y + 3,
    head: [["Facture", "Date", "Montant", "Avoirs", "Retours", "Encaissé", "Reste"]],
    body: d.factures.length
      ? d.factures.map((f) => [f.piece, jour(f.date), formatMontant(f.montant), f.avoirs ? `-${formatMontant(f.avoirs)}` : "-", f.retours ? `-${formatMontant(f.retours)}` : "-", formatMontant(f.paye), formatMontant(f.reste)])
      : [["Aucune facture", "", "", "", "", "", ""]],
    foot: d.factures.length
      ? [["Total", "", formatMontant(d.synthese.facture), d.synthese.avoirs ? `-${formatMontant(d.synthese.avoirs)}` : "-", d.synthese.retours ? `-${formatMontant(d.synthese.retours)}` : "-", formatMontant(d.synthese.encaisse), formatMontant(d.synthese.reste)]]
      : undefined,
    footStyles: { fillColor: C.grisClair, textColor: C.encre, fontStyle: "bold" },
    styles: { ...STYLE_TABLE.styles, fontSize: 8.5, cellPadding: 2.6 },
    columnStyles: { 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" }, 6: { halign: "right", fontStyle: "bold" } },
  });

  // --- Relevé de compte -----------------------------------------------------
  y = (doc as any).lastAutoTable.finalY + 10;
  y = assurerPlace(doc, y, 30);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(...C.brand);
  doc.text("Relevé de compte (débit / crédit)", MARGE, y);
  autoTable(doc, {
    ...STYLE_TABLE,
    startY: y + 3,
    head: [["Date", "Pièce", "Libellé", "Débit", "Crédit", "Solde"]],
    body: d.ecritures.length
      ? d.ecritures.map((e) => [jour(e.date), e.piece, e.libelle, montant(e.debit), montant(e.credit), formatMontant(e.solde)])
      : [["Aucune écriture", "", "", "", "", ""]],
    styles: { ...STYLE_TABLE.styles, fontSize: 8.2, cellPadding: 2.4 },
    columnStyles: { 0: { cellWidth: 20 }, 1: { cellWidth: 26 }, 3: { halign: "right", cellWidth: 22 }, 4: { halign: "right", cellWidth: 22 }, 5: { halign: "right", cellWidth: 24, fontStyle: "bold" } },
  });

  dessinerPieds(doc);
  doc.save(nomFichier("fiche-client", d.nom));
}
