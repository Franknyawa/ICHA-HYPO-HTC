// Facture d'avoir (FA) et facture retour (FR) : même identité que la facture,
// avec rappel de la facture d'origine et du motif.

import { formatFcfa, formatMontant } from "./format";
import { montantEnLettres } from "./nombre-en-lettres";
import { lignesCartons } from "./documents";
import type { CorrectionJson } from "@/lib/services/corrections";
import {
  assurerPlace,
  C,
  dessinerBloc,
  dessinerEnTete,
  dessinerFiligrane,
  dessinerPieds,
  placerSignatures,
  HAUTEUR_EN_TETE,
  MARGE,
  nomFichier,
  nouveauDocument,
  STYLE_TABLE,
} from "./pdf-document";

export async function genererCorrectionPdf(data: CorrectionJson) {
  const { doc, autoTable, largeur } = await nouveauDocument();
  const date = new Date(data.date);
  dessinerEnTete(doc, largeur, date);

  const estAvoir = data.type === "AVOIR";
  const yBlocs = HAUTEUR_EN_TETE + 8;
  const wBloc = (largeur - 2 * MARGE - 6) / 2;
  dessinerBloc(doc, {
    x: MARGE, y: yBlocs, largeur: wBloc, hauteur: 34,
    etiquette: estAvoir ? "FACTURE D'AVOIR" : "FACTURE RETOUR",
    titre: data.numero,
    lignes: [
      data.factureOrigine ? `Facture d'origine : ${data.factureOrigine}` : "Facture d'origine : —",
      `Motif : ${data.motif}`,
      ...(data.destination ? [`Destination : ${data.destination === "AVARIES" ? "Avaries" : "Retour en stock"}`] : []),
    ],
    accent: true,
  });
  dessinerBloc(doc, {
    x: MARGE + wBloc + 6, y: yBlocs, largeur: wBloc, hauteur: 34,
    etiquette: "POINT DE VENTE", titre: data.client.nom,
    lignes: [
      data.client.ville ? `Ville : ${data.client.ville}` : "",
      data.client.quartier ? `Quartier : ${data.client.quartier}` : "",
      data.client.telephone ? `Tél. : ${data.client.telephone}` : "",
    ].filter(Boolean),
  });

  const lignes = lignesCartons(data.sources);
  if (lignes.length > 0) {
    autoTable(doc, {
      ...STYLE_TABLE,
      startY: yBlocs + 42,
      head: [["Code / Référence", "Désignation", "Quantité (cartons)", "Prix unitaire", "Prix total"]],
      body: lignes.map((l) => [
        l.reference, l.designation, l.quantiteTexte,
        l.prixUnitaire === null ? "—" : formatMontant(l.prixUnitaire),
        l.total === null ? "—" : formatMontant(l.total),
      ]),
      columnStyles: {
        0: { cellWidth: 28, fontStyle: "bold" },
        2: { halign: "center", cellWidth: 30 },
        3: { halign: "right", cellWidth: 28 },
        4: { halign: "right", cellWidth: 30, fontStyle: "bold" },
      },
    });
  }

  let y = lignes.length > 0 ? (doc as any).lastAutoTable.finalY + 8 : yBlocs + 46;
  y = assurerPlace(doc, y, 60);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...C.grisTexte);
  doc.text(estAvoir ? "Montant crédité" : "Valeur de la marchandise retournée", MARGE, y);
  doc.setTextColor(...C.encre);
  doc.text(formatFcfa(data.montant), largeur - MARGE, y, { align: "right" });

  y += 9;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9.5);
  const phrase = `Arrêter la présente ${estAvoir ? "facture d'avoir" : "facture retour"} à la somme en Francs de : ${montantEnLettres(data.montant)}.`;
  const l = doc.splitTextToSize(phrase, largeur - 2 * MARGE);
  doc.text(l, MARGE, y);
  y += l.length * 5 + 16;

  placerSignatures(doc, y, ["Signature ETS ICHA IMPORT", `Signature ${data.client.signataire || data.client.nom}`]);

  dessinerFiligrane(doc);
  dessinerPieds(doc);
  doc.save(nomFichier(estAvoir ? "avoir" : "retour", data.numero, data.client.nom));
}
