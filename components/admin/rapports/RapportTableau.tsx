"use client";

import { Fragment, useState } from "react";
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
  lignes: { cle: string; cellules: string[]; groupe?: string; part?: number; rang?: number }[];
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
    if (i >= nbColsTexte && c.endsWith(" cartons") && suivante === `${c.slice(0, -8)} détail`) {
      cols.push({ titre: c.slice(0, -8), sous: "cartons · détail", idx: [i, i + 1] });
      i++;
    } else cols.push({ titre: c, idx: [i] });
  }
  const derniere = cols.length - 1;
  const teinte = (col: Col) =>
    col.idx.length === 2
      ? col.titre === "HYPO"
        ? "bg-blue-50/70 dark:bg-blue-950/20"
        : col.titre === "HTC"
          ? "bg-teal-50/70 dark:bg-teal-950/20"
          : "bg-slate-50 dark:bg-slate-800/40"
      : "";
  const pastille = (col: Col) =>
    col.titre === "HYPO" ? "bg-blue-100 text-blue-800" : col.titre === "HTC" ? "bg-teal-100 text-teal-800" : "bg-slate-100 text-slate-700";
  const rendre = (cells: string[], col: Col) =>
    col.idx.length === 2 ? (
      <>
        <span className="block text-sm font-bold text-slate-800 dark:text-slate-100">{cells[col.idx[0]]}</span>
        <span className="block text-[11px] text-slate-500 dark:text-slate-400">{cells[col.idx[1]] === "—" ? "pas de détail" : `+ ${cells[col.idx[1]]}`}</span>
      </>
    ) : (
      cells[col.idx[0]]
    );
  const medaille = (rang: number) =>
    rang === 1 ? "bg-amber-400 text-white" : rang === 2 ? "bg-slate-400 text-white" : rang === 3 ? "bg-orange-400 text-white" : "bg-slate-100 text-slate-500 dark:bg-slate-800";
  const avecRang = vue === "commercial";

  return (
    <>
      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-slate-500 dark:text-slate-400">
              {cols.map((c, i) => (
                <th
                  key={c.titre + i}
                  className={`px-2.5 py-3 align-bottom text-xs font-medium leading-tight ${i < nbColsTexte ? "text-left" : "text-right"} ${teinte(c)}`}
                >
                  {c.sous ? (
                    <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${pastille(c)}`}>{c.titre}</span>
                  ) : (
                    c.titre
                  )}
                  {c.sous && <span className="mt-1 block text-[10px] font-normal text-slate-400">{c.sous}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lignes.map((l, idx) => (
              <Fragment key={l.cle}>
              {l.groupe && l.groupe !== lignes[idx - 1]?.groupe && (
                <tr className="bg-slate-50 dark:bg-slate-800/50">
                  <td colSpan={cols.length} className="px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {l.groupe}
                  </td>
                </tr>
              )}
              <tr
                tabIndex={0}
                role="button"
                onClick={() => setOuvert(l.cle)}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setOuvert(l.cle)}
                className="cursor-pointer border-t border-slate-100 outline-none transition-colors hover:bg-amber-50/60 focus-visible:bg-amber-50/60 dark:border-slate-800 dark:hover:bg-slate-800/60"
              >
                {cols.map((col, j) => (
                  <td
                    key={j}
                    className={`px-2.5 py-2.5 ${teinte(col)} ${j < nbColsTexte ? "min-w-[120px] text-left" : "whitespace-nowrap text-right tabular-nums"} ${
                      j === 0
                        ? "font-medium text-slate-800 dark:text-slate-100"
                        : j === derniere
                          ? "font-semibold text-slate-800 dark:text-slate-100"
                          : "text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    {j === 0 && avecRang && l.rang ? (
                      <span className="flex items-center gap-2.5">
                        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${l.groupe?.startsWith("Commandes") ? "bg-violet-100 text-violet-700" : medaille(l.rang)}`}>
                          {l.rang}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate">{l.cellules[0]}</span>
                          <span className="mt-1 block h-1.5 w-28 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                            <span
                              className={`block h-full rounded-full ${l.groupe?.startsWith("Commandes") ? "bg-violet-400" : "bg-[#359980]"}`}
                              style={{ width: `${Math.max(4, Math.round((l.part ?? 0) * 100))}%` }}
                            />
                          </span>
                        </span>
                      </span>
                    ) : (
                      rendre(l.cellules, col)
                    )}
                  </td>
                ))}
              </tr>
              </Fragment>
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
