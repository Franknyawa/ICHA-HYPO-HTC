// Générateur de facture PDF partagé — utilisé par le formulaire terrain,
// la visite de réassort et la liste admin des factures, pour garantir un
// rendu identique et éviter de dupliquer la mise en page trois fois.

export type FactureLigne = {
  produitCode: string;
  nbSachets: number;
  nbFilets: number;
  nbCartons: number;
};

export type FactureData = {
  numero: string;
  date: Date;
  pointVenteNom: string;
  villeNom?: string | null;
  commercialNom: string;
  lignes: FactureLigne[];
  montantTotal: number;
  modePaiementLabel?: string;
  montantRecu?: number;
  resteAPayer?: number;
};

const COULEUR_BRAND: [number, number, number] = [30, 64, 175]; // #1e40af
const COULEUR_BRAND_CLAIR: [number, number, number] = [37, 99, 235]; // #2563eb
const COULEUR_TEAL: [number, number, number] = [15, 118, 110]; // #0f766e
const COULEUR_ALERTE: [number, number, number] = [185, 28, 28]; // #b91c1c
const COULEUR_GRIS_CLAIR: [number, number, number] = [248, 250, 252]; // slate-50
const COULEUR_GRIS_TEXTE: [number, number, number] = [71, 85, 105]; // slate-600
const COULEUR_ENCRE: [number, number, number] = [15, 23, 42]; // slate-900

export async function genererFacturePdf(data: FactureData) {
  const { default: jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF();
  const largeur = doc.internal.pageSize.getWidth();

  // --- En-tête coloré ------------------------------------------------
  doc.setFillColor(...COULEUR_BRAND);
  doc.rect(0, 0, largeur, 38, "F");
  // Bande d'accent plus claire en bas de l'en-tête, effet dégradé simple
  doc.setFillColor(...COULEUR_BRAND_CLAIR);
  doc.rect(0, 34, largeur, 4, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("HYPO / HTC", 14, 17);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("ICHA IMPORT — Distribution locale", 14, 24);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("FACTURE", largeur - 14, 16, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`N° ${data.numero}`, largeur - 14, 22, { align: "right" });
  doc.text(data.date.toLocaleDateString("fr-FR"), largeur - 14, 27, { align: "right" });

  // --- Bloc infos (point de vente / vendu par) ------------------------
  const yInfos = 48;
  const largeurColonne = (largeur - 28 - 6) / 2;

  doc.setFillColor(...COULEUR_GRIS_CLAIR);
  doc.roundedRect(14, yInfos, largeurColonne, 24, 2, 2, "F");
  doc.roundedRect(14 + largeurColonne + 6, yInfos, largeurColonne, 24, 2, 2, "F");

  doc.setTextColor(...COULEUR_GRIS_TEXTE);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.text("POINT DE VENTE", 18, yInfos + 7);
  doc.text("VENDU PAR", 14 + largeurColonne + 10, yInfos + 7);

  doc.setTextColor(...COULEUR_ENCRE);
  doc.setFontSize(11);
  doc.text(data.pointVenteNom, 18, yInfos + 14);
  doc.text(data.commercialNom, 14 + largeurColonne + 10, yInfos + 14);

  doc.setTextColor(...COULEUR_GRIS_TEXTE);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  if (data.villeNom) doc.text(data.villeNom, 18, yInfos + 20);
  doc.text(`Le ${data.date.toLocaleDateString("fr-FR")} à ${data.date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`, 14 + largeurColonne + 10, yInfos + 20);

  // --- Tableau produits ------------------------------------------------
  autoTable(doc, {
    startY: yInfos + 32,
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
    styles: { fontSize: 9.5, textColor: COULEUR_ENCRE, cellPadding: 3 },
    columnStyles: {
      1: { halign: "center" },
      2: { halign: "center" },
      3: { halign: "center" },
    },
    margin: { left: 14, right: 14 },
  });

  // --- Bloc totaux, aligné à droite ------------------------------------
  const finTableau = (doc as any).lastAutoTable.finalY + 8;
  const largeurBoiteTotal = 70;
  const xBoiteTotal = largeur - 14 - largeurBoiteTotal;

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);

  let y = finTableau;
  doc.setFontSize(9.5);
  doc.setTextColor(...COULEUR_GRIS_TEXTE);
  doc.setFont("helvetica", "normal");
  doc.text("Montant total", xBoiteTotal, y);
  doc.setTextColor(...COULEUR_ENCRE);
  doc.setFont("helvetica", "bold");
  doc.text(`${data.montantTotal.toLocaleString("fr-FR")} FCFA`, largeur - 14, y, { align: "right" });

  if (data.modePaiementLabel) {
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COULEUR_GRIS_TEXTE);
    doc.text("Mode de paiement", xBoiteTotal, y);
    doc.setTextColor(...COULEUR_ENCRE);
    doc.text(data.modePaiementLabel, largeur - 14, y, { align: "right" });
  }

  if (data.montantRecu != null) {
    y += 6;
    doc.setTextColor(...COULEUR_GRIS_TEXTE);
    doc.text("Montant reçu", xBoiteTotal, y);
    doc.setTextColor(...COULEUR_TEAL);
    doc.setFont("helvetica", "bold");
    doc.text(`${data.montantRecu.toLocaleString("fr-FR")} FCFA`, largeur - 14, y, { align: "right" });
  }

  if (data.resteAPayer != null && data.resteAPayer > 0) {
    y += 8;
    doc.setFillColor(254, 242, 242); // red-50
    doc.roundedRect(xBoiteTotal - 4, y - 5, largeurBoiteTotal + 4, 9, 1.5, 1.5, "F");
    doc.setTextColor(...COULEUR_ALERTE);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Reste à payer", xBoiteTotal, y);
    doc.text(`${data.resteAPayer.toLocaleString("fr-FR")} FCFA`, largeur - 14, y, { align: "right" });
  }

  // --- Pied de page ------------------------------------------------------
  const hauteurPage = doc.internal.pageSize.getHeight();
  doc.setDrawColor(226, 232, 240);
  doc.line(14, hauteurPage - 20, largeur - 14, hauteurPage - 20);
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.setFont("helvetica", "italic");
  doc.text("Merci pour votre confiance — HYPO / HTC ICHA IMPORT", largeur / 2, hauteurPage - 13, {
    align: "center",
  });

  doc.save(
    `facture-${data.pointVenteNom.replace(/\s+/g, "-").toLowerCase()}-${data.numero}.pdf`
  );
}
