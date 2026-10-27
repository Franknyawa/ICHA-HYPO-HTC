import { getCartonsParJour } from "@/lib/queries/dashboard";
import { jourDouala } from "@/lib/utils/periode";
import { arrondiCartons } from "@/lib/utils/cartons-equiv";

const fmt = (n: number) => (n === 0 ? "—" : Number.isInteger(n) ? String(n) : String(n).replace(".", ","));
const fcfa = (n: number) => (n === 0 ? "—" : n.toLocaleString("fr-FR"));

function libelleJour(j: string, aujourdhui: string) {
  const d = new Date(`${j}T12:00:00Z`);
  const txt = d.toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "UTC" });
  return j === aujourdhui ? `Aujourd'hui · ${txt}` : txt;
}

/** Cartons vendus par jour (14 derniers jours) : HYPO, HTC, total, détail, commandes, montant, + total de la période. */
export async function CartonsParJourSection() {
  const lignes = await getCartonsParJour(14);
  const aujourdhui = jourDouala();
  const somme = (cle: "hypo" | "htc" | "total" | "detail" | "commandes" | "montant") => lignes.reduce((s, l) => s + l[cle], 0);
  const th = "px-2 py-2 text-right font-semibold";
  const td = "px-2 py-2 text-right tabular-nums";

  return (
    <div>
      <h2 className="mb-1 text-xs font-bold uppercase tracking-wide text-[#1e3a8a] dark:text-blue-300">Cartons vendus par jour</h2>
      <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
        Commandes validées chaque jour, 14 derniers jours. Les sachets et filets sont convertis en cartons.
      </p>
      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
        <table className="w-full min-w-[520px] text-xs">
          <thead className="bg-slate-50 text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Jour</th>
              <th className={th}>HYPO</th>
              <th className={th}>HTC</th>
              <th className={th}>Total</th>
              <th className={th}>dont détail</th>
              <th className={th}>Cmd</th>
              <th className={th}>Montant (FCFA)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {lignes.map((l) => (
              <tr key={l.jour} className={l.jour === aujourdhui ? "bg-blue-50/60 font-semibold dark:bg-slate-800/40" : ""}>
                <td className="whitespace-nowrap px-3 py-2 text-left text-slate-700 dark:text-slate-200">{libelleJour(l.jour, aujourdhui)}</td>
                <td className={td}>{fmt(l.hypo)}</td>
                <td className={td}>{fmt(l.htc)}</td>
                <td className={`${td} font-bold text-slate-900 dark:text-slate-100`}>{fmt(l.total)}</td>
                <td className={`${td} text-slate-500`}>{fmt(l.detail)}</td>
                <td className={td}>{l.commandes || "—"}</td>
                <td className={td}>{fcfa(l.montant)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-bold dark:border-slate-700 dark:bg-slate-800/60">
            <tr>
              <td className="px-3 py-2.5 text-left">Total 14 jours</td>
              <td className={td}>{fmt(arrondiCartons(somme("hypo")))}</td>
              <td className={td}>{fmt(arrondiCartons(somme("htc")))}</td>
              <td className={td}>{fmt(arrondiCartons(somme("total")))}</td>
              <td className={td}>{fmt(arrondiCartons(somme("detail")))}</td>
              <td className={td}>{somme("commandes")}</td>
              <td className={td}>{fcfa(somme("montant"))}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

export function CartonsParJourSkeleton() {
  return <div className="h-72 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-900" />;
}
