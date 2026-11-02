import { Boxes } from "lucide-react";
import type { TotauxProduit, TotauxProduitPeriode } from "@/lib/queries/dashboard";
import { TitreSection } from "@/components/admin/ui";
import { partsVente, texteDetail } from "@/lib/utils/cartons-equiv";

const car = (n: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(n);
const pct = (n: number) => `${String(n).replace(".", ",")} %`;

function Ligne({ label, p }: { label: string; p: TotauxProduitPeriode }) {
  const detail = texteDetail({ sd: p.sd, fd: p.fd });
  return (
    <div className="flex items-baseline justify-between gap-3 border-t border-slate-100 py-2 text-sm dark:border-slate-800">
      <span className="font-semibold text-slate-500 dark:text-slate-400">{label}</span>
      <span className="text-right tabular-nums">
        <span className="font-extrabold text-slate-900 dark:text-slate-50">{car(p.cartons)} cartons</span>
        {detail !== "—" && <span className="block text-xs font-semibold text-amber-700 dark:text-amber-400">+ {detail} au détail</span>}
      </span>
    </div>
  );
}

/** Total des cartons vendus par produit : depuis le début (en grand), puis aujourd'hui, semaine et mois. */
export function TotauxParProduitSection({ data }: { data: TotauxProduit[] }) {
  const cartonsTotal = data.reduce((s, p) => s + p.total.cartons, 0);
  return (
    <section>
      <TitreSection ton="bleu">Cartons vendus par produit</TitreSection>
      {data.length === 0 ? (
        <p className="rounded-2xl bg-white p-6 text-center text-sm font-medium text-slate-400 shadow-sm ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
          Aucune vente validée pour le moment.
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {data.map((p) => {
            const hypo = p.code === "HYPO";
            const parts = partsVente({ gros: p.total.cartons, detailEq: p.total.detailEq });
            return (
              <div key={p.code} className={`overflow-hidden rounded-2xl bg-white shadow-sm ring-1 dark:bg-slate-900 ${hypo ? "ring-blue-100 dark:ring-blue-900/50" : "ring-teal-100 dark:ring-teal-900/50"}`}>
                <div className={`flex items-center justify-between px-4 py-2.5 ${hypo ? "bg-blue-50 dark:bg-blue-950/30" : "bg-teal-50 dark:bg-teal-950/30"}`}>
                  <p className={`flex items-center gap-2 text-sm font-extrabold ${hypo ? "text-blue-800 dark:text-blue-300" : "text-teal-800 dark:text-teal-300"}`}>
                    <Boxes size={16} /> {p.code} <span className="font-medium opacity-75">· {p.nom}</span>
                  </p>
                  {cartonsTotal > 0 && <span className="text-xs font-bold text-slate-500">{pct(Math.round((p.total.cartons / cartonsTotal) * 1000) / 10)} des cartons</span>}
                </div>
                <div className="px-4 pt-4">
                  <p className="text-4xl font-black tabular-nums text-slate-900 dark:text-slate-50">{car(p.total.cartons)}</p>
                  <p className="text-xs font-semibold text-slate-500">cartons vendus depuis le début</p>
                  {parts && p.total.detailEq > 0 && (
                    <>
                      <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div className="h-full bg-blue-600" style={{ width: `${parts.cartons}%` }} />
                        <div className="h-full bg-amber-400" style={{ width: `${parts.detail}%` }} />
                      </div>
                      <p className="mt-1 flex justify-between text-[11px] font-semibold">
                        <span className="text-blue-700 dark:text-blue-400">{pct(parts.cartons)} cartons</span>
                        <span className="text-amber-700 dark:text-amber-400">{pct(parts.detail)} détail</span>
                      </p>
                    </>
                  )}
                </div>
                <div className="mt-3 px-4 pb-3">
                  <Ligne label="Aujourd'hui" p={p.aujourdhui} />
                  <Ligne label="Cette semaine" p={p.semaine} />
                  <Ligne label="Ce mois" p={p.mois} />
                  {p.total.sd + p.total.fd > 0 && <Ligne label="Total" p={p.total} />}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
