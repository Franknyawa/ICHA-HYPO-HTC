import Link from "next/link";
import { ChevronLeft, ChevronRight, Receipt } from "lucide-react";
import { listVentes } from "@/lib/queries/ventes";
import { prisma } from "@/lib/prisma";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { FactureButton } from "@/components/admin/FactureButton";

function buildQuery(params: Record<string, string | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
  return sp.toString();
}

export default async function FacturesPage({
  searchParams,
}: {
  searchParams: { page?: string; commercialId?: string; villeId?: string; dateFrom?: string; dateTo?: string };
}) {
  const page = Number(searchParams.page ?? "1") || 1;
  const commercialId = searchParams.commercialId ?? "";
  const villeId = searchParams.villeId ?? "";
  const dateFrom = searchParams.dateFrom ?? "";
  const dateTo = searchParams.dateTo ?? "";

  const [{ data, pagination }, villes, commerciaux] = await Promise.all([
    listVentes({ page, commercialId, villeId, dateFrom, dateTo }),
    prisma.ville.findMany({ orderBy: { nom: "asc" } }),
    prisma.user.findMany({
      where: { role: "COMMERCIAL" },
      orderBy: { nom: "asc" },
      select: { id: true, nom: true, prenom: true },
    }),
  ]);

  const baseQuery = { commercialId, villeId, dateFrom, dateTo };

  return (
    <main>
      <AdminPageHeader title="Factures générées" subtitle={`${pagination.total} ventes au total`} />

      <div className="p-4 md:p-6">
        <form className="mb-4 grid grid-cols-2 gap-2 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100 md:grid-cols-4" action="/admin/factures">
          <select name="commercialId" defaultValue={commercialId} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
            <option value="">Tous les commerciaux</option>
            {commerciaux.map((c) => (
              <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>
            ))}
          </select>
          <select name="villeId" defaultValue={villeId} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
            <option value="">Toutes les villes</option>
            {villes.map((v) => (
              <option key={v.id} value={v.id}>{v.nom}</option>
            ))}
          </select>
          <input type="date" name="dateFrom" defaultValue={dateFrom} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
          <input type="date" name="dateTo" defaultValue={dateTo} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
          <button type="submit" className="col-span-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white md:col-span-4">
            Filtrer
          </button>
        </form>

        <div className="space-y-2">
          {data.map((v) => (
            <div key={v.id} className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-brand">
                  <Receipt size={16} />
                </span>
                <div>
                  <p className="font-medium text-slate-800">{v.pointVente.nom}</p>
                  <p className="text-xs text-slate-500">
                    {v.commercial.prenom} {v.commercial.nom} · {v.pointVente.ville?.nom ?? "—"} ·{" "}
                    {new Date(v.createdAt).toLocaleDateString("fr-FR")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <p className="text-sm font-bold text-slate-800">
                  {Number(v.montantTotal).toLocaleString("fr-FR")} FCFA
                </p>
                <FactureButton vente={v as any} />
              </div>
            </div>
          ))}
          {data.length === 0 && (
            <p className="rounded-2xl bg-white py-10 text-center text-sm text-slate-400 shadow-sm ring-1 ring-slate-100">
              Aucune vente trouvée.
            </p>
          )}
        </div>

        <div className="mt-5 flex items-center justify-between text-sm text-slate-500">
          <span>Page {pagination.page} / {pagination.totalPages}</span>
          <div className="flex gap-2">
            <Link
              href={`/admin/factures?${buildQuery({ ...baseQuery, page: String(pagination.page - 1) })}`}
              aria-disabled={pagination.page <= 1}
              className={`flex items-center gap-1 rounded-xl border px-3 py-1.5 font-medium ${
                pagination.page <= 1 ? "pointer-events-none border-slate-100 text-slate-300" : "border-slate-200 text-slate-600"
              }`}
            >
              <ChevronLeft size={15} />
              Précédent
            </Link>
            <Link
              href={`/admin/factures?${buildQuery({ ...baseQuery, page: String(pagination.page + 1) })}`}
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
