import { CheckCircle2, Clock, PackageCheck, ClipboardList } from "lucide-react";
import type { CommandesDuJour } from "@/lib/queries/dashboard";
import { TitreSection } from "@/components/admin/ui";

const nb = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));
const car = (n: number) => String(Math.round(n * 10) / 10).replace(".", ",");

/** Commandes de la journée, produit par produit : cartons, filets, sachets saisis, puis totaux en cartons et en sachets. */
export function CommandesDuJourSection({ data }: { data: CommandesDuJour }) {
  const { produits, total } = data;
  return (
    <section>
      <TitreSection ton="violet">Commandes de la journée</TitreSection>
      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { icone: ClipboardList, label: "Validées aujourd'hui", valeur: String(total.commandes), sous: `${car(total.cartons)} cartons · ${nb(total.sachets)} sachets`, ton: "bg-blue-100 text-blue-700" },
          { icone: CheckCircle2, label: "Déjà livrées", valeur: String(total.livrees), sous: "stock sorti, encaissement ouvert", ton: "bg-emerald-100 text-emerald-700" },
          { icone: PackageCheck, label: "À livrer", valeur: String(total.aLivrer), sous: "validées, en attente de livraison", ton: "bg-amber-100 text-amber-700" },
          { icone: Clock, label: "En attente de validation", valeur: String(total.enAttente), sous: "à valider par l'admin", ton: "bg-rose-100 text-rose-700" },
        ].map((k) => (
          <div key={k.label} className="flex items-center gap-3 rounded-2xl bg-white p-3.5 shadow-sm ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${k.ton}`}>
              <k.icone size={18} />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{k.label}</p>
              <p className="text-xl font-bold leading-tight text-slate-900 dark:text-slate-100">{k.valeur}</p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">{k.sous}</p>
            </div>
          </div>
        ))}
      </div>

      {produits.length === 0 ? (
        <p className="rounded-2xl bg-white p-6 text-center text-sm text-slate-400 shadow-sm ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
          Aucune commande validée aujourd&apos;hui.
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {produits.map((p) => {
            const hypo = p.code === "HYPO";
            const pctLivre = p.sachets > 0 ? (p.sachetsLivres / p.sachets) * 100 : 0;
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
                    <p className="text-xs font-medium text-slate-500">cartons</p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold tabular-nums text-slate-900 dark:text-slate-50">{nb(p.sachets)}</p>
                    <p className="text-xs font-medium text-slate-500">sachets</p>
                  </div>
                </div>
                <div className="px-4 pb-4">
                  <div className="mb-1.5 flex flex-wrap gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    {p.nbCartons > 0 && <span className="rounded-full bg-slate-100 px-2 py-0.5 dark:bg-slate-800">{p.nbCartons} carton{p.nbCartons > 1 ? "s" : ""} entier{p.nbCartons > 1 ? "s" : ""}</span>}
                    {p.nbFilets > 0 && <span className="rounded-full bg-slate-100 px-2 py-0.5 dark:bg-slate-800">{p.nbFilets} filet{p.nbFilets > 1 ? "s" : ""}</span>}
                    {p.nbSachets > 0 && <span className="rounded-full bg-slate-100 px-2 py-0.5 dark:bg-slate-800">{nb(p.nbSachets)} sachet{p.nbSachets > 1 ? "s" : ""} à l&apos;unité</span>}
                  </div>
                  <div className="mb-1 flex h-2.5 overflow-hidden rounded-full bg-amber-200 dark:bg-amber-900/40">
                    <div className="h-full bg-emerald-500" style={{ width: `${pctLivre}%` }} />
                  </div>
                  <p className="flex justify-between text-[11px] text-slate-500">
                    <span className="font-medium text-emerald-700 dark:text-emerald-400">{nb(p.sachetsLivres)} sachets livrés</span>
                    <span className="font-medium text-amber-700 dark:text-amber-400">{nb(p.sachetsALivrer)} à livrer</span>
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
