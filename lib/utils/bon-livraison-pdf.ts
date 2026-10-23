// Bon de livraison PDF — même identité que la facture, sans aucun montant :
// il atteste ce qui est livré et ce qu'il reste à livrer.

import type { AdresseClient } from "./documents";
import {
  assurerPlace,
  C,
  dessinerBloc,
  dessinerEnTete,
  dessinerFiligrane,
  dessinerPieds,
  dessinerSignatures,
  HAUTEUR_EN_TETE,
  MARGE,
  nomFichier,
  nouveauDocument,
  STYLE_TABLE,
} from "./pdf-document";

export type BonLivraisonLigneData = {
  reference: string;
  designation: string;
  /** Texte de la quantité livrée (« 5 », « 12 sachets »). */
  livree: string;
  /** Texte du reste à livrer, « 0 » si tout est livré. */
  reste: string;
};

export type BonLivraisonData = {
  /** Déjà formaté : « BLICHA 00001 ». */
  numero: string;
  date: Date;
  agentNom?: string | null;
  client: AdresseClient;
  lignes: BonLivraisonLigneData[];
};

export async function genererBonLivraisonPdf(data: BonLivraisonData) {
  const { doc, autoTable, largeur } = await nouveauDocument();
  dessinerEnTete(doc, largeur, data.date);

  const yBlocs = HAUTEUR_EN_TETE + 8;
  const wBloc = (largeur - 2 * MARGE - 6) / 2;
  dessinerBloc(doc, {
    x: MARGE,
    y: yBlocs,
    largeur: wBloc,
    hauteur: 34,
    etiquette: "BON DE LIVRAISON",
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

  autoTable(doc, {
    ...STYLE_TABLE,
    startY: yBlocs + 42,
    head: [["Référence", "Désignation", "Quantité livrée", "Reste à livrer"]],
    body: data.lignes.map((l) => [l.reference, l.designation, l.livree, l.reste]),
    columnStyles: {
      0: { cellWidth: 28, fontStyle: "bold" },
      2: { halign: "center", cellWidth: 32 },
      3: { halign: "center", cellWidth: 32 },
    },
  });

  let y = (doc as any).lastAutoTable.finalY + 10;
  y = assurerPlace(doc, y, 50);
  doc.setDrawColor(...C.grisBordure);
  doc.setLineWidth(0.3);
  doc.rect(MARGE, y - 4, 4, 4);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...C.grisTexte);
  doc.text("Marchandise reçue conforme à la commande ci-dessus.", MARGE + 7, y - 0.8);

  y = assurerPlace(doc, y + 14, 44);
  dessinerSignatures(doc, y + 28, ["Signature Magasinier", "Signature Commercial / Transporteur", "Signature Comptable"]);

  dessinerFiligrane(doc);
  dessinerPieds(doc);
  doc.save(nomFichier("bon-livraison", data.numero, data.client.nom));
}
