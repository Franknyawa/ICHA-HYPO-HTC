import Link from "next/link";
import { Phone, Truck, Clock, XCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { listCommandes } from "@/lib/queries/commandes";
import { prisma } from "@/lib/prisma";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { CommandeStatusActions } from "@/components/admin/CommandeStatusActions";

function waUrl(tel: string | null) {
  if (!tel) return null;
  return `https://wa.me/${tel.replace(/[^\d]/g, "")}`;
}

function StatutBadge({ statut }: { statut: "EN_ATTENTE" | "LIVREE" | "ANNULEE" }) {
  const config = {
    EN_ATTENTE: { label: "En attente", cls: "bg-amber-50 text-amber-700", icon: Clock },
    LIVREE: { label: "Livrée", cls: "bg-green-50 text-green-700", icon: Truck },
    ANNULEE: { label: "Annulée", cls: "bg-red-50 text-alert", icon: XCircle },
  }[statut];
  const Icon = config.icon;
  return (
    <span className={`flex w-fit items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${config.cls}`}>
      <Icon size={12} />
      {config.label}
    </span>
  );
}

function buildQuery(params: Record<string, string | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
  return sp.toString();
}

export default async function CommandesPage({
  searchParams,
}: {
  searchParams: {
    page?: string;
    statut?: string;
    villeId?: string;
    commercialId?: string;
    dateFrom?: string;
    dateTo?: string;
  };
}) {
  const page = Number(searchParams.page ?? "1") || 1;
  const statut = (searchParams.statut as "EN_ATTENTE" | "LIVREE" | "ANNULEE" | undefined) ?? undefined;
  const villeId = searchParams.villeId ?? "";
  const commercialId = searchParams.commercialId ?? "";
  const dateFrom = searchParams.dateFrom ?? "";
  const dateTo = searchParams.dateTo ?? "";

  const [{ data, pagination }, villes, commerciaux] = await Promise.all([
    listCommandes({ page, statut, villeId, commercialId, dateFrom, dateTo }),
    prisma.ville.findMany({ orderBy: { nom: "asc" } }),
    prisma.user.findMany({
      where: { role: "COMMERCIAL" },
      orderBy: { nom: "asc" },
      select: { id: true, nom: true, prenom: true },
    }),
  ]);

  const baseQuery = { statut, villeId, commercialId, dateFrom, dateTo };

  return (
    <main>
      <AdminPageHeader title="Commandes" subtitle={`${pagination.total} au total`} />

      <div className="p-4 md:p-6">
        {/* Filtres */}
        <form className="mb-4 grid grid-cols-2 gap-2 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100 md:grid-cols-4" action="/admin/commandes">
          <select name="statut" defaultValue={statut ?? ""} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
            <option value="">Tous les statuts</option>
            <option value="EN_ATTENTE">En attente</option>
            <option value="LIVREE">Livrée</option>
            <option value="ANNULEE">Annulée</option>
          </select>
          <select name="villeId" defaultValue={villeId} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
            <option value="">Toutes les villes</option>
            {villes.map((v) => (
              <option key={v.id} value={v.id}>{v.nom}</option>
            ))}
          </select>
          <select name="commercialId" defaultValue={commercialId} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
            <option value="">Tous les commerciaux</option>
            {commerciaux.map((c) => (
              <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input type="date" name="dateFrom" defaultValue={dateFrom} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            <input type="date" name="dateTo" defaultValue={dateTo} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
          </div>
          <button type="submit" className="col-span-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white md:col-span-4">
            Filtrer
          </button>
        </form>

        {/* Liste */}
        <div className="space-y-2">
          {data.map((c) => {
            const wa = waUrl(c.pointVente.telephoneVendeur);
            return (
              <div key={c.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-800">
                      {c.client?.nom ?? c.pointVente.nom}
                    </p>
                    <p className="text-xs text-slate-500">
                      {c.pointVente.nom} · {c.pointVente.ville?.nom ?? "—"} · {c.commercial.prenom} {c.commercial.nom}
                    </p>
                  </div>
                  <StatutBadge statut={c.statut} />
                </div>

                <div className="mb-2 flex flex-wrap gap-2">
                  {c.lignes.map((l, i) => (
                    <span
                      key={i}
                      className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
                        l.produit.code === "HYPO" ? "bg-blue-50 text-blue-700" : "bg-teal-50 text-teal-700"
                      }`}
                    >
                      {l.produit.code} — {l.nbCartons} cartons
                      {l.nbFilets > 0 ? `, ${l.nbFilets} filets` : ""}
                      {l.nbSachets > 0 ? `, ${l.nbSachets} sachets` : ""}
                    </span>
                  ))}
                </div>

                <div className="flex items-center justify-between text-xs text-slate-400">
                  <div>
                    <p>Commandée le {new Date(c.dateCommande).toLocaleDateString("fr-FR")}</p>
                    {c.dateLivraisonPrevue && (
                      <p>Livraison prévue le {new Date(c.dateLivraisonPrevue).toLocaleDateString("fr-FR")}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {wa && (
                      <a href={wa} target="_blank" rel="noopener noreferrer" className="text-green-600">
                        <Phone size={15} />
                      </a>
                    )}
                    <CommandeStatusActions id={c.id} statut={c.statut} />
                  </div>
                </div>
              </div>
            );
          })}
          {data.length === 0 && (
            <p className="rounded-2xl bg-white py-10 text-center text-sm text-slate-400 shadow-sm ring-1 ring-slate-100">
              Aucune commande trouvée.
            </p>
          )}
        </div>

        {/* Pagination */}
        <div className="mt-5 flex items-center justify-between text-sm text-slate-500">
          <span>Page {pagination.page} / {pagination.totalPages}</span>
          <div className="flex gap-2">
            <Link
              href={`/admin/commandes?${buildQuery({ ...baseQuery, page: String(pagination.page - 1) })}`}
              aria-disabled={pagination.page <= 1}
              className={`flex items-center gap-1 rounded-xl border px-3 py-1.5 font-medium ${
                pagination.page <= 1 ? "pointer-events-none border-slate-100 text-slate-300" : "border-slate-200 text-slate-600"
              }`}
            >
              <ChevronLeft size={15} />
              Précédent
            </Link>
            <Link
              href={`/admin/commandes?${buildQuery({ ...baseQuery, page: String(pagination.page + 1) })}`}
              aria-disabled={pagination.page >= pagination.totalPages}
              className={`flex items-center gap-1 rounded-xl border px-3 py-1.5 font-medium ${
                pagination.page >= pagination.totalPages ? "pointer-events-none border-slate-100 text-slate-300" : "border-slate-200 text-slate-600"
              }`}
            >
              Suivant
              <ChevronRight size={15} />
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
