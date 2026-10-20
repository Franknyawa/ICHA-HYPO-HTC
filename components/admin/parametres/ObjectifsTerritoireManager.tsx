"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, Plus, Target, X } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/client/apiFetch";
import { NOMS_REGIONS } from "@/lib/geo/cameroun";

type Periode = "JOURNALIER" | "HEBDOMADAIRE" | "MENSUEL";
type Objectif = { niveau: "REGION" | "VILLE"; cle: string; periode: Periode; valeurCartons: number };
type Ville = { id: string; nom: string; region: string | null };

const COLONNES: { id: Periode; label: string }[] = [
  { id: "JOURNALIER", label: "Par jour" },
  { id: "HEBDOMADAIRE", label: "Par semaine" },
  { id: "MENSUEL", label: "Par mois" },
];

function Cellule({
  niveau,
  cle,
  periode,
  valeur,
  onSaved,
  onError,
}: {
  niveau: "REGION" | "VILLE";
  cle: string;
  periode: Periode;
  valeur: number;
  onSaved: () => void;
  onError: (m: string) => void;
}) {
  const [v, setV] = useState(valeur ? String(valeur) : "");

  async function enregistrer() {
    const n = v === "" ? 0 : Math.max(0, Math.floor(Number(v) || 0));
    if (n === valeur) return;
    try {
      await apiFetch("/api/parametres/objectifs-territoire", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ niveau, cle, periode, valeurCartons: n }),
      });
      onSaved();
    } catch (e) {
      onError(e instanceof ApiError ? e.message : "Échec de l'enregistrement.");
    }
  }

  return (
    <input
      type="number"
      min={0}
      inputMode="numeric"
      placeholder="—"
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={enregistrer}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      onWheel={(e) => (e.target as HTMLInputElement).blur()}
      aria-label={`Objectif ${periode.toLowerCase()}`}
      className="w-full min-w-[4.5rem] rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-right text-sm tabular-nums focus:border-[#359980] focus:outline-none focus:ring-2 focus:ring-[#359980]/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
    />
  );
}

/** Objectifs en cartons par région et par ville : on tape dans la case, l'enregistrement est automatique. */
export function ObjectifsTerritoireManager() {
  const [objectifs, setObjectifs] = useState<Objectif[]>([]);
  const [villes, setVilles] = useState<Ville[]>([]);
  const [niveau, setNiveau] = useState<"REGION" | "VILLE">("REGION");
  const [ouvert, setOuvert] = useState(true);
  const [ajout, setAjout] = useState("");
  const [villesAffichees, setVillesAffichees] = useState<string[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const charger = useCallback(() => {
    Promise.all([
      apiFetch<{ data: Objectif[] }>("/api/parametres/objectifs-territoire"),
      apiFetch<{ data: Ville[] }>("/api/parametres/villes-liste"),
    ])
      .then(([o, v]) => {
        setObjectifs(o.data ?? []);
        setVilles(v.data ?? []);
        setVillesAffichees((prev) => [...new Set([...prev, ...(o.data ?? []).filter((x) => x.niveau === "VILLE").map((x) => x.cle)])]);
        setVersion((n) => n + 1);
      })
      .catch((e: ApiError) => {
        if (e.status !== 401) console.error(e);
      });
  }, []);
  useEffect(charger, [charger]);

  const valeur = (n: "REGION" | "VILLE", cle: string, p: Periode) =>
    objectifs.find((o) => o.niveau === n && o.cle === cle && o.periode === p)?.valeurCartons ?? 0;

  const lignes =
    niveau === "REGION"
      ? NOMS_REGIONS.map((r) => ({ cle: r, nom: r, sous: "" }))
      : villesAffichees
          .map((id) => villes.find((v) => v.id === id))
          .filter((v): v is Ville => Boolean(v))
          .map((v) => ({ cle: v.id, nom: v.nom, sous: v.region ?? "" }));

  async function retirerVille(id: string) {
    try {
      for (const c of COLONNES) {
        if (valeur("VILLE", id, c.id) > 0) {
          await apiFetch("/api/parametres/objectifs-territoire", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ niveau: "VILLE", cle: id, periode: c.id, valeurCartons: 0 }),
          });
        }
      }
      setVillesAffichees((prev) => prev.filter((x) => x !== id));
      charger();
    } catch (e) {
      setErreur(e instanceof ApiError ? e.message : "Échec.");
    }
  }

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
      <button onClick={() => setOuvert((v) => !v)} className="flex w-full items-center gap-2 text-left">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-700 text-white">
          <Target size={16} />
        </span>
        <h2 className="font-bold text-slate-800 dark:text-slate-100">Objectifs par région et par ville</h2>
        <ChevronDown size={16} className={`text-slate-400 transition-transform ${ouvert ? "" : "-rotate-90"}`} />
      </button>

      {ouvert && (
        <div className="mt-3">
          <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
            Nombre de cartons à vendre. Laissez une case vide pour ne pas fixer d&apos;objectif. La progression est visible
            sur le tableau de bord et dans « Objectifs ».
          </p>
          <div className="mb-3 flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800 sm:w-fit">
            {([["REGION", "Régions"], ["VILLE", "Villes"]] as const).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setNiveau(id)}
                className={`flex-1 rounded-lg px-4 py-1.5 text-xs font-semibold ${
                  niveau === id ? "bg-white text-[#1e3a8a] shadow dark:bg-slate-950 dark:text-blue-300" : "text-slate-500 dark:text-slate-400"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {niveau === "VILLE" && (
            <div className="mb-3 flex gap-2">
              <select
                value={ajout}
                onChange={(e) => setAjout(e.target.value)}
                className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="">Ajouter une ville…</option>
                {villes
                  .filter((v) => !villesAffichees.includes(v.id))
                  .map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.nom}{v.region ? ` (${v.region})` : ""}
                    </option>
                  ))}
              </select>
              <button
                disabled={!ajout}
                onClick={() => {
                  setVillesAffichees((p) => [...p, ajout]);
                  setAjout("");
                }}
                className="flex items-center gap-1 rounded-xl bg-[#1e3a8a] px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
              >
                <Plus size={14} /> Ajouter
              </button>
            </div>
          )}

          {erreur && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-alert">{erreur}</p>}

          {lignes.length === 0 ? (
            <p className="rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-500 dark:bg-slate-950">Aucune ville pour l&apos;instant : ajoutez-en une ci-dessus.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl ring-1 ring-slate-100 dark:ring-slate-800">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-950">
                    <th className="px-3 py-2">{niveau === "REGION" ? "Région" : "Ville"}</th>
                    {COLONNES.map((c) => (
                      <th key={c.id} className="px-2 py-2 text-right">{c.label}</th>
                    ))}
                    {niveau === "VILLE" && <th className="w-10" />}
                  </tr>
                </thead>
                <tbody>
                  {lignes.map((l) => (
                    <tr key={`${l.cle}-${version}`} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="px-3 py-1.5 text-slate-700 dark:text-slate-200">
                        {l.nom}
                        {l.sous && <span className="ml-2 text-xs text-slate-400">{l.sous}</span>}
                      </td>
                      {COLONNES.map((c) => (
                        <td key={c.id} className="px-2 py-1.5">
                          <Cellule
                            niveau={niveau}
                            cle={l.cle}
                            periode={c.id}
                            valeur={valeur(niveau, l.cle, c.id)}
                            onSaved={charger}
                            onError={setErreur}
                          />
                        </td>
                      ))}
                      {niveau === "VILLE" && (
                        <td className="px-1">
                          <button onClick={() => retirerVille(l.cle)} aria-label="Retirer cette ville" className="rounded-lg p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-600">
                            <X size={14} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
