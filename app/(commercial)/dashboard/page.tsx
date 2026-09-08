import { getSession } from "@/lib/auth/session";
import Link from "next/link";
import {
  getStatsPersonnelles,
  getStatsBinome,
  getCommandesEnAttente,
} from "@/lib/queries/commercial-stats";
import { SyncStatusBanner } from "@/components/SyncStatusBanner";
import { LogoutButton } from "@/components/LogoutButton";
import { ClipboardList, RefreshCw, Package, Clock, Users2, User } from "lucide-react";

const COULEUR_CLASSES: Record<string, { bar: string; text: string; bg: string }> = {
  vert: { bar: "bg-green-500", text: "text-green-700", bg: "bg-green-50" },
  orange: { bar: "bg-amber-500", text: "text-amber-700", bg: "bg-amber-50" },
  rouge: { bar: "bg-red-500", text: "text-alert", bg: "bg-red-50" },
};

function StatBar({
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
          className={`h-full rounded-full ${c.bar}`}
          style={{ width: `${Math.min(100, pourcentage)}%` }}
        />
      </div>
      <p className="text-xs text-slate-500">
        {realise} / {objectif} cartons
      </p>
    </div>
  );
}

export default async function CommercialDashboardPage() {
  const session = await getSession();
  if (!session) return null;

  const [statsPerso, statsBinome, commandesEnAttente] = await Promise.all([
    getStatsPersonnelles(session.userId),
    session.binomeId ? getStatsBinome(session.binomeId) : Promise.resolve(null),
    getCommandesEnAttente(session.userId),
  ]);

  return (
    <main className="min-h-screen bg-slate-50 p-4 pb-10">
      <div className="mb-4 flex items-center justify-between">
        <SyncStatusBanner />
        <LogoutButton className="flex items-center gap-1.5 rounded-full bg-white px-3 py-2 text-xs font-medium text-slate-500 shadow-sm" />
      </div>

      <h1 className="text-lg font-semibold text-blue-800">
        Bonjour {session.prenom} {session.nom}
      </h1>
      {session.binomeNom && (
        <p className="mb-4 text-sm text-slate-500">{session.binomeNom}</p>
      )}

      {/* Actions terrain */}
      <div className="mb-5 grid grid-cols-1 gap-2.5">
        <Link
          href="/visites/new"
          className="flex items-center justify-center gap-2 rounded-xl bg-blue-700 py-4 text-center text-base font-semibold text-white"
        >
          <ClipboardList size={19} />
          Nouveau recensement
        </Link>
        {/* Boutons à venir — pas encore de page dédiée, volontairement
            inertes pour l'instant (demande de Victor). */}
        <button
          disabled
          className="flex items-center justify-center gap-2 rounded-xl bg-white py-3.5 text-sm font-medium text-slate-400 ring-1 ring-slate-200"
        >
          <RefreshCw size={17} />
          Visite de rotation et d'achalandage
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold">
            Bientôt
          </span>
        </button>
        <button
          disabled
          className="flex items-center justify-center gap-2 rounded-xl bg-white py-3.5 text-sm font-medium text-slate-400 ring-1 ring-slate-200"
        >
          <Package size={17} />
          Visite de réassort
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold">
            Bientôt
          </span>
        </button>
      </div>

      {/* Statistiques personnelles */}
      <section className="mb-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
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
        <section className="mb-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
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

      {/* Commandes en attente — rappel */}
      {commandesEnAttente.length > 0 && (
        <section className="rounded-2xl bg-amber-50 p-4">
          <div className="mb-2 flex items-center gap-2">
            <Clock size={16} className="text-amber-700" />
            <h2 className="text-sm font-bold text-amber-800">
              {commandesEnAttente.length} commande(s) en attente
            </h2>
          </div>
          <div className="space-y-1.5">
            {commandesEnAttente.map((c) => (
              <div key={c.id} className="rounded-lg bg-white px-3 py-2 text-sm">
                <span className="font-medium text-slate-700">{c.pointVente.nom}</span>
                {c.dateLivraisonPrevue && (
                  <span className="ml-2 text-xs text-slate-400">
                    livraison le {new Date(c.dateLivraisonPrevue).toLocaleDateString("fr-FR")}
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
