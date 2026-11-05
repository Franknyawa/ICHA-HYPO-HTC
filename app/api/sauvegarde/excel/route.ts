import ExcelJS from "exceljs";
import { requireModule } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";
import { chargerExport } from "@/lib/services/export-donnees";
import { journaliser } from "@/lib/services/journal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function generer() {
  const session = await requireModule("sauvegarde");
  const { feuilles, resume } = await chargerExport();

  const wb = new ExcelJS.Workbook();
  wb.creator = "ICHA IMPORT";
  wb.created = new Date();
  const entete = (ws: ExcelJS.Worksheet) => {
    const r = ws.getRow(1);
    r.font = { bold: true, color: { argb: "FFFFFFFF" } };
    r.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F766E" } };
    r.alignment = { vertical: "middle" };
    r.height = 22;
    ws.views = [{ state: "frozen", ySplit: 1 }];
  };

  const r = wb.addWorksheet("Résumé");
  r.columns = [{ header: "Indicateur", width: 40 }, { header: "Valeur", width: 24 }];
  resume.forEach(([k, v]) => r.addRow([k, v]));
  entete(r);
  r.getColumn(2).alignment = { horizontal: "right" };
  r.getColumn(2).numFmt = "#,##0";

  for (const f of feuilles) {
    const ws = wb.addWorksheet(f.nom.slice(0, 31));
    ws.columns = f.colonnes.map((h, i) => ({
      header: h,
      width: Math.min(40, Math.max(12, h.length + 4, ...f.lignes.slice(0, 200).map((l) => String(l[i] ?? "").length + 2))),
      style: f.nombres.includes(i) ? { numFmt: "#,##0" } : {},
    }));
    f.lignes.forEach((l) => ws.addRow(l));
    entete(ws);
    if (f.lignes.length) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: f.colonnes.length } };
  }

  const buf = await wb.xlsx.writeBuffer();
  await journaliser({
    userId: session.userId, userNom: `${session.prenom} ${session.nom}`, role: session.role,
    action: "EXPORT_EXCEL", libelle: "Sauvegarde Excel téléchargée", entiteType: "EXPORT", methode: "GET", chemin: "/api/sauvegarde/excel",
  });
  const jour = new Date().toISOString().slice(0, 10);
  return new Response(buf as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="ICHA-sauvegarde-${jour}.xlsx"`,
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
