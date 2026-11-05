import { jsPDF } from "jspdf";
import { requireModule } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";
import { chargerExport } from "@/lib/services/export-donnees";
import { journaliser } from "@/lib/services/journal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// jsPDF (polices standard) ne gère pas certains caractères : on les remplace.
const t = (v: unknown) => String(v ?? "").replace(/[  ]/g, " ").replace(/—/g, "-").replace(/[’‘]/g, "'");

async function generer() {
  const session = await requireModule("sauvegarde");
  const { feuilles, resume } = await chargerExport();
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const jour = new Date().toLocaleDateString("fr-FR", { timeZone: "Africa/Douala" });

  doc.setFillColor(15, 118, 110);
  doc.rect(0, 0, 297, 60, "F");
  doc.setTextColor(255);
  doc.setFontSize(28);
  doc.text("ICHA IMPORT", 20, 30);
  doc.setFontSize(14);
  doc.text(t(`Sauvegarde complete - ${jour}`), 20, 42);
  doc.setTextColor(30);
  autoTable(doc, {
    startY: 75,
    head: [["Indicateur", "Valeur"]],
    body: resume.map(([k, v]) => [t(k), typeof v === "number" ? v.toLocaleString("fr-FR") : t(v)]),
    theme: "striped",
    headStyles: { fillColor: [15, 118, 110] },
    columnStyles: { 1: { halign: "right" } },
    tableWidth: 160,
    margin: { left: 20 },
  });

  for (const f of feuilles) {
    doc.addPage();
    doc.setFontSize(15);
    doc.setTextColor(15, 118, 110);
    doc.text(t(f.titre), 14, 16);
    doc.setTextColor(30);
    autoTable(doc, {
      startY: 22,
      head: [f.colonnes.map(t)],
      body: f.lignes.length
        ? f.lignes.map((l) => l.map((v, i) => (typeof v === "number" && f.nombres.includes(i) ? v.toLocaleString("fr-FR").replace(/[  ]/g, " ") : t(v))))
        : [[{ content: "Aucune donnee", colSpan: f.colonnes.length, styles: { halign: "center" } }]],
      styles: { fontSize: 7, cellPadding: 1.4 },
      headStyles: { fillColor: [15, 118, 110] },
      alternateRowStyles: { fillColor: [244, 247, 247] },
      columnStyles: Object.fromEntries(f.nombres.map((i) => [i, { halign: "right" as const }])),
      margin: { left: 10, right: 10 },
    });
  }

  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(t(`ICHA IMPORT - sauvegarde du ${jour}`), 10, 204);
    doc.text(`Page ${i} / ${total}`, 287, 204, { align: "right" });
  }

  await journaliser({
    userId: session.userId, userNom: `${session.prenom} ${session.nom}`, role: session.role,
    action: "EXPORT_PDF", libelle: "Sauvegarde PDF téléchargée", entiteType: "EXPORT", methode: "GET", chemin: "/api/sauvegarde/pdf",
  });
  const buf = Buffer.from(doc.output("arraybuffer"));
  return new Response(buf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="ICHA-sauvegarde-${new Date().toISOString().slice(0, 10)}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function GET() {
  try {
    return await generer();
  } catch (error) {
    return handleApiError(error);
  }
}
