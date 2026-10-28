"use client";

import { useMemo, useState } from "react";
import { Trophy } from "lucide-react";
import { formatMontant } from "@/lib/utils/format";
import type { DonneesVentesProduit, PeriodeId, PointSerie } from "@/lib/queries/ventes-produit";

type Indicateur = "cartons" | "sachets" | "ca";

const LIB_INDIC: Record<Indicateur, string> = { cartons: "Cartons", sachets: "Sachets", ca: "Valeur facturée" };
const LIB_INDIC_MIN: Record<Indicateur, string> = { cartons: "cartons", sachets: "sachets", ca: "valeur facturée" };

const PERIODES: { id: PeriodeId; label: string }[] = [
  { id: "30j", label: "30 derniers jours" },
  { id: "90j", label: "90 derniers jours" },
  { id: "12m", label: "12 derniers mois" },
  { id: "tout", label: "Depuis le début" },
];

const OR = "#2563eb";
const OR_CLAIR = "#bfdbfe";

const fmtQte = (n: number) => (Number.isInteger(n) ? String(n) : String(n).replace(".", ","));
const fmtCa = (n: number) => `${formatMontant(n)} FCFA`;
const fmtSach = (n: number) => `${formatMontant(n)} sachets`;
const fmtValeur = (n: number, i: Indicateur) => (i === "cartons" ? fmtQte(n) : i === "sachets" ? fmtSach(n) : fmtCa(n));
const fmtPct = (x: number) => {
  const r = Math.round(x * 10) / 10;
  return `${Number.isInteger(r) ? r : String(r).replace(".", ",")} %`;
};

function graduations(max: number) {
  if (max <= 0) return { max: 4, pas: 1 };
  const brut = max / 4;
  const mag = 10 ** Math.floor(Math.log10(brut));
  const norm = brut / mag;
  const pas = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
  return { max: pas * 4, pas };
}

function fmtAxe(n: number, i: Indicateur) {
  if ((i === "ca" || i === "sachets") && n >= 1000) return `${fmtQte(Math.round((n / 1000) * 10) / 10)}k`;
  return fmtQte(n);
}

function Axes({ w, h, g, i, gauche, bas }: { w: number; h: number; g: { max: number; pas: number }; i: Indicateur; gauche: number; bas: number }) {
  return (
    <>
      {[0, 1, 2, 3, 4].map((k) => {
        const y = h - bas - ((h - bas - 8) * k) / 4;
        return (
          <g key={k}>
            <line x1={gauche} x2={w} y1={y} y2={y} stroke="currentColor" strokeOpacity={0.15} strokeDasharray="3 4" />
            <text x={gauche - 8} y={y + 3} textAnchor="end" fontSize="10" fill="currentColor" fillOpacity={0.55}>
              {fmtAxe(g.pas * k, i)}
            </text>
          </g>
        );
      })}
    </>
  );
}

function GrapheBarres({ points, indicateur }: { points: PointSerie[]; indicateur: Indicateur }) {
  const W = 720;
  const H = 190;
  const gauche = 40;
  const bas = 24;
  const valeurs = points.map((p) => p[indicateur]);
  const g = graduations(Math.max(...valeurs, 0));
  const largeurCol = (W - gauche) / points.length;
  const l = Math.min(34, largeurCol * 0.55);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full text-slate-500 dark:text-slate-400" role="img" aria-label="Évolution sur 12 mois">
      <Axes w={W} h={H} g={g} i={indicateur} gauche={gauche} bas={bas} />
      {points.map((p, k) => {
        const v = p[indicateur];
        const hb = ((H - bas - 8) * v) / g.max;
        const x = gauche + k * largeurCol + (largeurCol - l) / 2;
        return (
          <g key={k}>
            {v > 0 && <rect x={x} y={H - bas - hb} width={l} height={hb} rx={2} fill={OR}><title>{`${p.label} : ${fmtValeur(v, indicateur)}`}</title></rect>}
            <text x={gauche + k * largeurCol + largeurCol / 2} y={H - 7} textAnchor="middle" fontSize="10" fill="currentColor" fillOpacity={0.6}>
              {p.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function GrapheCourbe({ points, indicateur }: { points: PointSerie[]; indicateur: Indicateur }) {
  const W = 720;
  const H = 170;
  const gauche = 40;
  const bas = 24;
  const g = graduations(Math.max(...points.map((p) => p[indicateur]), 0));
  const pas = (W - gauche - 6) / (points.length - 1);
  const xy = points.map((p, k) => [gauche + k * pas, H - bas - ((H - bas - 8) * p[indicateur]) / g.max] as const);
  // Courbe lissée (points de contrôle au milieu de chaque segment)
  let d = `M ${xy[0][0]} ${xy[0][1]}`;
  for (let k = 1; k < xy.length; k++) {
    const mx = (xy[k - 1][0] + xy[k][0]) / 2;
    d += ` C ${mx} ${xy[k - 1][1]}, ${mx} ${xy[k][1]}, ${xy[k][0]} ${xy[k][1]}`;
  }
  const aire = `${d} L ${xy[xy.length - 1][0]} ${H - bas} L ${xy[0][0]} ${H - bas} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full text-slate-500 dark:text-slate-400" role="img" aria-label="30 derniers jours">
      <Axes w={W} h={H} g={g} i={indicateur} gauche={gauche} bas={bas} />
      <path d={aire} fill={OR_CLAIR} fillOpacity={0.45} />
      <path d={d} fill="none" stroke={OR} strokeWidth={2} strokeLinejoin="round" />
      {points.map((p, k) =>
        k % 5 === 0 || k === points.length - 1 ? (
          <text key={k} x={xy[k][0]} y={H - 7} textAnchor="middle" fontSize="10" fill="currentColor" fillOpacity={0.6}>
            {p.label}
          </text>
        ) : null
      )}
    </svg>
  );
}

function ListeClassement({ titre, sousTitre, items, indicateur }: { titre: string; sousTitre: string; items: { nom: string; lieu: string; cartons: number; sachets: number; ca: number }[]; indicateur: Indicateur }) {
  const max = Math.max(...items.map((x) => x[indicateur]), 0);
  return (
    <div className="rounded-2xl border border-t-4 border-slate-200/70 border-t-emerald-400 bg-white p-5 shadow-sm dark:border-slate-800 dark:border-t-emerald-500 dark:bg-slate-900">
      <h3 className="font-bold text-slate-900 dark:text-slate-100">{titre}</h3>
      <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">{sousTitre}</p>
      {items.length === 0 && <p className="text-sm text-slate-400 dark:text-slate-500">Aucune vente.</p>}
      <ol className="space-y-3">
        {items.map((x, k) => (
          <li key={x.nom + x.lieu + k}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate">
                <span className="text-slate-400">{k + 1}.</span>{" "}
                <span className="font-medium text-slate-800 dark:text-slate-100">{x.nom}</span>{" "}
                <span className="text-xs text-slate-500 dark:text-slate-400">{x.lieu}</span>
              </span>
              <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
                {indicateur === "cartons" ? `${fmtQte(x.cartons)} carton${x.cartons > 1 ? "s" : ""}` : indicateur === "sachets" ? fmtSach(x.sachets) : fmtCa(x.ca)}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div className="h-full rounded-full bg-[#359980]/80" style={{ width: `${max > 0 ? Math.max(4, (x[indicateur] / max) * 100) : 0}%` }} />
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function VentesParProduit({ donnees }: { donnees: DonneesVentesProduit }) {
  const [indicateur, setIndicateur] = useState<Indicateur>("cartons");
  const [periode, setPeriode] = useState<PeriodeId>("tout");
  const [choisi, setChoisi] = useState<string | null>(null);

  const produits = donnees.periodes[periode];
  const classement = useMemo(
    () => [...produits].filter((p) => p[indicateur] > 0).sort((a, b) => b[indicateur] - a[indicateur]),
    [produits, indicateur]
  );
  const total = classement.reduce((s, p) => s + p[indicateur], 0);
  const meilleur = classement[0];
  // Produit affiché à droite : celui choisi s'il a des ventes sur la période, sinon le meilleur.
  const courant = produits.find((p) => p.id === choisi) ?? meilleur;
  const maxClassement = Math.max(...classement.map((p) => p[indicateur]), 0);

  // Produits proposables dans la liste déroulante : tous ceux qui ont des ventes (toutes périodes)
  const tous = useMemo(() => {
    const m = new Map<string, { id: string; nom: string }>();
    for (const liste of Object.values(donnees.periodes)) for (const p of liste) m.set(p.id, { id: p.id, nom: p.nom });
    return [...m.values()].sort((a, b) => a.nom.localeCompare(b.nom));
  }, [donnees]);

  const serie12 = courant ? donnees.serie12[courant.id] : undefined;
  const serie30 = courant ? donnees.serie30[courant.id] : undefined;

  const champ =
    "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400"><span className="h-3.5 w-1 rounded-full bg-gradient-to-b from-teal-500 to-emerald-400" />Ventes par produit</h2>
        <div className="flex items-center gap-2">
          <div className="flex rounded-full border border-slate-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-900" role="group" aria-label="Indicateur">
            {(["cartons", "sachets", "ca"] as const).map((i) => (
              <button
                key={i}
                onClick={() => setIndicateur(i)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  indicateur === i ? "bg-[#1e3a8a] text-white shadow" : "text-slate-500 dark:text-slate-400"
                }`}
              >
                {LIB_INDIC[i]}
              </button>
            ))}
          </div>
          <select value={periode} onChange={(e) => setPeriode(e.target.value as PeriodeId)} className={champ} aria-label="Période">
            {PERIODES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!meilleur ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-400 dark:border-slate-700 dark:bg-slate-900">
          Aucune vente sur cette période.
        </div>
      ) : (
        <>
          {/* Produit le plus vendu */}
          <div className="relative mb-4 flex flex-wrap items-center justify-between gap-5 overflow-hidden rounded-2xl bg-[#1e3a8a] p-5 text-white shadow-sm">
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
            <div className="relative flex items-center gap-4">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-white backdrop-blur">
                <Trophy size={24} />
              </span>
              <div>
                <p className="text-xs font-medium text-white/75">
                  Produit le plus vendu · en {LIB_INDIC_MIN[indicateur]}
                </p>
                <p className="text-xl font-bold">{meilleur.nom}</p>
                <span className="mt-1 inline-block rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-semibold text-white">
                  {meilleur.gamme}
                </span>
              </div>
            </div>
            <div className="relative flex flex-wrap gap-x-8 gap-y-3 text-sm">
              {[
                ["Cartons vendus", fmtQte(meilleur.cartons)],
                ["Sachets vendus", formatMontant(meilleur.sachets)],
                ["Valeur facturée", fmtCa(meilleur.ca)],
                ["Part des ventes", fmtPct(total > 0 ? (meilleur[indicateur] / total) * 100 : 0)],
              ].map(([l, v]) => (
                <div key={l}>
                  <p className="text-xs text-white/70">{l}</p>
                  <p className="text-lg font-bold">{v}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
            {/* Colonne gauche */}
            <div className="space-y-3">
              <div className="rounded-2xl border border-t-4 border-slate-200/70 border-t-blue-500 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <h3 className="font-bold text-slate-900 dark:text-slate-100">Classement des produits</h3>
                <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">Clique sur un produit pour voir ses graphiques.</p>
                <ul className="space-y-2.5">
                  {classement.slice(0, 10).map((p) => (
                    <li key={p.id}>
                      <button
                        onClick={() => setChoisi(p.id)}
                        className={`flex w-full items-center gap-3 rounded-lg px-1 py-0.5 text-left ${courant?.id === p.id ? "bg-blue-50 ring-1 ring-blue-200 dark:bg-slate-800/60 dark:ring-slate-700" : "hover:bg-slate-50 dark:hover:bg-slate-800/40"}`}
                      >
                        <span className="w-28 shrink-0 text-right text-xs leading-tight text-slate-600 dark:text-slate-300">{p.nom}</span>
                        <span className="h-5 flex-1">
                          <span
                            className="block h-full rounded-md"
                            style={{
                              width: `${Math.max(3, (p[indicateur] / maxClassement) * 100)}%`,
                              backgroundImage: p === meilleur ? "linear-gradient(90deg,#1e3a8a,#359980)" : "linear-gradient(90deg,#93c5fd,#a7e3d1)",
                            }}
                          />
                        </span>
                        <span className="w-20 shrink-0 text-xs text-slate-500 dark:text-slate-400">
                          {indicateur === "cartons" ? fmtQte(p.cartons) : indicateur === "sachets" ? formatMontant(p.sachets) : fmtCa(p.ca)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              {courant && (
                <>
                  <ListeClassement titre="Meilleurs points de vente" sousTitre={courant.nom} items={courant.topPointsVente} indicateur={indicateur} />
                  <ListeClassement titre="Meilleurs quartiers" sousTitre={courant.nom} items={courant.topQuartiers} indicateur={indicateur} />
                </>
              )}
            </div>

            {/* Colonne droite */}
            {courant && (
              <div className="rounded-2xl border border-t-4 border-slate-200/70 border-t-violet-500 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Graphiques du produit</p>
                    <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
                      {courant.nom}
                    </p>
                  </div>
                  <select value={courant.id} onChange={(e) => setChoisi(e.target.value)} className={champ} aria-label="Produit">
                    {tous.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nom}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
                  {[
                    ["Cartons", fmtQte(courant.cartons), "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"],
                    ["Sachets", formatMontant(courant.sachets), "bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300"],
                    ["Valeur facturée", fmtCa(courant.ca), "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"],
                    ["Commandes", String(courant.commandes), "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"],
                    ["Points de vente", String(courant.pointsVente), "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300"],
                  ].map(([l, v, c]) => (
                    <div key={l} className={`rounded-xl px-3 py-2.5 ${c}`}>
                      <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80">{l}</p>
                      <p className="mt-0.5 text-base font-bold text-slate-900 dark:text-slate-100">{v}</p>
                    </div>
                  ))}
                </div>

                <p className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Évolution sur 12 mois · {LIB_INDIC_MIN[indicateur]}
                </p>
                {serie12 ? <GrapheBarres points={serie12} indicateur={indicateur} /> : <p className="py-6 text-sm text-slate-400">Pas de vente sur 12 mois.</p>}

                <p className="mb-2 mt-6 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  30 derniers jours · {LIB_INDIC_MIN[indicateur]} par jour
                </p>
                {serie30 ? <GrapheCourbe points={serie30} indicateur={indicateur} /> : <p className="py-6 text-sm text-slate-400">Pas de vente sur 30 jours.</p>}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
