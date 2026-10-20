// Briques communes aux documents PDF (bon de commande, facture, bon de
// livraison, listes imprimées) : en-tête de marque, pied de page légal,
// couleurs et mise en page de pagination.

import type { jsPDF } from "jspdf";
import { dessinerEcuMarque } from "@/lib/utils/pdf-marque";
import { ENTREPRISE } from "@/lib/utils/documents";

export type RVB = [number, number, number];

export const C = {
  brand: [30, 58, 138] as RVB, // bleu #1e3a8a
  vert: [53, 153, 128] as RVB, // #359980
  teal: [15, 118, 110] as RVB,
  alerte: [185, 28, 28] as RVB,
  grisClair: [248, 250, 252] as RVB,
  grisBordure: [226, 232, 240] as RVB,
  grisTexte: [71, 85, 105] as RVB,
  grisLeger: [148, 163, 184] as RVB,
  encre: [15, 23, 42] as RVB,
};

export const MARGE = 14;
export const HAUTEUR_EN_TETE = 42;
const HAUTEUR_PIED = 24;

export async function nouveauDocument() {
  const { default: JsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new JsPDF();
  return {
    doc,
    autoTable,
    largeur: doc.internal.pageSize.getWidth(),
    hauteur: doc.internal.pageSize.getHeight(),
  };
}

export function formaterDateHeure(d: Date) {
  return {
    date: d.toLocaleDateString("fr-FR"),
    heure: d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
  };
}

/** Bandeau de marque : logo, nom, activités de l'entreprise, date et heure. */
export function dessinerEnTete(doc: jsPDF, largeur: number, dateHeure: Date) {
  doc.setFillColor(...C.brand);
  doc.rect(0, 0, largeur, HAUTEUR_EN_TETE, "F");
  doc.setFillColor(...C.vert);
  doc.rect(0, HAUTEUR_EN_TETE - 3, largeur, 3, "F");

  const xTexte = dessinerEcuMarque(doc, MARGE, HAUTEUR_EN_TETE);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(ENTREPRISE.nom, xTexte, HAUTEUR_EN_TETE / 2 - 3);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  const maxLargeur = largeur - xTexte - 60;
  const lignes = doc.splitTextToSize(ENTREPRISE.activites, Math.max(maxLargeur, 50));
  doc.text(lignes, xTexte, HAUTEUR_EN_TETE / 2 + 4);

  const { date, heure } = formaterDateHeure(dateHeure);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(200, 215, 240);
  doc.text("Date et Heure", largeur - MARGE, 12, { align: "right" });
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(date, largeur - MARGE, 18, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`à ${heure}`, largeur - MARGE, 24, { align: "right" });
}

/** Pied de page légal, répété sur chaque page du document. */
export function dessinerPieds(doc: jsPDF) {
  const largeur = doc.internal.pageSize.getWidth();
  const hauteur = doc.internal.pageSize.getHeight();
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setDrawColor(...C.grisBordure);
    doc.setLineWidth(0.3);
    doc.line(MARGE, hauteur - HAUTEUR_PIED, largeur - MARGE, hauteur - HAUTEUR_PIED);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...C.grisTexte);
    const lignes = doc.splitTextToSize(ENTREPRISE.pied, largeur - 2 * MARGE);
    doc.text(lignes, largeur / 2, hauteur - HAUTEUR_PIED + 5, { align: "center" });
    if (n > 1) {
      doc.setTextColor(...C.grisLeger);
      doc.text(`Page ${i} / ${n}`, largeur - MARGE, hauteur - 4, { align: "right" });
    }
  }
}

/** Ajoute une page si `besoin` mm ne tiennent plus au-dessus du pied de page. */
export function assurerPlace(doc: jsPDF, y: number, besoin: number): number {
  const hauteur = doc.internal.pageSize.getHeight();
  if (y + besoin > hauteur - HAUTEUR_PIED - 4) {
    doc.addPage();
    return MARGE + 4;
  }
  return y;
}

/** Cadre d'information (titre en petites capitales + lignes de texte). */
export function dessinerBloc(
  doc: jsPDF,
  opts: {
    x: number;
    y: number;
    largeur: number;
    hauteur: number;
    etiquette: string;
    titre: string;
    lignes: string[];
    accent?: boolean;
  }
) {
  const { x, y, largeur, hauteur, etiquette, titre, lignes, accent } = opts;
  doc.setLineWidth(0.3);
  if (accent) {
    doc.setFillColor(239, 246, 255);
    doc.setDrawColor(...C.vert);
  } else {
    doc.setFillColor(...C.grisClair);
    doc.setDrawColor(...C.grisBordure);
  }
  doc.roundedRect(x, y, largeur, hauteur, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...(accent ? C.brand : C.grisTexte));
  doc.text(etiquette, x + 4, y + 6.5);

  doc.setFontSize(11.5);
  doc.setTextColor(...C.encre);
  const titreCoupe = doc.splitTextToSize(titre, largeur - 8)[0] ?? titre;
  doc.text(titreCoupe, x + 4, y + 13.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...C.grisTexte);
  lignes.slice(0, 4).forEach((l, i) => {
    const t = doc.splitTextToSize(l, largeur - 8)[0] ?? l;
    doc.text(t, x + 4, y + 19.5 + i * 5);
  });
}

/** Ligne de signature avec légende. */
export function dessinerSignatures(doc: jsPDF, y: number, libelles: string[]) {
  const largeur = doc.internal.pageSize.getWidth();
  const n = libelles.length;
  const espace = 8;
  const w = (largeur - 2 * MARGE - espace * (n - 1)) / n;
  doc.setDrawColor(...C.grisLeger);
  doc.setLineWidth(0.3);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...C.grisTexte);
  libelles.forEach((l, i) => {
    const x = MARGE + i * (w + espace);
    doc.line(x, y, x + w, y);
    const t = doc.splitTextToSize(l, w);
    doc.text(t, x + w / 2, y + 5, { align: "center" });
  });
}

export const STYLE_TABLE = {
  theme: "striped" as const,
  headStyles: { fillColor: C.brand, textColor: 255 as unknown as RVB, fontStyle: "bold" as const, fontSize: 9 },
  alternateRowStyles: { fillColor: C.grisClair },
  styles: {
    fontSize: 9.5,
    textColor: C.encre,
    cellPadding: 3.2,
    lineColor: C.grisBordure,
    lineWidth: 0.15,
    valign: "middle" as const,
  },
  margin: { left: MARGE, right: MARGE, bottom: HAUTEUR_PIED + 6 },
};

/** Nom de fichier sûr (sans accents, espaces ni caractères spéciaux). */
export function nomFichier(...parties: string[]) {
  return (
    parties
      .join("-")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() + ".pdf"
  );
}
