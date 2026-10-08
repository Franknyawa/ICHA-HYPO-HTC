// Générateur de bon de livraison PDF — même identité visuelle que la
// facture (lib/utils/facture-pdf.ts), mais sans aucun montant : un bon de
// livraison atteste ce qui est livré, pas ce qui est payé.

import { dessinerEcuMarque } from "@/lib/utils/pdf-marque";

export type BonLivraisonLigne = {
  produitCode: string;
  nbSachets: number;
  nbFilets: number;
  nbCartons: number;
};

export type BonLivraisonData = {
  numeroCommande: string;
  dateCommande: Date;
  dateLivraison: Date;
  destinataireNom: string;
  vendeurNom?: string | null;
  villeNom?: string | null;
  quartierNom?: string | null;
  commercialNom: string;
  lignes: BonLivraisonLigne[];
};

const COULEUR_BRAND: [number, number, number] = [10, 22, 48]; // nuit #0a1630
const COULEUR_BRAND_CLAIR: [number, number, number] = [201, 162, 75]; // or #c9a24b
const COULEUR_TEAL: [number, number, number] = [15, 118, 110]; // #0f766e
const COULEUR_GRIS_CLAIR: [number, number, number] = [248, 250, 252]; // slate-50
const COULEUR_GRIS_BORDURE: [number, number, number] = [226, 232, 240]; // slate-200
const COULEUR_GRIS_TEXTE: [number, number, number] = [71, 85, 105]; // slate-600
const COULEUR_GRIS_LEGER: [number, number, number] = [148, 163, 184]; // slate-400
const COULEUR_ENCRE: [number, number, number] = [15, 23, 42]; // slate-900

export async function genererBonLivraisonPdf(data: BonLivraisonData) {
  const { default: jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF();
  const largeur = doc.internal.pageSize.getWidth();

  // --- En-tête coloré ------------------------------------------------
  const hauteurEnTete = 42;
  doc.setFillColor(...COULEUR_BRAND);
  doc.rect(0, 0, largeur, hauteurEnTete, "F");
  doc.setFillColor(...COULEUR_BRAND_CLAIR);
  doc.rect(0, hauteurEnTete - 3, largeur, 3, "F");

  const xTexteMarque = dessinerEcuMarque(doc, 14, hauteurEnTete);

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("SIRI IMPORT", xTexteMarque, hauteurEnTete / 2 - 2);
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.text("Distribution alimentaire, hygiène et entretien", xTexteMarque, hauteurEnTete / 2 + 5);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15.5);
  doc.text("BON DE LIVRAISON", largeur - 14, 16, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`N° commande ${data.numeroCommande}`, largeur - 14, 23, { align: "right" });
  doc.text(`Livré le ${data.dateLivraison.toLocaleDateString("fr-FR")}`, largeur - 14, 29, {
    align: "right",
  });

  // --- Bloc infos (livré à / livré par) ------------------------
  const yInfos = hauteurEnTete + 10;
  const largeurColonne = (largeur - 28 - 6) / 2;
  const hauteurInfos = 26;

  doc.setDrawColor(...COULEUR_GRIS_BORDURE);
  doc.setLineWidth(0.3);
  doc.setFillColor(...COULEUR_GRIS_CLAIR);
  doc.roundedRect(14, yInfos, largeurColonne, hauteurInfos, 2, 2, "FD");
  doc.setFillColor(240, 253, 250); // teal-50
  doc.setDrawColor(...COULEUR_TEAL);
  doc.roundedRect(14 + largeurColonne + 6, yInfos, largeurColonne, hauteurInfos, 2, 2, "FD");

  doc.setTextColor(...COULEUR_GRIS_TEXTE);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.text("LIVRÉ À", 18, yInfos + 7);
  doc.setTextColor(...COULEUR_TEAL);
  doc.text("LIVRÉ PAR", 14 + largeurColonne + 10, yInfos + 7);

  doc.setTextColor(...COULEUR_ENCRE);
  doc.setFontSize(11.5);
  doc.setFont("helvetica", "bold");
  doc.text(data.destinataireNom, 18, yInfos + 15);
  doc.setTextColor(...COULEUR_TEAL);
  doc.text(data.commercialNom, 14 + largeurColonne + 10, yInfos + 15);

  doc.setTextColor(...COULEUR_GRIS_TEXTE);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const lieu = [data.quartierNom, data.villeNom].filter(Boolean).join(", ");
  if (lieu) doc.text(lieu, 18, yInfos + 21);
  doc.text("Commercial terrain", 14 + largeurColonne + 10, yInfos + 21);

  // --- Tableau produits livrés ------------------------------------------------
  autoTable(doc, {
    startY: yInfos + hauteurInfos + 8,
    head: [["Produit", "Sachets", "Filets", "Cartons"]],
    body: data.lignes.map((l) => [
      l.produitCode,
      l.nbSachets > 0 ? String(l.nbSachets) : "—",
      l.nbFilets > 0 ? String(l.nbFilets) : "—",
      l.nbCartons > 0 ? String(l.nbCartons) : "—",
    ]),
    theme: "striped",
    headStyles: { fillColor: COULEUR_BRAND, textColor: 255, fontStyle: "bold", fontSize: 9 },
    alternateRowStyles: { fillColor: COULEUR_GRIS_CLAIR },
    styles: { fontSize: 9.5, textColor: COULEUR_ENCRE, cellPadding: 3.2, lineColor: COULEUR_GRIS_BORDURE, lineWidth: 0.15 },
    columnStyles: {
      1: { halign: "center" },
      2: { halign: "center" },
      3: { halign: "center" },
    },
    margin: { left: 14, right: 14 },
  });

  const finTableau = (doc as any).lastAutoTable.finalY;

  // --- Mention de contrôle réception (pas de montant — juste une case à cocher) ---
  let y = finTableau + 10;
  doc.setDrawColor(...COULEUR_GRIS_BORDURE);
  doc.setLineWidth(0.3);
  doc.rect(14, y - 4.5, 4, 4);
  doc.setFontSize(9);
  doc.setTextColor(...COULEUR_GRIS_TEXTE);
  doc.setFont("helvetica", "normal");
  doc.text("Marchandise reçue conforme à la commande ci-dessus.", 21, y);

  // --- Zone signatures ----------------------------------------------------
  const ySign = y + 26;
  const largeurSign = (largeur - 28 - 10) / 2;
  doc.setDrawColor(...COULEUR_GRIS_BORDURE);
  doc.setLineWidth(0.3);
  doc.line(14, ySign, 14 + largeurSign, ySign);
  doc.line(14 + largeurSign + 10, ySign, largeur - 14, ySign);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COULEUR_GRIS_LEGER);
  doc.text(`Signature — ${data.commercialNom} (livreur)`, 14, ySign + 5);
  doc.text("Signature et cachet du client (réception)", 14 + largeurSign + 10, ySign + 5);

  // --- Pied de page ------------------------------------------------------
  const hauteurPage = doc.internal.pageSize.getHeight();
  doc.setDrawColor(...COULEUR_GRIS_BORDURE);
  doc.line(14, hauteurPage - 22, largeur - 14, hauteurPage - 22);
  doc.setFontSize(7.5);
  doc.setTextColor(...COULEUR_GRIS_LEGER);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Bon de livraison généré par ${data.commercialNom} — le ${new Date().toLocaleDateString("fr-FR")} à ${new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`,
    largeur / 2,
    hauteurPage - 16,
    { align: "center" }
  );
  doc.setFont("helvetica", "italic");
  doc.text("Document de livraison — sans valeur fiscale — SIRI IMPORT", largeur / 2, hauteurPage - 11, {
    align: "center",
  });

  doc.save(
    `bon-livraison-${data.destinataireNom.replace(/\s+/g, "-").toLowerCase()}-${data.numeroCommande}.pdf`
  );
}
