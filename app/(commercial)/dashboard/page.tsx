import { getSession } from "@/lib/auth/session";
import Link from "next/link";
import {
  getStatsPersonnelles,
  getStatsBinome,
  getCommandesEnAttente,
} from "@/lib/queries/commercial-stats";
import { getCreditsCommercial } from "@/lib/queries/credits";
import { SyncStatusBanner } from "@/components/SyncStatusBanner";
import { LogoutButton } from "@/components/LogoutButton";
import { LocationHeartbeat } from "@/components/commercial/LocationHeartbeat";
import { StatBar } from "@/components/StatBar";
import {
  ClipboardList,
  RefreshCw,
  Package,
  Clock,
  Users2,
  User,
  Droplet,
  AlertTriangle,
  CreditCard,
} from "lucide-react";

export default async function CommercialDashboardPage() {
  const session = await getSession();
  if (!session) return null;

  const [statsPerso, statsBinome, commandesEnAttente, credits] = await Promise.all([
    getStatsPersonnelles(session.userId),
    session.binomeId ? getStatsBinome(session.binomeId) : Promise.resolve(null),
    getCommandesEnAttente(session.userId),
    getCreditsCommercial(session.userId),
  ]);

  const nbAlertes = commandesEnAttente.length + (credits.total > 0 ? 1 : 0);

  return (
    <main className="min-h-screen bg-slate-50 pb-10">
      <LocationHeartbeat />
      {/* En-tête */}
      <div
        className="px-4 pb-7 pt-6 text-white"
        style={{ background: "linear-gradient(135deg, #1e3a8a 0%, #1e40af 55%, #2563eb 100%)" }}
      >
        <div className="mb-3 flex items-center justify-between">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15">
            <Droplet size={16} />
          </span>
          <LogoutButton className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium text-white" />
        </div>
        <h1 className="text-xl font-extrabold">
          Bonjour {session.prenom} {session.nom}
        </h1>
        {session.binomeNom && (
          <p className="text-sm text-blue-100">{session.binomeNom}</p>
        )}
      </div>

      <div className="-mt-4 space-y-4 px-4">
        <SyncStatusBanner />

        {/* Actions terrain */}
        <div className="grid grid-cols-1 gap-2.5">
          <Link
            href="/visites/new"
            className="flex items-center justify-center gap-2 rounded-2xl bg-blue-700 py-4 text-center text-base font-bold text-white shadow-sm"
          >
            <ClipboardList size={19} />
            Nouveau recensement
          </Link>
          <Link
            href="/visites/rotation"
            className="flex items-center justify-center gap-2 rounded-2xl bg-white py-3.5 text-sm font-semibold text-indigo-700 shadow-sm ring-1 ring-slate-100"
          >
            <RefreshCw size={17} />
            Visite de rotation et d'achalandage
          </Link>
          <Link
            href="/visites/reassort"
            className="flex items-center justify-center gap-2 rounded-2xl bg-white py-3.5 text-sm font-semibold text-teal-700 shadow-sm ring-1 ring-slate-100"
          >
            <Package size={17} />
            Visite de réassort
          </Link>
          <Link
            href="/historique"
            className="text-center text-xs font-medium text-slate-400 underline underline-offset-2"
          >
            Voir l'historique de mes visites
          </Link>
        </div>

        {/* Alertes — commandes en attente + crédits actifs */}
        {nbAlertes > 0 && (
          <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
            <div className="flex items-center gap-2 bg-amber-50 px-4 py-3">
              <AlertTriangle size={16} className="text-amber-700" />
              <h2 className="text-sm font-bold text-amber-800">
                {nbAlertes} alerte{nbAlertes > 1 ? "s" : ""}
              </h2>
            </div>

            {credits.total > 0 && (
              <div className="border-b border-slate-100 px-4 py-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-alert">
                      <CreditCard size={15} />
                    </span>
                    <p className="text-sm font-semibold text-slate-800">
                      {credits.detail.length} crédit{credits.detail.length > 1 ? "s" : ""} en cours
                    </p>
                  </div>
                  <span className="text-sm font-bold text-alert">
                    {credits.total.toLocaleString("fr-FR")} FCFA
                  </span>
                </div>
                <div className="space-y-1.5 pl-1">
                  {credits.detail.slice(0, 4).map((c) => (
                    <div key={c.venteId} className="rounded-lg bg-red-50/50 px-3 py-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-slate-700">{c.pointVenteNom}</span>
                        <span className="font-bold text-alert">
                          {c.montantDu.toLocaleString("fr-FR")} FCFA
                        </span>
                      </div>
                      <span className="text-xs text-slate-400">
                        Vendu le {new Date(c.dateVente).toLocaleDateString("fr-FR")}
                      </span>
                    </div>
                  ))}
                  {credits.detail.length > 4 && (
                    <p className="text-center text-xs text-slate-400">
                      + {credits.detail.length - 4} autre(s)
                    </p>
                  )}
                </div>
              </div>
            )}

            {commandesEnAttente.length > 0 && (
              <div className="px-4 py-3">
                <div className="mb-2 flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
                    <Clock size={15} />
                  </span>
                  <p className="text-sm font-semibold text-slate-800">
                    {commandesEnAttente.length} commande{commandesEnAttente.length > 1 ? "s" : ""} en attente
                  </p>
                </div>
                <div className="space-y-1.5 pl-1">
                  {commandesEnAttente.slice(0, 4).map((c) => (
                    <div key={c.id} className="rounded-lg bg-amber-50/60 px-3 py-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-slate-700">{c.pointVente.nom}</span>
                        <span className="font-bold text-amber-800">
                          {c.montantEstime.toLocaleString("fr-FR")} FCFA
                        </span>
                      </div>
                      {c.dateLivraisonPrevue && (
                        <span className="text-xs text-slate-400">
                          Livraison le {new Date(c.dateLivraisonPrevue).toLocaleDateString("fr-FR")}
                        </span>
                      )}
                    </div>
                  ))}
                  {commandesEnAttente.length > 4 && (
                    <p className="text-center text-xs text-slate-400">
                      + {commandesEnAttente.length - 4} autre(s)
                    </p>
                  )}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Statistiques personnelles */}
        <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white">
              <User size={14} />
            </span>
            <h2 className="text-sm font-bold text-slate-700">Mes performances</h2>
          </div>
          <div className="space-y-2.5">
            <StatBar label="Aujourd'hui" {...statsPerso.jour} />
            <StatBar label="Cette semaine" {...statsPerso.semaine} />
            <StatBar label="Ce mois" {...statsPerso.mois} />
          </div>
        </section>

        {/* Statistiques du binôme */}
        {statsBinome && (
          <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-700 text-white">
                <Users2 size={14} />
              </span>
              <h2 className="text-sm font-bold text-slate-700">
                {session.binomeNom ?? "Mon binôme"}
              </h2>
            </div>
            <div className="space-y-2.5">
              <StatBar label="Aujourd'hui" {...statsBinome.jour} />
              <StatBar label="Cette semaine" {...statsBinome.semaine} />
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
