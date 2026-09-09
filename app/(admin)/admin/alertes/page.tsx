import { listAlertes } from "@/lib/queries/alertes";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ResoudreButton, GenererAlertesButton } from "@/components/admin/AlerteActions";
import {
  Package,
  Clock,
  Truck,
  CreditCard,
  UserPlus,
  UserX,
  TrendingDown,
  BellOff,
} from "lucide-react";

const CONFIG_TYPE: Record<string, { label: string; icon: React.ElementType; couleur: string; bg: string }> = {
  STOCK_FAIBLE: { label: "Stock faible", icon: Package, couleur: "#b45309", bg: "#fffbeb" },
  COMMANDE_EN_ATTENTE: { label: "Livraison à venir", icon: Clock, couleur: "#1e40af", bg: "#eff6ff" },
  LIVRAISON_RETARD: { label: "Livraison en retard", icon: Truck, couleur: "#b91c1c", bg: "#fef2f2" },
  CREDIT_RETARD: { label: "Crédit en retard", icon: CreditCard, couleur: "#b91c1c", bg: "#fef2f2" },
  PROSPECT_A_RELANCER: { label: "Prospect à relancer", icon: UserPlus, couleur: "#4338ca", bg: "#eef2ff" },
  CLIENT_INACTIF: { label: "Client inactif", icon: UserX, couleur: "#475569", bg: "#f8fafc" },
  OBJECTIF_NON_ATTEINT: { label: "Objectif non atteint", icon: TrendingDown, couleur: "#b45309", bg: "#fffbeb" },
};

export default async function AlertesPage({
  searchParams,
}: {
  searchParams: { type?: string };
}) {
  const alertes = await listAlertes({ type: searchParams.type });
  const toutesLesAlertes = searchParams.type ? await listAlertes({}) : alertes;

  const parType = new Map<string, number>();
  for (const a of toutesLesAlertes) {
    parType.set(a.type, (parType.get(a.type) ?? 0) + 1);
  }

  return (
    <main>
      <AdminPageHeader
        title="Alertes"
        subtitle={`${alertes.length} alerte${alertes.length > 1 ? "s" : ""} active${alertes.length > 1 ? "s" : ""}`}
        action={<GenererAlertesButton />}
      />

      <div className="p-4 md:p-6">
        {/* Filtres rapides par type */}
        <div className="mb-4 flex flex-wrap gap-2">
          <a
            href="/admin/alertes"
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              !searchParams.type ? "bg-brand text-white" : "bg-white text-slate-500 ring-1 ring-slate-200"
            }`}
          >
            Toutes ({toutesLesAlertes.length})
          </a>
          {Object.entries(CONFIG_TYPE).map(([type, c]) => {
            const count = parType.get(type) ?? 0;
            if (count === 0 && searchParams.type !== type) return null;
            return (
              <a
                key={type}
                href={`/admin/alertes?type=${type}`}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                  searchParams.type === type ? "bg-brand text-white" : "bg-white text-slate-500 ring-1 ring-slate-200"
                }`}
              >
                {c.label} ({count})
              </a>
            );
          })}
        </div>

        {alertes.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-white py-16 shadow-sm ring-1 ring-slate-100">
            <BellOff size={28} className="text-slate-300" />
            <p className="text-sm text-slate-400">Aucune alerte active — tout est en ordre.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {alertes.map((a) => {
              const config = CONFIG_TYPE[a.type];
              const Icon = config.icon;
              return (
                <div
                  key={a.id}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                      style={{ backgroundColor: config.bg, color: config.couleur }}
                    >
                      <Icon size={16} />
                    </span>
                    <div>
                      <p
                        className="text-[10px] font-bold uppercase tracking-wide"
                        style={{ color: config.couleur }}
                      >
                        {config.label}
                      </p>
                      <p className="text-sm text-slate-700">{a.message}</p>
                      <p className="text-xs text-slate-400">
                        {new Date(a.createdAt).toLocaleDateString("fr-FR")}
                      </p>
                    </div>
                  </div>
                  <ResoudreButton id={a.id} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
