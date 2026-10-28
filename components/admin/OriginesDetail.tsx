import { Users } from "lucide-react";

type Origine = {
  commercialNom: string;
  pointVenteNom: string | null;
  source: string;
  produitCode: string;
  nbSachets: number;
  nbFilets: number;
  montant: unknown;
  createdAt: Date;
};

const fcfa = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n)) + " FCFA";
const qte = (o: { nbSachets: number; nbFilets: number }) =>
  [o.nbFilets ? `${o.nbFilets} filet${o.nbFilets > 1 ? "s" : ""}` : "", o.nbSachets ? `${o.nbSachets} sachet${o.nbSachets > 1 ? "s" : ""}` : ""]
    .filter(Boolean)
    .join(" + ") || "—";

/**
 * Facture « CLIENT DIVERS » : qui a vendu quoi. Un bloc par commerciale (ou saisie au bureau),
 * avec le détail de chaque vente pour retrouver l'origine d'une erreur.
 */
export function OriginesDetail({ origines }: { origines: Origine[] }) {
  const groupes = new Map<string, { titre: string; bureau: boolean; lignes: Origine[]; total: number }>();
  for (const o of origines) {
    const bureau = o.source !== "Terrain";
    const cle = bureau ? `bureau:${o.source}` : `terrain:${o.commercialNom}`;
    const g = groupes.get(cle) ?? { titre: bureau ? o.source : o.commercialNom, bureau, lignes: [], total: 0 };
    g.lignes.push(o);
    g.total += Number(o.montant);
    groupes.set(cle, g);
  }
  const liste = [...groupes.values()].sort((a, b) => Number(a.bureau) - Number(b.bureau) || b.total - a.total);

  return (
    <details className="mb-2 rounded-xl bg-amber-50/60 p-3 text-xs dark:bg-amber-950/20">
      <summary className="flex cursor-pointer items-center gap-2 font-semibold text-amber-800 dark:text-amber-300">
        <Users size={14} /> Détail par commerciale ({liste.length})
      </summary>
      <div className="mt-3 space-y-3">
        {liste.map((g) => (
          <div key={g.titre + g.bureau} className="rounded-lg bg-white p-2.5 ring-1 ring-amber-100 dark:bg-slate-900 dark:ring-slate-800">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <p className="font-bold text-slate-800 dark:text-slate-100">
                {g.titre}
                {g.bureau && <span className="ml-2 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700">Saisie au bureau</span>}
              </p>
              <p className="font-bold tabular-nums text-slate-700 dark:text-slate-200">{fcfa(g.total)}</p>
            </div>
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {g.lignes.map((l, i) => (
                <li key={i} className="flex flex-wrap items-center justify-between gap-2 py-1 text-slate-600 dark:text-slate-300">
                  <span>
                    <span className={`mr-2 rounded px-1.5 py-0.5 text-[10px] font-bold ${l.produitCode === "HYPO" ? "bg-blue-50 text-blue-700" : "bg-teal-50 text-teal-700"}`}>{l.produitCode}</span>
                    {qte(l)}
                    {l.pointVenteNom && <span className="text-slate-400"> · chez {l.pointVenteNom}</span>}
                  </span>
                  <span className="tabular-nums text-slate-400">
                    {new Date(l.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Douala" })} · {fcfa(Number(l.montant))}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </details>
  );
}
