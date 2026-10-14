import type { jsPDF } from "jspdf";
import { LOGO_PNG_DATA_URL, LOGO_RATIO } from "@/lib/brand-logo-data";

/**
 * Place le logo ICHA IMPORT d'origine (PNG léger, voir lib/brand-logo-data.ts)
 * sur une pastille blanche dans l'en-tête d'un PDF. Retourne l'abscisse à
 * partir de laquelle écrire le nom de l'entreprise.
 */
export function dessinerEcuMarque(doc: jsPDF, x: number, hauteurEnTete: number): number {
  const h = 26;
  const logoH = h - 5;
  const logoW = logoH * LOGO_RATIO;
  const w = logoW + 5;
  const y = (hauteurEnTete - h) / 2 - 1;

  doc.setFillColor(255, 255, 255);
  doc.roundedRect(x, y, w, h, 3, 3, "F");
  doc.addImage(LOGO_PNG_DATA_URL, "PNG", x + 2.5, y + 2.5, logoW, logoH);

  return x + w + 6;
}
