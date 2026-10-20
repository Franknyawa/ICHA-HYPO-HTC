// Bon de commande remis au client après la prise de commande sur le terrain :
// désignation, prix unitaire, quantité, prix total, nom et adresse du client.
// Aucun numéro de facture : la facture est émise plus tard par le bureau.

import { formatFcfa, formatMontant } from "./format";
import type { AdresseClient, LigneDocument } from "./documents";
import {
  assurerPlace,
  C,
  dessinerBloc,
  dessinerEnTete,
  dessinerPieds,
  dessinerSignatures,
  HAUTEUR_EN_TETE,
  MARGE,
  nomFichier,
  nouveauDocument,
  STYLE_TABLE,
} from "./pdf-document";

export type BonCommandeData = {
  /** Référence lisible, ex. « BC-20261020-A1B2 ». */
  reference: string;
  date: Date;
  commercialNom: string;
  client: AdresseClient;
  /** Une section par commande (achat du jour, commande à livrer plus tard…). */
  sections: { titre?: string; lignes: LigneDocument[]; livraisonPrevue?: Date | null }[];
};

export function referenceBonCommande(date: Date, uuid: string) {
  const jour = date.toISOString().slice(0, 10).replace(/-/g, "");
  return `BC-${jour}-${uuid.replace(/-/g, "").slice(0, 4).toUpperCase()}`;
}

export async function genererBonCommandePdf(data: BonCommandeData) {
  const { doc, autoTable, largeur } = await nouveauDocument();
  dessinerEnTete(doc, largeur, data.date);

  const yBlocs = HAUTEUR_EN_TETE + 8;
  const wBloc = (largeur - 2 * MARGE - 6) / 2;
  dessinerBloc(doc, {
    x: MARGE,
    y: yBlocs,
    largeur: wBloc,
    hauteur: 34,
    etiquette: "BON DE COMMANDE",
    titre: data.reference,
    lignes: [`Commercial : ${data.commercialNom}`],
    accent: true,
  });
  const adresse = [data.client.quartier, data.client.repere].filter(Boolean).join(" — ");
  dessinerBloc(doc, {
    x: MARGE + wBloc + 6,
    y: yBlocs,
    largeur: wBloc,
    hauteur: 34,
    etiquette: "CLIENT",
    titre: data.client.nom,
    lignes: [
      data.client.ville ? `Ville : ${data.client.ville}` : "",
      adresse ? `Adresse : ${adresse}` : "",
      data.client.telephone ? `Tél. : ${data.client.telephone}` : "",
    ].filter(Boolean),
  });

  let y = yBlocs + 42;
  let totalGeneral = 0;
  for (const section of data.sections) {
    if (section.lignes.length === 0) continue;
    if (section.titre) {
      y = assurerPlace(doc, y, 20);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...C.brand);
      const suffixe = section.livraisonPrevue
        ? ` — livraison prévue le ${section.livraisonPrevue.toLocaleDateString("fr-FR")}`
        : "";
      doc.text(`${section.titre}${suffixe}`, MARGE, y);
      y += 3;
    }
    autoTable(doc, {
      ...STYLE_TABLE,
      startY: y,
      head: [["Désignation", "Prix unitaire", "Quantité", "Prix total"]],
      body: section.lignes.map((l) => [
        l.designation,
        l.prixUnitaire === null ? "—" : formatMontant(l.prixUnitaire),
        l.quantiteTexte,
        l.total === null ? "—" : formatMontant(l.total),
      ]),
      columnStyles: {
        1: { halign: "right", cellWidth: 30 },
        2: { halign: "center", cellWidth: 26 },
        3: { halign: "right", cellWidth: 32, fontStyle: "bold" },
      },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
    totalGeneral += section.lignes.reduce((s, l) => s + (l.total ?? 0), 0);
  }

  y = assurerPlace(doc, y, 50);
  doc.setDrawColor(...C.grisBordure);
  doc.setLineWidth(0.3);
  doc.line(largeur - MARGE - 84, y - 4, largeur - MARGE, y - 4);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...C.grisTexte);
  doc.text("Total de la commande", largeur - MARGE - 84, y + 1);
  doc.setTextColor(...C.encre);
  doc.text(formatFcfa(totalGeneral), largeur - MARGE, y + 1, { align: "right" });

  y = assurerPlace(doc, y + 18, 24);
  dessinerSignatures(doc, y + 12, [`Signature ${data.client.signataire || data.client.nom}`, `Signature ${data.commercialNom}`]);

  dessinerPieds(doc);
  doc.save(nomFichier("bon-commande", data.reference, data.client.nom));
}
