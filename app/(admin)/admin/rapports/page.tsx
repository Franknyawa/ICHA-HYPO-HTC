import { getRapport } from "@/lib/queries/rapports";
import { prisma } from "@/lib/prisma";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { PdfExportButton } from "@/components/admin/PdfExportButton";
import { Banknote, ShoppingCart, Droplet, Sparkles } from "lucide-react";

export default async function RapportsPage({
  searchParams,
}: {
  searchParams: {
    commercialId?: string;
    binomeId?: string;
    villeId?: string;
    quartierId?: string;
    typeId?: string;
    produitCode?: string;
    dateFrom?: string;
    dateTo?: string;
  };
}) {
  const filters = {
    commercialId: searchParams.commercialId || undefined,
    binomeId: searchParams.binomeId || undefined,
    villeId: searchParams.villeId || undefined,
    quartierId: searchParams.quartierId || undefined,
    typeId: searchParams.typeId || undefined,
    produitCode: searchParams.produitCode || undefined,
    dateFrom: searchParams.dateFrom || undefined,
    dateTo: searchParams.dateTo || undefined,
  };

  const [{ lignes, totaux }, commerciaux, binomes, villes, quartiers, types] =
    await Promise.all([
      getRapport(filters),
      prisma.user.findMany({
        where: { role: "COMMERCIAL" },
        orderBy: { nom: "asc" },
        select: { id: true, nom: true, prenom: true },
      }),
      prisma.binome.findMany({ orderBy: { nom: "asc" } }),
      prisma.ville.findMany({ orderBy: { nom: "asc" } }),
      prisma.quartier.findMany({
        where: filters.villeId ? { villeId: filters.villeId } : undefined,
        orderBy: { nom: "asc" },
      }),
      prisma.typePointVente.findMany({ orderBy: { nom: "asc" } }),
    ]);

  const filtreLabel = [
    filters.villeId && villes.find((v) => v.id === filters.villeId)?.nom,
    filters.quartierId && quartiers.find((q) => q.id === filters.quartierId)?.nom,
    filters.typeId && types.find((t) => t.id === filters.typeId)?.nom,
    filters.produitCode,
    filters.dateFrom && `du ${filters.dateFrom}`,
    filters.dateTo && `au ${filters.dateTo}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <main>
      <AdminPageHeader
        title="Rapports"
        subtitle="Filtrable par commercial, binôme, ville, quartier, type, produit, période"
        action={<PdfExportButton lignes={lignes} totaux={totaux} filtreLabel={filtreLabel} />}
      />

      <div className="p-4 md:p-6">
        {/* Filtres */}
        <form
          className="mb-5 grid grid-cols-2 gap-2 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100 md:grid-cols-4"
          action="/admin/rapports"
        >
          <select
            name="commercialId"
            defaultValue={filters.commercialId ?? ""}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">Tous les commerciaux</option>
            {commerciaux.map((c) => (
              <option key={c.id} value={c.id}>
                {c.prenom} {c.nom}
              </option>
            ))}
          </select>
          <select
            name="binomeId"
            defaultValue={filters.binomeId ?? ""}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">Tous les binômes</option>
            {binomes.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nom}
              </option>
            ))}
          </select>
          <select
            name="villeId"
            defaultValue={filters.villeId ?? ""}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">Toutes les villes</option>
            {villes.map((v) => (
              <option key={v.id} value={v.id}>
                {v.nom}
              </option>
            ))}
          </select>
          <select
            name="quartierId"
            defaultValue={filters.quartierId ?? ""}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">Tous les quartiers</option>
            {quartiers.map((q) => (
              <option key={q.id} value={q.id}>
                {q.nom}
              </option>
            ))}
          </select>
          <select
            name="typeId"
            defaultValue={filters.typeId ?? ""}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">Tous les types de boutique</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nom}
              </option>
            ))}
          </select>
          <select
            name="produitCode"
            defaultValue={filters.produitCode ?? ""}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">Tous les produits</option>
            <option value="HYPO">HYPO</option>
            <option value="HTC">HTC</option>
          </select>
          <input
            type="date"
            name="dateFrom"
            defaultValue={filters.dateFrom ?? ""}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
          <input
            type="date"
            name="dateTo"
            defaultValue={filters.dateTo ?? ""}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="col-span-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white md:col-span-4"
          >
            Appliquer les filtres
          </button>
        </form>

        {/* Totaux */}
        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
            <ShoppingCart size={16} className="mb-2 text-indigo-600" />
            <p className="text-xl font-bold text-slate-800">{totaux.nbVentes}</p>
            <p className="text-xs font-medium text-slate-400">Ventes</p>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
            <Banknote size={16} className="mb-2 text-green-600" />
            <p className="text-xl font-bold text-slate-800">
              {totaux.caTotal.toLocaleString("fr-FR")}
            </p>
            <p className="text-xs font-medium text-slate-400">CA (FCFA)</p>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
            <Droplet size={16} className="mb-2 text-blue-600" />
            <p className="text-xl font-bold text-slate-800">{totaux.cartonsHypo}</p>
            <p className="text-xs font-medium text-slate-400">Cartons HYPO</p>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
            <Sparkles size={16} className="mb-2 text-teal-600" />
            <p className="text-xl font-bold text-slate-800">{totaux.cartonsHtc}</p>
            <p className="text-xs font-medium text-slate-400">Cartons HTC</p>
          </div>
        </div>

        {/* Détail par commercial */}
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3">Commercial</th>
                <th className="px-4 py-3">Binôme</th>
                <th className="px-4 py-3">Ventes</th>
                <th className="px-4 py-3">Cartons HYPO</th>
                <th className="px-4 py-3">Cartons HTC</th>
                <th className="px-4 py-3">CA (FCFA)</th>
              </tr>
            </thead>
            <tbody>
              {lignes.map((l) => (
                <tr key={l.commercialId} className="border-t border-slate-100">
                  <td className="px-4 py-2.5 font-medium text-slate-800">
                    {l.commercialNom}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{l.binomeNom ?? "—"}</td>
                  <td className="px-4 py-2.5 text-slate-600">{l.nbVentes}</td>
                  <td className="px-4 py-2.5 text-slate-600">{l.cartonsHypo}</td>
                  <td className="px-4 py-2.5 text-slate-600">{l.cartonsHtc}</td>
                  <td className="px-4 py-2.5 font-semibold text-slate-800">
                    {l.caTotal.toLocaleString("fr-FR")}
                  </td>
                </tr>
              ))}
              {lignes.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    Aucune donnée pour ces filtres.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
