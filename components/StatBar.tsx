import { descriptionProduit } from "@/lib/utils/produit-libelle";

const COULEUR_CLASSES: Record<string, { bar: string; text: string; bg: string; badge: string }> = {
  vert: { bar: "bg-green-500", text: "text-green-700 dark:text-green-400", bg: "bg-green-50 dark:bg-green-950/40", badge: "bg-green-600 text-white" },
  orange: { bar: "bg-amber-500", text: "text-amber-700 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/40", badge: "bg-amber-500 text-white" },
  rouge: { bar: "bg-red-500", text: "text-alert dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/40", badge: "bg-red-500 text-white" },
};

export type DetailQuantites = {
  cartons: number;
  filets: number;
  sachets: number;
  parProduit: { code: string; nom?: string; cartons: number; filets: number; sachets: number; equivalent?: number }[];
};

const nb = (n: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(n);

/**
 * Barre de progression colorée (rouge <50% / orange 50-79% / vert 80%+)
 * — utilisée sur le dashboard commercial ET la page admin Objectifs, pour
 * un rendu identique aux deux endroits.
 * Avec `detail` : récap (cartons, filets, sachets) puis tableau par produit.
 */
export function StatBar({
  label,
  realise,
  objectif,
  pourcentage,
  couleur,
  detail,
}: {
  label: string;
  realise: number;
  objectif: number;
  pourcentage: number;
  couleur: string;
  detail?: DetailQuantites;
}) {
  const c = COULEUR_CLASSES[couleur];
  return (
    <div className={`rounded-2xl ${c.bg} p-3.5`}>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{label}</span>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-extrabold ${c.badge}`}>{pourcentage}%</span>
      </div>
      <div className="mb-1.5 h-2.5 overflow-hidden rounded-full bg-white dark:bg-slate-900/60">
        <div className={`h-full rounded-full ${c.bar} transition-all`} style={{ width: `${Math.min(100, pourcentage)}%` }} />
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        <span className={`text-sm font-extrabold ${c.text}`}>{nb(realise)}</span> / {nb(objectif)} cartons (objectif)
      </p>
      {detail && <Recap detail={detail} />}
    </div>
  );
}

function Recap({ detail }: { detail: DetailQuantites }) {
  const produits = detail.parProduit;
  const equivTotal = produits.reduce((t, d) => t + (d.equivalent ?? 0), 0);
  const grille = "grid grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))] items-center gap-1";
  const cellule = "text-right tabular-nums";
  return (
    <div className="mt-3 border-t border-white pt-3 dark:border-slate-700">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Détail par produit</p>
      <div className="overflow-hidden rounded-xl bg-white shadow-sm dark:bg-slate-900">
        <div className={`${grille} bg-slate-100 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400`}>
          <span>Produit</span>
          <span className="text-right">Cartons</span>
          <span className="text-right">Filets</span>
          <span className="text-right">Sachets</span>
        </div>
        {produits.map((d) => {
          const aucun = d.cartons + d.filets + d.sachets === 0;
          return (
            <div key={d.code} className="border-t border-slate-100 px-3 py-2 dark:border-slate-800">
              <div className={`${grille} text-sm ${aucun ? "text-slate-300 dark:text-slate-600" : "text-slate-700 dark:text-slate-200"}`}>
                <span className="min-w-0">
                  <span className={`block truncate font-extrabold ${aucun ? "" : "text-slate-800 dark:text-slate-100"}`}>{d.code}</span>
                  {descriptionProduit(d.code) && <span className="block text-[10px] font-medium leading-tight text-slate-400">{descriptionProduit(d.code)}</span>}
                </span>
                <span className={`${cellule} font-semibold`}>{nb(d.cartons)}</span>
                <span className={`${cellule} font-semibold`}>{nb(d.filets)}</span>
                <span className={`${cellule} font-semibold`}>{nb(d.sachets)}</span>
              </div>
              {d.equivalent !== undefined && !aucun && (
                <p className="mt-0.5 text-[11px] text-slate-400">Soit {nb(d.equivalent)} carton{d.equivalent > 1 ? "s" : ""} équivalent{d.equivalent > 1 ? "s" : ""}</p>
              )}
            </div>
          );
        })}
        <div className="border-t-2 border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800">
          <div className={`${grille} text-sm font-extrabold text-slate-900 dark:text-slate-50`}>
            <span className="text-xs uppercase tracking-wide">Cumul</span>
            <span className={cellule}>{nb(detail.cartons)}</span>
            <span className={cellule}>{nb(detail.filets)}</span>
            <span className={cellule}>{nb(detail.sachets)}</span>
          </div>
          <p className="mt-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Soit {nb(Math.round(equivTotal * 10) / 10)} carton{equivTotal > 1 ? "s" : ""} équivalent{equivTotal > 1 ? "s" : ""} au total
          </p>
        </div>
      </div>
    </div>
  );
}
