import { MessageSquareQuote } from "lucide-react";

type Observation = {
  id: string;
  observation: string | null;
  dateVisite: Date;
  commercial: { prenom: string; nom: string };
  pointVente: { nom: string };
};

const COULEURS = [
  "from-slate-600 to-slate-500",
  "from-slate-600 to-slate-500",
  "from-slate-600 to-slate-500",
  "from-slate-600 to-slate-500",
  "from-slate-600 to-slate-500",
  "from-slate-600 to-slate-500",
];

function couleur(nom: string) {
  let h = 0;
  for (const c of nom) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return COULEURS[h % COULEURS.length];
}

function depuis(date: Date) {
  const jours = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (jours <= 0) return "Aujourd'hui";
  if (jours === 1) return "Hier";
  if (jours < 7) return `Il y a ${jours} jours`;
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "Africa/Douala" });
}

/** Observations laissées par les commerciaux : une carte par remarque, avec l'auteur et le point de vente. */
export function ObservationsTerrain({ observations }: { observations: Observation[] }) {
  if (observations.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-400 dark:border-slate-700 dark:bg-slate-900">
        Aucune observation pour le moment.
      </div>
    );
  }
  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {observations.map((o) => {
        const nom = `${o.commercial.prenom} ${o.commercial.nom}`;
        const initiales = `${o.commercial.prenom[0] ?? ""}${o.commercial.nom[0] ?? ""}`.toUpperCase();
        return (
          <li
            key={o.id}
            className="relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <MessageSquareQuote size={44} className="absolute -right-1 -top-1 text-slate-100 dark:text-slate-800" strokeWidth={1.5} />
            <div className="relative flex items-center gap-3">
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${couleur(nom)} text-sm font-bold text-white`}
              >
                {initiales}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">{nom}</p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                  {o.pointVente.nom} · {depuis(o.dateVisite)}
                </p>
              </div>
            </div>
            <p className="relative mt-3 rounded-xl bg-slate-50 px-3.5 py-2.5 text-sm leading-relaxed text-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
              {o.observation}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
