import { getSession } from "@/lib/auth/session";
import {
  getDashboardKpis,
  getCaParBinomeEtVendeur,
  getObservationsRecentes,
} from "@/lib/queries/dashboard";
import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { CaChart, CartonsChart, PrintButton } from "@/components/admin/DashboardCharts";
import {
  MapPin,
  Users,
  UserCheck,
  ShoppingCart,
  Clock,
  Banknote,
  Wallet,
  CreditCard,
  Droplet,
  Sparkles,
  NotebookPen,
} from "lucide-react";

function formatFcfa(n: number) {
  return new Intl.NumberFormat("fr-FR").format(n) + " FCFA";
}

function KpiCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
      <div
        className="mb-2.5 flex h-9 w-9 items-center justify-center rounded-lg text-white"
        style={{ backgroundColor: color }}
      >
        <Icon size={17} strokeWidth={2.25} />
      </div>
      <p className="text-xl font-bold text-slate-800">{value}</p>
      <p className="text-xs font-medium text-slate-400">{label}</p>
    </div>
  );
}

export default async function AdminDashboardPage() {
  const session = await getSession();
  const kpis = await getDashboardKpis();
  const { parBinome, parVendeur } = await getCaParBinomeEtVendeur();
  const observations = await getObservationsRecentes();

  return (
    <main className="pb-10">
      <AdminPageHeader
        title={`Bonjour ${session?.prenom ?? ""} ${session?.nom ?? ""}`}
        subtitle="Vue d'ensemble de l'activité du jour"
        action={<PrintButton />}
      />

      <div className="px-4 pt-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard icon={MapPin} label="Visites aujourd'hui" value={kpis.visitesAujourdhui} color="#4338ca" />
          <KpiCard icon={Users} label="Prospects (total)" value={kpis.prospectsTotal} color="#4338ca" />
          <KpiCard icon={UserCheck} label="Clients (total)" value={kpis.clientsTotal} color="#1e40af" />
          <KpiCard icon={ShoppingCart} label="Ventes aujourd'hui" value={kpis.ventesAujourdhui} color="#1e40af" />
          <KpiCard icon={Clock} label="Commandes en attente" value={kpis.commandesEnAttente} color="#b45309" />
          <KpiCard icon={Droplet} label="Cartons HYPO vendus" value={kpis.cartonsHypo} color="#1e40af" />
          <KpiCard icon={Sparkles} label="Cartons HTC vendus" value={kpis.cartonsHtc} color="#0f766e" />
          <KpiCard icon={Banknote} label="CA du jour" value={formatFcfa(kpis.caAujourdhui)} color="#15803d" />
          <KpiCard icon={Wallet} label="Encaissements" value={formatFcfa(kpis.encaissements)} color="#15803d" />
          <KpiCard icon={CreditCard} label="Crédits en cours" value={formatFcfa(kpis.credits)} color="#b91c1c" />
          <KpiCard
            icon={Droplet}
            label="Stock HYPO"
            value={`${kpis.stockHypoCartons} cartons`}
            color="#1e40af"
          />
          <KpiCard
            icon={Sparkles}
            label="Stock HTC"
            value={`${kpis.stockHtcCartons} cartons`}
            color="#0f766e"
          />
        </div>

        {/* Graphiques — CA par binôme/vendeur et cartons HYPO/HTC, imprimables */}
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <CaChart title="CA du jour par binôme" items={parBinome} />
          <CaChart title="CA du jour par vendeur" items={parVendeur} />
        </div>
        <div className="mt-3">
          <CartonsChart cartonsHypo={kpis.cartonsHypo} cartonsHtc={kpis.cartonsHtc} />
        </div>

        {/* Observations terrain récentes — demande de Victor */}
        <div className="mt-5 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-600 text-white">
              <NotebookPen size={15} />
            </span>
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
              Observations récentes
            </h2>
          </div>
          <div className="space-y-3">
            {observations.map((o) => (
              <div key={o.id} className="border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                <p className="text-sm text-slate-700">{o.observation}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {o.commercial.prenom} {o.commercial.nom} · {o.pointVente.nom} ·{" "}
                  {new Date(o.dateVisite).toLocaleDateString("fr-FR")}
                </p>
              </div>
            ))}
            {observations.length === 0 && (
              <p className="text-sm text-slate-400">Aucune observation pour le moment.</p>
            )}
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <Link
            href="/admin/points-vente"
            className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100"
          >
            <p className="font-semibold text-slate-800">Points de vente</p>
            <p className="text-sm text-slate-500">Consulter et rechercher</p>
          </Link>
          <Link
            href="/admin/utilisateurs"
            className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100"
          >
            <p className="font-semibold text-slate-800">Utilisateurs</p>
            <p className="text-sm text-slate-500">
              Comptes commerciaux et admin, réinitialisation de mot de passe
            </p>
          </Link>
        </div>
      </div>
    </main>
  );
}
