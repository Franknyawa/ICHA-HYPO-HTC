"use client";

import { useState } from "react";
import { ApercuRapport } from "./ApercuRapport";

/**
 * Tableau de rapport cliquable : un clic sur une ligne ouvre sa fiche détaillée
 * (imprimable seule). Les cellules arrivent déjà formatées du serveur, donc
 * identiques à celles du PDF et de l'export Excel.
 */
export function RapportTableau({
  vue,
  colonnes,
  nbColsTexte,
  lignes,
  total,
  query,
  filtreLabel,
}: {
  vue: string;
  colonnes: string[];
  nbColsTexte: number;
  lignes: { cle: string; cellules: string[] }[];
  total?: string[];
  query: string;
  filtreLabel: string;
}) {
  const [ouvert, setOuvert] = useState<string | null>(null);

  // Affichage compact : « X cartons » + « X CA » (un produit) tiennent dans une seule
  // colonne à deux lignes. Les exports PDF / Excel gardent les colonnes séparées.
  type Col = { titre: string; sous?: string; idx: number[] };
  const cols: Col[] = [];
  for (let i = 0; i < colonnes.length; i++) {
    const c = colonnes[i];
    const suivante = colonnes[i + 1];
    if (i >= nbColsTexte && c.endsWith(" cartons") && suivante === `${c.slice(0, -8)} CA`) {
      cols.push({ titre: c.slice(0, -8), sous: "cartons · CA", idx: [i, i + 1] });
      i++;
    } else cols.push({ titre: c, idx: [i] });
  }
  const derniere = cols.length - 1;
  const rendre = (cells: string[], col: Col) =>
    col.idx.length === 2 ? (
      <>
        <span className="block font-medium">{cells[col.idx[0]]}</span>
        <span className="block text-[11px] text-slate-400 dark:text-slate-500">{cells[col.idx[1]]}</span>
      </>
    ) : (
      cells[col.idx[0]]
    );

  return (
    <>
      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-slate-500 dark:text-slate-400">
              {cols.map((c, i) => (
                <th
                  key={c.titre + i}
                  className={`px-2.5 py-3 align-bottom text-xs font-medium leading-tight ${i < nbColsTexte ? "text-left" : "text-right"}`}
                >
                  {c.titre}
                  {c.sous && <span className="block text-[10px] font-normal text-slate-400">{c.sous}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lignes.map((l) => (
              <tr
                key={l.cle}
                tabIndex={0}
                role="button"
                onClick={() => setOuvert(l.cle)}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setOuvert(l.cle)}
                className="cursor-pointer border-t border-slate-100 outline-none transition-colors hover:bg-amber-50/60 focus-visible:bg-amber-50/60 dark:border-slate-800 dark:hover:bg-slate-800/60"
              >
                {cols.map((col, j) => (
                  <td
                    key={j}
                    className={`px-2.5 py-2.5 ${j < nbColsTexte ? "min-w-[120px] text-left" : "whitespace-nowrap text-right tabular-nums"} ${
                      j === 0
                        ? "font-medium text-slate-800 dark:text-slate-100"
                        : j === derniere
                          ? "font-semibold text-slate-800 dark:text-slate-100"
                          : "text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    {rendre(l.cellules, col)}
                  </td>
                ))}
              </tr>
            ))}
            {lignes.length === 0 && (
              <tr>
                <td colSpan={cols.length} className="px-4 py-10 text-center text-slate-400 dark:text-slate-500">
                  Aucune donnée pour ces filtres.
                </td>
              </tr>
            )}
          </tbody>
          {total && lignes.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-slate-200 font-semibold dark:border-slate-700">
                {cols.map((col, j) => (
                  <td
                    key={j}
                    className={`px-2.5 py-3 text-slate-900 dark:text-slate-100 ${j < nbColsTexte ? "text-left" : "whitespace-nowrap text-right tabular-nums"}`}
                  >
                    {rendre(total, col)}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {ouvert && (
        <ApercuRapport
          vue={vue}
          cle={ouvert}
          query={query}
          filtreLabel={filtreLabel}
          onClose={() => setOuvert(null)}
        />
      )}
    </>
  );
}
