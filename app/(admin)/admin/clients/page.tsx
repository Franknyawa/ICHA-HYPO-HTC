import { getClientsParVille } from "@/lib/queries/clients";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Trophy, MapPin, Phone } from "lucide-react";

export default async function ClientsPage() {
  const groupes = await getClientsParVille();

  return (
    <main>
      <AdminPageHeader
        title="Clients"
        subtitle="Classement par ville, meilleurs clients en tête"
      />

      <div className="space-y-6 p-4 md:p-6">
        {groupes.map((g) => (
          <section key={g.villeNom}>
            <div className="mb-2 flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white">
                <MapPin size={14} />
              </span>
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
                {g.villeNom}
              </h2>
              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-600">
                {g.clients.length}
              </span>
            </div>

            <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
              {g.clients.slice(0, 15).map((c, i) => (
                <div
                  key={c.id}
                  className={`flex items-center justify-between px-4 py-3 ${
                    i > 0 ? "border-t border-slate-100" : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                        i === 0
                          ? "bg-amber-100 text-amber-700"
                          : i === 1
                          ? "bg-slate-200 text-slate-600"
                          : i === 2
                          ? "bg-orange-100 text-orange-700"
                          : "bg-slate-50 text-slate-400"
                      }`}
                    >
                      {i < 3 ? <Trophy size={13} /> : i + 1}
                    </span>
                    <div>
                      <p className="font-medium text-slate-800">{c.nom}</p>
                      <p className="text-xs text-slate-400">{c.pointVenteNom}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-right">
                    {c.telephone && (
                      <a
                        href={`https://wa.me/${c.telephone.replace(/[^\d]/g, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-green-600"
                      >
                        <Phone size={15} />
                      </a>
                    )}
                    <div>
                      <p className="text-sm font-bold text-slate-800">
                        {c.nbCommandes} cmd.
                      </p>
                      <p className="text-xs text-slate-400">{c.nbVentes} ventes</p>
                    </div>
                  </div>
                </div>
              ))}
              {g.clients.length === 0 && (
                <p className="px-4 py-6 text-center text-sm text-slate-400">
                  Aucun client.
                </p>
              )}
            </div>
          </section>
        ))}

        {groupes.length === 0 && (
          <p className="text-sm text-slate-400">Aucun client enregistré.</p>
        )}
      </div>
    </main>
  );
}
