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
const COULEUR_GRIS_BORDURE: [number, number, number] = [226, 232, 240]; // slate-200
const COULEUR_GRIS_TEXTE: [number, number, number] = [71, 85, 105]; // slate-600
const COULEUR_GRIS_LEGER: [number, number, number] = [148, 163, 184]; // slate-400
const COULEUR_ENCRE: [number, number, number] = [15, 23, 42]; // slate-900

// Formatage FCFA avec un espace normal comme séparateur de milliers.
// (toLocaleString("fr-FR") insère un espace insécable étroit — U+202F —
// que la police Helvetica embarquée dans jsPDF ne sait pas dessiner,
// ce qui produit un artefact du type "45 /500 FCFA" au lieu de "45 500 FCFA".)
function formatFcfa(montant: number): string {
  const entier = Math.round(montant);
  const avecEspaces = entier.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${avecEspaces} FCFA`;
}

// Le logo est chargé une seule fois (même origine, donc pas de souci CORS)
// et mis en cache pour les générations suivantes dans la même session.
let logoBase64Promise: Promise<string | null> | null = null;

function chargerLogo(): Promise<string | null> {
  if (!logoBase64Promise) {
    logoBase64Promise = fetch("/brand/logo-hypo.png")
      .then((res) => (res.ok ? res.blob() : null))
      .then(
        (blob) =>
          new Promise<string | null>((resolve) => {
            if (!blob) return resolve(null);
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
          })
      )
      .catch(() => null);
  }
  return logoBase64Promise;
}

export async function genererFacturePdf(data: FactureData) {
  const { default: jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const logo = await chargerLogo();

  const doc = new jsPDF();
  const largeur = doc.internal.pageSize.getWidth();

  // --- En-tête coloré ------------------------------------------------
  const hauteurEnTete = 42;
  doc.setFillColor(...COULEUR_BRAND);
  doc.rect(0, 0, largeur, hauteurEnTete, "F");
  // Bande d'accent plus claire en bas de l'en-tête, effet dégradé simple
  doc.setFillColor(...COULEUR_BRAND_CLAIR);
  doc.rect(0, hauteurEnTete - 3, largeur, 3, "F");

  // Logo dans une pastille blanche, pour rester lisible quel que soit le fond du PNG
  let xTexteMarque = 14;
  if (logo) {
    const logoW = 22;
    const logoH = 12.2; // ratio proche de l'image source (821x454)
    const pastilleW = logoW + 8;
    const pastilleH = logoH + 8;
    const yPastille = (hauteurEnTete - pastilleH) / 2 - 1;
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(14, yPastille, pastilleW, pastilleH, 2.5, 2.5, "F");
    try {
      doc.addImage(logo, "PNG", 14 + 4, yPastille + 4, logoW, logoH);
    } catch {
      // image illisible (format inattendu) : on ignore silencieusement, le texte suffit
    }
    xTexteMarque = 14 + pastilleW + 6;
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("HYPO / HTC", xTexteMarque, hauteurEnTete / 2 - 2);
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.text("ICHA IMPORT — Distribution locale", xTexteMarque, hauteurEnTete / 2 + 5);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text("FACTURE", largeur - 14, 17, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`N° ${data.numero}`, largeur - 14, 24, { align: "right" });
  doc.text(
    `${data.date.toLocaleDateString("fr-FR")} à ${data.date.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    })}`,
    largeur - 14,
    30,
    { align: "right" }
  );

  // --- Bloc infos (point de vente / vendu par) ------------------------
  const yInfos = hauteurEnTete + 10;
  const largeurColonne = (largeur - 28 - 6) / 2;
  const hauteurInfos = 26;

  doc.setDrawColor(...COULEUR_GRIS_BORDURE);
  doc.setLineWidth(0.3);
  doc.setFillColor(...COULEUR_GRIS_CLAIR);
  doc.roundedRect(14, yInfos, largeurColonne, hauteurInfos, 2, 2, "FD");
  // La colonne "Vendu par" ressort légèrement pour bien identifier le commercial
  doc.setFillColor(239, 246, 255); // blue-50
  doc.setDrawColor(...COULEUR_BRAND_CLAIR);
  doc.roundedRect(14 + largeurColonne + 6, yInfos, largeurColonne, hauteurInfos, 2, 2, "FD");

  doc.setTextColor(...COULEUR_GRIS_TEXTE);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.text("POINT DE VENTE", 18, yInfos + 7);
  doc.setTextColor(...COULEUR_BRAND);
  doc.text("VENDU PAR", 14 + largeurColonne + 10, yInfos + 7);

  doc.setTextColor(...COULEUR_ENCRE);
  doc.setFontSize(11.5);
  doc.setFont("helvetica", "bold");
  doc.text(data.pointVenteNom, 18, yInfos + 15);
  doc.setTextColor(...COULEUR_BRAND);
  doc.text(data.commercialNom, 14 + largeurColonne + 10, yInfos + 15);

  doc.setTextColor(...COULEUR_GRIS_TEXTE);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  if (data.villeNom) doc.text(data.villeNom, 18, yInfos + 21);
  doc.text("Commercial terrain", 14 + largeurColonne + 10, yInfos + 21);

  // --- Tableau produits ------------------------------------------------
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

  // --- Bloc totaux, aligné à droite ------------------------------------
  const finTableau = (doc as any).lastAutoTable.finalY + 8;
  const largeurBoiteTotal = 74;
  const xBoiteTotal = largeur - 14 - largeurBoiteTotal;

  doc.setDrawColor(...COULEUR_GRIS_BORDURE);
  doc.setLineWidth(0.3);
  doc.line(xBoiteTotal - 4, finTableau - 4, largeur - 14, finTableau - 4);

  let y = finTableau;
  doc.setFontSize(9.5);
  doc.setTextColor(...COULEUR_GRIS_TEXTE);
  doc.setFont("helvetica", "normal");
  doc.text("Montant total", xBoiteTotal, y);
  doc.setTextColor(...COULEUR_ENCRE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(formatFcfa(data.montantTotal), largeur - 14, y, { align: "right" });

  if (data.modePaiementLabel) {
    y += 7;
    doc.setFontSize(9.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COULEUR_GRIS_TEXTE);
    doc.text("Mode de paiement", xBoiteTotal, y);
    doc.setTextColor(...COULEUR_ENCRE);
    doc.text(data.modePaiementLabel, largeur - 14, y, { align: "right" });
  }

  if (data.montantRecu != null) {
    y += 7;
    doc.setTextColor(...COULEUR_GRIS_TEXTE);
    doc.text("Montant reçu", xBoiteTotal, y);
    doc.setTextColor(...COULEUR_TEAL);
    doc.setFont("helvetica", "bold");
    doc.text(formatFcfa(data.montantRecu), largeur - 14, y, { align: "right" });
  }

  if (data.resteAPayer != null && data.resteAPayer > 0) {
    y += 9;
    doc.setFillColor(254, 242, 242); // red-50
    doc.setDrawColor(...COULEUR_ALERTE);
    doc.setLineWidth(0.25);
    doc.roundedRect(xBoiteTotal - 4, y - 5.5, largeurBoiteTotal + 4, 9.5, 1.5, 1.5, "FD");
    doc.setTextColor(...COULEUR_ALERTE);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Reste à payer", xBoiteTotal, y);
    doc.text(formatFcfa(data.resteAPayer), largeur - 14, y, { align: "right" });
    y += 5;
  }

  // --- Zone signatures ----------------------------------------------------
  // Juste sous le bloc totaux (et non collée au pied de page) : le blanc
  // restant en bas est l'espace normal d'une facture courte sur une page A4.
  const ySign = y + 24;
  const largeurSign = (largeur - 28 - 10) / 2;
  doc.setDrawColor(...COULEUR_GRIS_BORDURE);
  doc.setLineWidth(0.3);
  doc.line(14, ySign, 14 + largeurSign, ySign);
  doc.line(14 + largeurSign + 10, ySign, largeur - 14, ySign);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COULEUR_GRIS_LEGER);
  doc.text("Signature du client", 14, ySign + 5);
  doc.text(`Signature — ${data.commercialNom}`, 14 + largeurSign + 10, ySign + 5);

  // --- Pied de page ------------------------------------------------------
  const hauteurPage = doc.internal.pageSize.getHeight();
  doc.setDrawColor(...COULEUR_GRIS_BORDURE);
  doc.line(14, hauteurPage - 22, largeur - 14, hauteurPage - 22);
  doc.setFontSize(7.5);
  doc.setTextColor(...COULEUR_GRIS_LEGER);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Facture générée par ${data.commercialNom} — le ${data.date.toLocaleDateString("fr-FR")} à ${data.date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`,
    largeur / 2,
    hauteurPage - 16,
    { align: "center" }
  );
  doc.setFont("helvetica", "italic");
  doc.text("Merci pour votre confiance — HYPO / HTC ICHA IMPORT", largeur / 2, hauteurPage - 11, {
    align: "center",
  });

  doc.save(
    `facture-${data.pointVenteNom.replace(/\s+/g, "-").toLowerCase()}-${data.numero}.pdf`
  );
}
