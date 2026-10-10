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
  const derniere = colonnes.length - 1;

  return (
    <>
      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate-500 dark:text-slate-400">
              {colonnes.map((c, i) => (
                <th
                  key={c + i}
                  className={`whitespace-nowrap px-4 py-3.5 font-medium ${i < nbColsTexte ? "text-left" : "text-right"}`}
                >
                  {c}
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
                {l.cellules.map((cell, j) => (
                  <td
                    key={j}
                    className={`whitespace-nowrap px-4 py-3 ${j < nbColsTexte ? "text-left" : "text-right"} ${
                      j === 0
                        ? "font-medium text-slate-800 dark:text-slate-100"
                        : j === derniere
                          ? "font-semibold text-slate-800 dark:text-slate-100"
                          : "text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
            {lignes.length === 0 && (
              <tr>
                <td colSpan={colonnes.length} className="px-4 py-10 text-center text-slate-400 dark:text-slate-500">
                  Aucune donnée pour ces filtres.
                </td>
              </tr>
            )}
          </tbody>
          {total && lignes.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-slate-200 font-semibold dark:border-slate-700">
                {total.map((c, j) => (
                  <td
                    key={j}
                    className={`whitespace-nowrap px-4 py-3.5 text-slate-900 dark:text-slate-100 ${j < nbColsTexte ? "text-left" : "text-right"}`}
                  >
                    {c}
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
