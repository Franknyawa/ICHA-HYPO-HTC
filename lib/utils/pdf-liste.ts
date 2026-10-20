// Impression d'une liste (historique de stock, clients…) : un PDF aux couleurs
// de l'entreprise, ouvert dans un nouvel onglet avec la boîte d'impression.

import { C, dessinerEnTete, dessinerPieds, HAUTEUR_EN_TETE, MARGE, nouveauDocument, STYLE_TABLE } from "./pdf-document";

export async function imprimerListePdf(opts: {
  titre: string;
  sousTitre?: string;
  colonnes: string[];
  lignes: (string | number)[][];
  /** Alignement à droite des colonnes numériques (index). */
  droite?: number[];
  paysage?: boolean;
}) {
  const { default: JsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new JsPDF({ orientation: opts.paysage ? "landscape" : "portrait" });
  const largeur = doc.internal.pageSize.getWidth();

  dessinerEnTete(doc, largeur, new Date());

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...C.brand);
  doc.text(opts.titre, MARGE, HAUTEUR_EN_TETE + 11);
  if (opts.sousTitre) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...C.grisTexte);
    doc.text(doc.splitTextToSize(opts.sousTitre, largeur - 2 * MARGE), MARGE, HAUTEUR_EN_TETE + 17);
  }

  const columnStyles: Record<number, { halign: "right" }> = {};
  for (const i of opts.droite ?? []) columnStyles[i] = { halign: "right" };

  autoTable(doc, {
    ...STYLE_TABLE,
    styles: { ...STYLE_TABLE.styles, fontSize: 8.5, cellPadding: 2.4 },
    startY: HAUTEUR_EN_TETE + (opts.sousTitre ? 22 : 16),
    head: [opts.colonnes],
    body: opts.lignes.map((l) => l.map((c) => String(c))),
    columnStyles,
  });

  dessinerPieds(doc);
  doc.autoPrint();
  const url = doc.output("bloburl");
  window.open(String(url), "_blank");
}
