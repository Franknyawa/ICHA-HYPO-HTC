const COULEUR_CLASSES: Record<string, { bar: string; text: string; bg: string }> = {
  vert: { bar: "bg-green-500", text: "text-green-700", bg: "bg-green-50" },
  orange: { bar: "bg-amber-500", text: "text-amber-700", bg: "bg-amber-50" },
  rouge: { bar: "bg-red-500", text: "text-alert", bg: "bg-red-50" },
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
}: {
  label: string;
  realise: number;
  objectif: number;
  pourcentage: number;
  couleur: string;
}) {
  const c = COULEUR_CLASSES[couleur];
  return (
    <div className={`rounded-xl ${c.bg} p-3`}>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-600">{label}</span>
        <span className={`text-xs font-bold ${c.text}`}>{pourcentage}%</span>
      </div>
      <div className="mb-1 h-2 overflow-hidden rounded-full bg-white">
        <div
          className={`h-full rounded-full ${c.bar} transition-all`}
          style={{ width: `${Math.min(100, pourcentage)}%` }}
        />
      </div>
      <p className="text-xs text-slate-500">
        {realise} / {objectif} cartons
      </p>
    </div>
  );
}
