"use client";

import { FileSpreadsheet } from "lucide-react";

// Export Excel : CSV séparé par des points-virgules avec BOM UTF-8, la
// combinaison qu'Excel (version française) ouvre correctement, accents et
// colonnes compris. Les montants sont exportés en nombres bruts (pas « 613 120
// FCFA ») pour pouvoir être additionnés dans Excel.
export function ExportCsvButton({
  colonnes,
  lignes,
  total,
  nomFichier,
}: {
  colonnes: string[];
  lignes: (string | number)[][];
  total?: (string | number)[];
  nomFichier: string;
}) {
  function cellule(v: string | number) {
    if (typeof v === "number") return String(v).replace(".", ",");
    const s = v.replace(/"/g, '""');
    return /[;"\n]/.test(s) ? `"${s}"` : s;
  }

  function exporter() {
    const rows = [colonnes, ...lignes, ...(total ? [total] : [])];
    const csv = "﻿" + rows.map((r) => r.map(cellule).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${nomFichier}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      onClick={exporter}
      className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
    >
      <FileSpreadsheet size={15} />
      Excel (CSV)
    </button>
  );
}
