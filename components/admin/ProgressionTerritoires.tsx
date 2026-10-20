"use client";

import { useState } from "react";
import { Globe2, MapPinned } from "lucide-react";
import { StatBar } from "@/components/StatBar";
import type { LigneTerritoire, PeriodeTerritoire, ProgressionTerritoires } from "@/lib/queries/objectifs-territoire";

const PERIODES: { id: PeriodeTerritoire; label: string }[] = [
  { id: "JOURNALIER", label: "Aujourd'hui" },
  { id: "HEBDOMADAIRE", label: "Cette semaine" },
  { id: "MENSUEL", label: "Ce mois" },
];

const COULEUR_BARRE = { vert: "bg-emerald-600/80", orange: "bg-amber-500/80", rouge: "bg-red-500/80" } as const;

function Carte({ ligne, periode }: { ligne: LigneTerritoire; periode: PeriodeTerritoire }) {
  const m = ligne.periodes[periode];
  const avecObjectif = m.objectif > 0;
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <p className="truncate font-semibold text-slate-800 dark:text-slate-100">{ligne.nom}</p>
        {ligne.sous && <p className="shrink-0 text-[11px] text-slate-400">{ligne.sous}</p>}
      </div>
      {avecObjectif ? (
        <StatBar label={PERIODES.find((p) => p.id === periode)!.label} {...m} />
      ) : (
        <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950">
          <div className="mb-1.5 h-2 rounded-full bg-slate-200 dark:bg-slate-800" />
          <p className="text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-slate-700 dark:text-slate-200">{m.realise}</span> carton{m.realise > 1 ? "s" : ""} · aucun objectif défini
          </p>
        </div>
      )}
    </div>
  );
}

/** Progression par région et par ville, avec choix de la période. */
export function ProgressionTerritoiresBloc({ data }: { data: ProgressionTerritoires }) {
  const [periode, setPeriode] = useState<PeriodeTerritoire>("MENSUEL");
  const [niveau, setNiveau] = useState<"regions" | "villes">("regions");
  const lignes = data[niveau];

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          {([
            ["regions", "Régions", Globe2],
            ["villes", "Villes", MapPinned],
          ] as const).map(([id, label, Icone]) => (
            <button
              key={id}
              onClick={() => setNiveau(id)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${
                niveau === id ? "bg-white text-[#1e3a8a] shadow dark:bg-slate-950 dark:text-blue-300" : "text-slate-500 dark:text-slate-400"
              }`}
            >
              <Icone size={13} /> {label}
            </button>
          ))}
        </div>
        <div className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          {PERIODES.map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriode(p.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                periode === p.id ? "bg-white text-[#1e3a8a] shadow dark:bg-slate-950 dark:text-blue-300" : "text-slate-500 dark:text-slate-400"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <span className="hidden items-center gap-3 text-[11px] text-slate-400 sm:flex">
          {(["vert", "orange", "rouge"] as const).map((c) => (
            <span key={c} className="flex items-center gap-1">
              <span className={`h-2 w-2 rounded-full ${COULEUR_BARRE[c]}`} />
              {c === "vert" ? "≥ 80 %" : c === "orange" ? "50–79 %" : "< 50 %"}
            </span>
          ))}
        </span>
      </div>

      {lignes.length === 0 ? (
        <p className="rounded-2xl bg-white p-6 text-center text-sm text-slate-400 ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
          Rien à afficher pour le moment : aucune vente sur la période et aucun objectif défini (Paramètres → Objectifs par région et par ville).
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {lignes.map((l) => (
            <Carte key={l.cle} ligne={l} periode={periode} />
          ))}
        </div>
      )}
    </div>
  );
}
