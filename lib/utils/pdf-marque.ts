import type { jsPDF } from "jspdf";

/**
 * Dessine l'écu SIRI IMPORT en vectoriel dans l'en-tête d'un PDF (aucune
 * image à charger : plus léger et net à toute taille). Retourne l'abscisse
 * à partir de laquelle écrire le nom de l'entreprise.
 */
export function dessinerEcuMarque(doc: jsPDF, x: number, hauteurEnTete: number): number {
  const w = 20;
  const h = 24;
  const y = (hauteurEnTete - h) / 2 - 1;
  const cx = x + w / 2;

  // Écu : polygone approximant la forme du logo, fond nuit, liseré or
  const pts: [number, number][] = [
    [cx, y],
    [x + w, y + 4.5],
    [x + w, y + 13],
    [x + w * 0.88, y + 18.5],
    [cx, y + h],
    [x + w * 0.12, y + 18.5],
    [x, y + 13],
    [x, y + 4.5],
  ];
  const segments = pts.slice(1).map((p, i) => [p[0] - pts[i][0], p[1] - pts[i][1]]);
  segments.push([pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]]);
  doc.setFillColor(8, 17, 36);
  doc.setDrawColor(201, 162, 75);
  doc.setLineWidth(0.7);
  doc.lines(segments, pts[0][0], pts[0][1], [1, 1], "FD", true);

  doc.setTextColor(224, 194, 107);
  doc.setFont("times", "bold");
  doc.setFontSize(19);
  doc.text("S", cx, y + 15.5, { align: "center" });

  return x + w + 6;
}
