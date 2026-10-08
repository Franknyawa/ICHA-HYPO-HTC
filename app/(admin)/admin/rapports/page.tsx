import Link from "next/link";
import { getRapport, type RapportVue } from "@/lib/queries/rapports";
import { prisma } from "@/lib/prisma";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { PdfExportButton } from "@/components/admin/PdfExportButton";
import { ImprimerButton } from "@/components/admin/ImprimerButton";
import { formatMontant } from "@/lib/utils/format";
import {
  Banknote,
  ShoppingCart,
  Droplet,
  Sparkles,
  Users2,
  Store,
  Building2,
  MapPin,
  Receipt,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { requireAdminPage } from "@/lib/auth/rbac";

// Données live (base de données) : jamais pré-généré statiquement au build
// (évite d'épuiser le pool de connexions Prisma pendant `next build`, et
// une page admin ne doit de toute façon jamais servir de données figées).
export const dynamic = "force-dynamic";

const CATEGORIES: { vue: RapportVue; label: string; icon: React.ElementType }[] = [
  { vue: "commercial", label: "Par commercial", icon: Users2 },
  { vue: "point_vente", label: "Par point de vente", icon: Store },
  { vue: "ville", label: "Par ville", icon: Building2 },
  { vue: "quartier", label: "Par quartier", icon: MapPin },
  { vue: "vente", label: "Par vente", icon: Receipt },
];

const TITRE_VUE: Record<RapportVue, string> = {
  commercial: "Rapport par commercial",
  point_vente: "Rapport par point de vente",
  ville: "Rapport par ville",
  quartier: "Rapport par quartier",
  vente: "Rapport détaillé des ventes",
};

// Espace normal comme séparateur de milliers (pas .toLocaleString, dont
// l'espace insécable étroit U+202F casse le rendu dans les PDF jsPDF —
// voir lib/utils/format.ts).
const fcfa = formatMontant;

function buildQuery(params: Record<string, string | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
  return sp.toString();
}

export default async function RapportsPage({
  searchParams,
}: {
  searchParams: {
    vue?: string;
    page?: string;
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
  await requireAdminPage();
  const vue: RapportVue = (CATEGORIES.find((c) => c.vue === searchParams.vue)?.vue ?? "commercial");
  const page = Number(searchParams.page ?? "1") || 1;

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

  const [resultat, commerciaux, binomes, villes, quartiers, types] = await Promise.all([
    getRapport(filters, vue, page),
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

  const { totaux, lignes, pagination } = resultat;

  const filtreLabel = [
    filters.commercialId && (() => {
      const c = commerciaux.find((x) => x.id === filters.commercialId);
      return c ? `${c.prenom} ${c.nom}` : undefined;
    })(),
    filters.binomeId && binomes.find((b) => b.id === filters.binomeId)?.nom,
    filters.villeId && villes.find((v) => v.id === filters.villeId)?.nom,
    filters.quartierId && quartiers.find((q) => q.id === filters.quartierId)?.nom,
    filters.typeId && types.find((t) => t.id === filters.typeId)?.nom,
    filters.produitCode,
    filters.dateFrom && `du ${filters.dateFrom}`,
    filters.dateTo && `au ${filters.dateTo}`,
  ]
    .filter(Boolean)
    .join(" · ");

  const baseQuery = { ...filters, vue };

  // --- Colonnes / lignes texte, pour le PDF ET pour garder le tableau
  // affiché et le tableau exporté strictement identiques -----------------
  let colonnesPdf: string[] = [];
  let lignesPdf: string[][] = [];
  let ligneTotalPdf: string[] | undefined;

  if (vue === "commercial") {
    colonnesPdf = ["Commercial", "Binôme", "Ventes", "Cartons HYPO", "Cartons HTC", "CA (FCFA)"];
    lignesPdf = (lignes as any[]).map((l) => [
      l.commercialNom,
      l.binomeNom ?? "—",
      String(l.nbVentes),
      String(l.cartonsHypo),
      String(l.cartonsHtc),
      fcfa(l.caTotal),
    ]);
    ligneTotalPdf = ["TOTAL", "", String(totaux.nbVentes), String(totaux.cartonsHypo), String(totaux.cartonsHtc), fcfa(totaux.caTotal)];
  } else if (vue === "point_vente") {
    colonnesPdf = ["Point de vente", "Ville", "Quartier", "Ventes", "Cartons HYPO", "Cartons HTC", "CA (FCFA)"];
    lignesPdf = (lignes as any[]).map((l) => [
      l.pointVenteNom,
      l.villeNom,
      l.quartierNom ?? "—",
      String(l.nbVentes),
      String(l.cartonsHypo),
      String(l.cartonsHtc),
      fcfa(l.caTotal),
    ]);
    ligneTotalPdf = ["TOTAL", "", "", String(totaux.nbVentes), String(totaux.cartonsHypo), String(totaux.cartonsHtc), fcfa(totaux.caTotal)];
  } else if (vue === "ville") {
    colonnesPdf = ["Ville", "Ventes", "Cartons HYPO", "Cartons HTC", "CA (FCFA)"];
    lignesPdf = (lignes as any[]).map((l) => [
      l.villeNom,
      String(l.nbVentes),
      String(l.cartonsHypo),
      String(l.cartonsHtc),
      fcfa(l.caTotal),
    ]);
    ligneTotalPdf = ["TOTAL", String(totaux.nbVentes), String(totaux.cartonsHypo), String(totaux.cartonsHtc), fcfa(totaux.caTotal)];
  } else if (vue === "quartier") {
    colonnesPdf = ["Quartier", "Ville", "Ventes", "Cartons HYPO", "Cartons HTC", "CA (FCFA)"];
    lignesPdf = (lignes as any[]).map((l) => [
      l.quartierNom,
      l.villeNom,
      String(l.nbVentes),
      String(l.cartonsHypo),
      String(l.cartonsHtc),
      fcfa(l.caTotal),
    ]);
    ligneTotalPdf = ["TOTAL", "", String(totaux.nbVentes), String(totaux.cartonsHypo), String(totaux.cartonsHtc), fcfa(totaux.caTotal)];
  } else {
    colonnesPdf = ["Date", "Commercial", "Point de vente", "Ville", "Quartier", "Client", "Produits", "Montant (FCFA)"];
    lignesPdf = (lignes as any[]).map((l) => [
      new Date(l.date).toLocaleDateString("fr-FR"),
      l.commercialNom,
      l.pointVenteNom,
      l.villeNom,
      l.quartierNom ?? "—",
      l.clientNom ?? "—",
      l.produitsResume,
      fcfa(l.caTotal),
    ]);
    ligneTotalPdf = undefined; // page partielle en vue détaillée : pas de total trompeur dans ce PDF
  }

  return (
    <main>
      <AdminPageHeader
        title="Rapports"
        subtitle={TITRE_VUE[vue]}
        action={
          <div className="flex items-center gap-2 print:hidden">
            <ImprimerButton />
            <PdfExportButton
              titre={TITRE_VUE[vue]}
              filtreLabel={filtreLabel}
              colonnes={colonnesPdf}
              lignes={lignesPdf}
              ligneTotal={ligneTotalPdf}
            />
          </div>
        }
      />

      <div className="p-4 md:p-6">
        {/* Catégories de rapport */}
        <div className="mb-4 flex flex-wrap gap-2 print:hidden">
          {CATEGORIES.map((c) => {
            const Icon = c.icon;
            return (
              <Link
                key={c.vue}
                href={`/admin/rapports?${buildQuery({ ...filters, vue: c.vue })}`}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
                  vue === c.vue
                    ? "bg-brand text-white"
                    : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 ring-1 ring-slate-200 dark:ring-slate-700"
                }`}
              >
                <Icon size={13} />
                {c.label}
              </Link>
            );
          })}
        </div>

        {/* Filtres (communs aux 5 vues) */}
        <form
          className="mb-5 grid grid-cols-2 gap-2 rounded-2xl bg-white dark:bg-slate-900 p-4 shadow-sm ring-1 ring-slate-100 dark:ring-slate-800 md:grid-cols-4 print:hidden"
          action="/admin/rapports"
        >
          <input type="hidden" name="vue" value={vue} />
          <select
            name="commercialId"
            defaultValue={filters.commercialId ?? ""}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-100"
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
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-100"
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
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-100"
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
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-100"
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
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-100"
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
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-100"
          >
            <option value="">Tous les produits</option>
            <option value="HYPO">HYPO</option>
            <option value="HTC">HTC</option>
          </select>
          <input
            type="date"
            name="dateFrom"
            defaultValue={filters.dateFrom ?? ""}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-100"
          />
          <input
            type="date"
            name="dateTo"
            defaultValue={filters.dateTo ?? ""}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-100"
          />
          <button
            type="submit"
            className="col-span-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white md:col-span-4"
          >
            Appliquer les filtres
          </button>
        </form>

        {/* En-tête visible seulement à l'impression (le titre de page normal
            est dans la sidebar/header, masqués à l'impression) */}
        <div className="mb-3 hidden print:block">
          <p className="text-lg font-bold text-slate-800">HYPO / HTC — ICHA IMPORT</p>
          <p className="text-sm text-slate-500">{TITRE_VUE[vue]}</p>
          {filtreLabel && <p className="text-xs text-slate-400">{filtreLabel}</p>}
        </div>

        {/* Totaux */}
        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-2xl bg-white dark:bg-slate-900 p-4 shadow-sm ring-1 ring-slate-100 dark:ring-slate-800">
            <ShoppingCart size={16} className="mb-2 text-indigo-600" />
            <p className="text-xl font-bold text-slate-800 dark:text-slate-100">{totaux.nbVentes}</p>
            <p className="text-xs font-medium text-slate-400 dark:text-slate-500">Ventes</p>
          </div>
          <div className="rounded-2xl bg-white dark:bg-slate-900 p-4 shadow-sm ring-1 ring-slate-100 dark:ring-slate-800">
            <Banknote size={16} className="mb-2 text-green-600" />
            <p className="text-xl font-bold text-slate-800 dark:text-slate-100">{fcfa(totaux.caTotal)}</p>
            <p className="text-xs font-medium text-slate-400 dark:text-slate-500">CA (FCFA)</p>
          </div>
          <div className="rounded-2xl bg-white dark:bg-slate-900 p-4 shadow-sm ring-1 ring-slate-100 dark:ring-slate-800">
            <Droplet size={16} className="mb-2 text-blue-600" />
            <p className="text-xl font-bold text-slate-800 dark:text-slate-100">{totaux.cartonsHypo}</p>
            <p className="text-xs font-medium text-slate-400 dark:text-slate-500">Cartons HYPO</p>
          </div>
          <div className="rounded-2xl bg-white dark:bg-slate-900 p-4 shadow-sm ring-1 ring-slate-100 dark:ring-slate-800">
            <Sparkles size={16} className="mb-2 text-teal-600" />
            <p className="text-xl font-bold text-slate-800 dark:text-slate-100">{totaux.cartonsHtc}</p>
            <p className="text-xs font-medium text-slate-400 dark:text-slate-500">Cartons HTC</p>
          </div>
        </div>

        {/* Tableau — colonnes selon la vue */}
        <div className="overflow-x-auto rounded-2xl bg-white dark:bg-slate-900 shadow-sm ring-1 ring-slate-100 dark:ring-slate-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 dark:text-slate-500">
              <tr>
                {colonnesPdf.map((c) => (
                  <th key={c} className="whitespace-nowrap px-4 py-3">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lignesPdf.map((row, i) => (
                <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
                  {row.map((cell, j) => (
                    <td
                      key={j}
                      className={`whitespace-nowrap px-4 py-2.5 ${
                        j === row.length - 1
                          ? "font-semibold text-slate-800 dark:text-slate-100"
                          : "text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
              {lignesPdf.length === 0 && (
                <tr>
                  <td colSpan={colonnesPdf.length} className="px-4 py-8 text-center text-slate-400 dark:text-slate-500">
                    Aucune donnée pour ces filtres.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination — uniquement pour la vue détail par vente */}
        {pagination && pagination.totalPages > 1 && (
          <div className="mt-5 flex items-center justify-between text-sm text-slate-500 dark:text-slate-400 print:hidden">
            <span>
              Page {pagination.page} / {pagination.totalPages} · {pagination.total} ventes
            </span>
            <div className="flex gap-2">
              <Link
                href={`/admin/rapports?${buildQuery({ ...baseQuery, page: String(pagination.page - 1) })}`}
                aria-disabled={pagination.page <= 1}
                className={`flex items-center gap-1 rounded-xl border px-3 py-1.5 font-medium ${
                  pagination.page <= 1
                    ? "pointer-events-none border-slate-100 dark:border-slate-800 text-slate-300"
                    : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                }`}
              >
                <ChevronLeft size={15} />
                Précédent
              </Link>
              <Link
                href={`/admin/rapports?${buildQuery({ ...baseQuery, page: String(pagination.page + 1) })}`}
                aria-disabled={pagination.page >= pagination.totalPages}
                className={`flex items-center gap-1 rounded-xl border px-3 py-1.5 font-medium ${
                  pagination.page >= pagination.totalPages
                    ? "pointer-events-none border-slate-100 dark:border-slate-800 text-slate-300"
                    : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                }`}
              >
                Suivant
                <ChevronRight size={15} />
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
