import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { listHistoriqueVisites } from "@/lib/queries/historique-visites";
import {
  ArrowLeft,
  ClipboardList,
  RefreshCw,
  Package,
  MapPin,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const CONFIG_TYPE: Record<string, { label: string; icon: React.ElementType; couleur: string }> = {
  recensement: { label: "Nouveau recensement", icon: ClipboardList, couleur: "#1e40af" },
  rotation: { label: "Rotation et achalandage", icon: RefreshCw, couleur: "#4338ca" },
  reassort: { label: "Réassort", icon: Package, couleur: "#0f766e" },
  autre: { label: "Visite", icon: MapPin, couleur: "#64748b" },
};

export default async function HistoriquePage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const session = await getSession();
  if (!session) return null;

  const page = Number(searchParams.page ?? "1") || 1;
  const { data, pagination } = await listHistoriqueVisites(session.userId, page);

  return (
    <main className="min-h-screen bg-slate-50 pb-10">
      <div
        className="px-4 pb-6 pt-6 text-white"
        style={{ background: "linear-gradient(135deg, #1e3a8a 0%, #1e40af 55%, #2563eb 100%)" }}
      >
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-widest text-blue-100">
            HYPO / HTC / ICHA IMPORT
          </p>
          <Link href="/dashboard" className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15">
            <ArrowLeft size={16} />
          </Link>
        </div>
        <h1 className="text-xl font-extrabold">Historique des visites</h1>
        <p className="text-sm text-blue-100">{pagination.total} visite(s) au total</p>
      </div>

      <div className="-mt-3 space-y-2 px-4 pt-1">
        {data.map((v) => {
          const config = CONFIG_TYPE[v.typeVisite];
          const Icon = config.icon;
          return (
            <div key={v.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
              <div className="mb-1.5 flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white"
                    style={{ backgroundColor: config.couleur }}
                  >
                    <Icon size={16} />
                  </span>
                  <div>
                    <p className="font-semibold text-slate-800">{v.pointVenteNom}</p>
                    <p className="text-xs text-slate-400">
                      {config.label}
                      {v.villeNom ? ` · ${v.villeNom}` : ""}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-slate-400">
                  {new Date(v.dateVisite).toLocaleDateString("fr-FR")}
                </span>
              </div>
              {v.montantVente > 0 && (
                <p className="mt-1 text-sm font-bold text-teal-700">
                  {v.montantVente.toLocaleString("fr-FR")} FCFA
                </p>
              )}
              {v.observation && (
                <p className="mt-1.5 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  {v.observation}
                </p>
              )}
            </div>
          );
        })}

        {data.length === 0 && (
          <p className="rounded-2xl bg-white py-10 text-center text-sm text-slate-400 shadow-sm ring-1 ring-slate-100">
            Aucune visite enregistrée pour l'instant.
          </p>
        )}

        {pagination.totalPages > 1 && (
          <div className="mt-3 flex items-center justify-between text-sm text-slate-500">
            <Link
              href={`/historique?page=${pagination.page - 1}`}
              aria-disabled={pagination.page <= 1}
              className={`flex items-center gap-1 rounded-xl border px-3 py-1.5 font-medium ${
                pagination.page <= 1 ? "pointer-events-none border-slate-100 text-slate-300" : "border-slate-200 bg-white text-slate-600"
              }`}
            >
              <ChevronLeft size={15} />
              Précédent
            </Link>
            <span>Page {pagination.page} / {pagination.totalPages}</span>
            <Link
              href={`/historique?page=${pagination.page + 1}`}
              aria-disabled={pagination.page >= pagination.totalPages}
              className={`flex items-center gap-1 rounded-xl border px-3 py-1.5 font-medium ${
                pagination.page >= pagination.totalPages ? "pointer-events-none border-slate-100 text-slate-300" : "border-slate-200 bg-white text-slate-600"
              }`}
            >
              Suivant
              <ChevronRight size={15} />
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
