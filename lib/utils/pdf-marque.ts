import type { jsPDF } from "jspdf";

/**
 * Dessine l'emblème ICHA IMPORT (tuile blanche, bouteille rouge-orangé et
 * avion vert) en vectoriel dans l'en-tête d'un PDF — aucune image à charger.
 * Retourne l'abscisse à partir de laquelle écrire le nom de l'entreprise.
 */
export function dessinerEcuMarque(doc: jsPDF, x: number, hauteurEnTete: number): number {
  const t = 22; // côté de la tuile
  const y = (hauteurEnTete - t) / 2 - 1;

  doc.setFillColor(255, 255, 255);
  doc.roundedRect(x, y, t, t, 4, 4, "F");

  // Bouteille (rouge-orangé #ff3408)
  doc.setFillColor(255, 52, 8);
  const bx = x + 5.2;
  doc.roundedRect(bx + 1.6, y + 3.2, 2.6, 1.6, 0.4, 0.4, "F"); // bouchon
  doc.rect(bx + 1.7, y + 5, 2.4, 4.2, "F"); // goulot
  doc.roundedRect(bx - 0.6, y + 8.4, 6.4, 10.4, 1.6, 1.6, "F"); // corps

  // Avion (vert #359980)
  doc.setFillColor(53, 153, 128);
  const ax = x + 11.6;
  const ay = y + 6.4;
  doc.triangle(ax, ay + 4.6, ax + 8.4, ay + 1.2, ax + 6.2, ay + 5.2, "F"); // fuselage
  doc.triangle(ax + 3, ay + 3.4, ax + 4.4, ay + 7.6, ax + 6.2, ay + 4.6, "F"); // aile

  return x + t + 6;
}
