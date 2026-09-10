import { getProgressionBinomes, getProgressionCommerciaux } from "@/lib/queries/objectifs-admin";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { StatBar } from "@/components/StatBar";
import { Users2, User } from "lucide-react";

export default async function ObjectifsPage() {
  const [binomes, commerciaux] = await Promise.all([
    getProgressionBinomes(),
    getProgressionCommerciaux(),
  ]);

  return (
    <main>
      <AdminPageHeader
        title="Objectifs & progression"
        subtitle="Réalisé vs objectif, par binôme et par commercial"
      />

      <div className="space-y-6 p-4 md:p-6">
        <section>
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-700 text-white">
              <Users2 size={14} />
            </span>
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
              Par binôme
            </h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {binomes.map((b) => (
              <div key={b.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
                <p className="mb-3 font-semibold text-slate-800">{b.nom}</p>
                <div className="space-y-2.5">
                  <StatBar label="Aujourd'hui" {...b.jour} />
                  <StatBar label="Cette semaine" {...b.semaine} />
                </div>
              </div>
            ))}
            {binomes.length === 0 && (
              <p className="text-sm text-slate-400">Aucun binôme actif.</p>
            )}
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white">
              <User size={14} />
            </span>
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
              Par commercial
            </h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {commerciaux.map((c) => (
              <div key={c.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
                <p className="font-semibold text-slate-800">{c.nom}</p>
                {c.binomeNom && <p className="mb-3 text-xs text-slate-400">{c.binomeNom}</p>}
                <div className={!c.binomeNom ? "mt-3 space-y-2.5" : "space-y-2.5"}>
                  <StatBar label="Aujourd'hui" {...c.jour} />
                  <StatBar label="Cette semaine" {...c.semaine} />
                  <StatBar label="Ce mois" {...c.mois} />
                </div>
              </div>
            ))}
            {commerciaux.length === 0 && (
              <p className="text-sm text-slate-400">Aucun commercial actif.</p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
