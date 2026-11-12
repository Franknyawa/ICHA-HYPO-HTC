const COULEUR_CLASSES: Record<string, { bar: string; text: string; bg: string }> = {
  vert: { bar: "bg-green-500", text: "text-green-700 dark:text-green-400", bg: "bg-green-50 dark:bg-green-950/40" },
  orange: { bar: "bg-amber-500", text: "text-amber-700 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/40" },
  rouge: { bar: "bg-red-500", text: "text-alert dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/40" },
};

/**
 * Barre de progression colorée (rouge <50% / orange 50-79% / vert 80%+)
 * — utilisée sur le dashboard commercial ET la page admin Objectifs, pour
 * un rendu identique aux deux endroits.
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
  /** Détail brut vendu : cartons, filets, sachets (total puis par produit). */
  detail?: {
    cartons: number;
    filets: number;
    sachets: number;
    parProduit: { code: string; cartons: number; filets: number; sachets: number }[];
  };
}) {
  const c = COULEUR_CLASSES[couleur];
  return (
    <div className={`rounded-xl ${c.bg} p-3`}>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{label}</span>
        <span className={`text-xs font-bold ${c.text}`}>{pourcentage}%</span>
      </div>
      <div className="mb-1 h-2 overflow-hidden rounded-full bg-white dark:bg-slate-900/60">
        <div
          className={`h-full rounded-full ${c.bar} transition-all`}
          style={{ width: `${Math.min(100, pourcentage)}%` }}
        />
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        {realise} / {objectif} cartons
      </p>
      {detail && <DetailQuantites detail={detail} />}
    </div>
  );
}

const nb = (n: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(n);
const pl = (n: number, mot: string) => `${nb(n)} ${mot}${n > 1 ? "s" : ""}`;

function DetailQuantites({ detail }: { detail: NonNullable<Parameters<typeof StatBar>[0]["detail"]> }) {
  const vide = detail.cartons + detail.filets + detail.sachets === 0;
  return (
    <div className="mt-2 border-t border-white/70 pt-2 dark:border-slate-700">
      <div className="grid grid-cols-3 gap-1.5 text-center">
        {[
          ["Cartons", detail.cartons],
          ["Filets", detail.filets],
          ["Sachets", detail.sachets],
        ].map(([lib, n]) => (
          <div key={lib as string} className="rounded-lg bg-white/70 px-1 py-1.5 dark:bg-slate-900/60">
            <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{nb(n as number)}</p>
            <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{lib as string}</p>
          </div>
        ))}
      </div>
      {!vide && detail.parProduit.length > 1 && (
        <ul className="mt-1.5 space-y-0.5 text-[11px] text-slate-500 dark:text-slate-400">
          {detail.parProduit
            .filter((d) => d.cartons + d.filets + d.sachets > 0)
            .map((d) => (
              <li key={d.code} className="flex justify-between gap-2">
                <span className="font-semibold text-slate-600 dark:text-slate-300">{d.code}</span>
                <span>
                  {[d.cartons > 0 ? pl(d.cartons, "carton") : "", d.filets > 0 ? pl(d.filets, "filet") : "", d.sachets > 0 ? pl(d.sachets, "sachet") : ""]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
