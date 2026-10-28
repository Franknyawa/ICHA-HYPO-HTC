import { CheckCircle2, Clock, PackageCheck, ClipboardList } from "lucide-react";
import type { BilanValidees, CommandesDuJour } from "@/lib/queries/dashboard";
import { TitreSection } from "@/components/admin/ui";
import { partsVente, texteDetail } from "@/lib/utils/cartons-equiv";
import { formatFcfa } from "@/lib/utils/format";

const nb = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));
const car = (n: number) => String(Math.round(n * 10) / 10).replace(".", ",");
const pct = (n: number) => `${String(n).replace(".", ",")} %`;

/** Commandes de la journée, produit par produit : cartons vendus en cartons, sachets / filets vendus à l'unité, part de chacun. */
export function CommandesDuJourSection({ data, bilan }: { data: CommandesDuJour; bilan: BilanValidees }) {
  const { produits, total } = data;
  const partsTotal = partsVente({ gros: total.cartons, detailEq: total.detailEq });
  return (
    <section>
      <TitreSection ton="violet">Commandes de la journée</TitreSection>
      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { icone: ClipboardList, label: "Validées aujourd'hui", valeur: String(total.commandes), sous: `${car(total.cartons)} cartons + ${texteDetail({ sd: total.sachetsDetail, fd: total.filetsDetail })} au détail · ${formatFcfa(total.montant)}`, ton: "bg-blue-100 text-blue-700" },
          { icone: CheckCircle2, label: "Déjà livrées", valeur: String(total.livrees), sous: `${formatFcfa(total.montantLivrees)} · stock sorti`, ton: "bg-emerald-100 text-emerald-700" },
          { icone: PackageCheck, label: "À livrer", valeur: String(total.aLivrer), sous: `${formatFcfa(total.montantALivrer)} · en attente de livraison`, ton: "bg-amber-100 text-amber-700" },
          { icone: Clock, label: "En attente de validation", valeur: String(total.enAttente), sous: `${formatFcfa(total.montantEnAttente)} · à valider`, ton: "bg-rose-100 text-rose-700" },
        ].map((k) => (
          <div key={k.label} className="flex items-center gap-3 rounded-2xl bg-white p-3.5 shadow-sm ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${k.ton}`}>
              <k.icone size={18} />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{k.label}</p>
              <p className="text-xl font-bold leading-tight text-slate-900 dark:text-slate-100">{k.valeur}</p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400" title={k.sous}>{k.sous}</p>
            </div>
          </div>
        ))}
      </div>

      {bilan.avant.nb > 0 && (
        <p className="mb-3 rounded-xl bg-slate-50 px-4 py-2.5 text-xs text-slate-600 dark:bg-slate-800/50 dark:text-slate-300">
          <span className="font-semibold text-slate-800 dark:text-slate-100">Validées avant aujourd&apos;hui, encore à livrer :</span>{" "}
          {bilan.avant.nb} cmd · {car(bilan.avant.cartons)} cartons{bilan.avant.vol.sd + bilan.avant.vol.fd > 0 ? ` + ${texteDetail(bilan.avant.vol)}` : ""} · {formatFcfa(bilan.avant.montant)}
        </p>
      )}

      {partsTotal && (
        <div className="mb-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 text-xs font-semibold">
            <span className="text-blue-700 dark:text-blue-400">{pct(partsTotal.cartons)} vendus en cartons</span>
            <span className="text-amber-700 dark:text-amber-400">{pct(partsTotal.detail)} vendus au détail</span>
          </div>
          <div className="flex h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div className="h-full bg-blue-600" style={{ width: `${partsTotal.cartons}%` }} />
            <div className="h-full bg-amber-400" style={{ width: `${partsTotal.detail}%` }} />
          </div>
        </div>
      )}

      {produits.length === 0 ? (
        <p className="rounded-2xl bg-white p-6 text-center text-sm text-slate-400 shadow-sm ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
          Aucune commande validée aujourd&apos;hui.
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {produits.map((p) => {
            const hypo = p.code === "HYPO";
            const parts = partsVente({ gros: p.cartons, detailEq: p.detailEq });
            return (
              <div key={p.code} className={`overflow-hidden rounded-2xl bg-white shadow-sm ring-1 dark:bg-slate-900 ${hypo ? "ring-blue-100 dark:ring-blue-900/50" : "ring-teal-100 dark:ring-teal-900/50"}`}>
                <div className={`flex items-center justify-between px-4 py-2.5 ${hypo ? "bg-blue-50 dark:bg-blue-950/30" : "bg-teal-50 dark:bg-teal-950/30"}`}>
                  <p className={`text-sm font-bold ${hypo ? "text-blue-800 dark:text-blue-300" : "text-teal-800 dark:text-teal-300"}`}>
                    {p.code} <span className="font-normal opacity-75">· {p.nom}</span>
                  </p>
                  <span className="text-xs font-semibold text-slate-500">{p.commandes} commande{p.commandes > 1 ? "s" : ""}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 px-4 py-4">
                  <div>
                    <p className="text-3xl font-bold tabular-nums text-slate-900 dark:text-slate-50">{car(p.cartons)}</p>
                    <p className="text-xs font-medium text-slate-500">cartons vendus en cartons</p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold tabular-nums text-slate-900 dark:text-slate-50">{nb(p.sachetsDetail)}</p>
                    <p className="text-xs font-medium text-slate-500">
                      sachets à l&apos;unité{p.filetsDetail > 0 ? ` · ${nb(p.filetsDetail)} filet${p.filetsDetail > 1 ? "s" : ""}` : ""}
                    </p>
                  </div>
                </div>
                <div className="px-4 pb-4">
                  {parts ? (
                    <>
                      <div className="mb-1 flex h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div className="h-full bg-blue-600" style={{ width: `${parts.cartons}%` }} />
                        <div className="h-full bg-amber-400" style={{ width: `${parts.detail}%` }} />
                      </div>
                      <p className="flex justify-between text-[11px] font-medium">
                        <span className="text-blue-700 dark:text-blue-400">{pct(parts.cartons)} cartons</span>
                        <span className="text-amber-700 dark:text-amber-400">{pct(parts.detail)} détail</span>
                      </p>
                    </>
                  ) : null}
                  <p className="mt-2 text-sm font-bold tabular-nums text-slate-800 dark:text-slate-100">
                    {formatFcfa(p.montant)} <span className="text-[11px] font-medium text-slate-400">valeur facturée</span>
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {p.livrees} livrée{p.livrees > 1 ? "s" : ""} · {p.aLivrer} à livrer
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
