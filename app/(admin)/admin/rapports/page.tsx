import Link from "next/link";
import { getRapport, type RapportVue, type RapportFilters } from "@/lib/queries/rapports";
import { prisma } from "@/lib/prisma";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { PdfExportButton } from "@/components/admin/PdfExportButton";
import { ExportCsvButton } from "@/components/admin/ExportCsvButton";
import { ImprimerButton } from "@/components/admin/ImprimerButton";
import { RapportTableau } from "@/components/admin/rapports/RapportTableau";
import { formatMontant } from "@/lib/utils/format";
import {
  Users2,
  Store,
  Building2,
  MapPin,
  Receipt,
  Package,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { requireAdminPage } from "@/lib/auth/rbac";

// Données live (base de données) : jamais pré-généré statiquement au build.
export const dynamic = "force-dynamic";

const ONGLETS: { vue: RapportVue; label: string; icon: React.ElementType }[] = [
  { vue: "commercial", label: "Par commercial", icon: Users2 },
  { vue: "point_vente", label: "Par point de vente", icon: Store },
  { vue: "ville", label: "Par ville", icon: Building2 },
  { vue: "quartier", label: "Par quartier", icon: MapPin },
  { vue: "vente", label: "Détail des ventes", icon: Receipt },
  { vue: "produit", label: "Par produit", icon: Package },
  { vue: "historique", label: "Historique 12 mois", icon: CalendarDays },
];

const TITRE_VUE: Record<RapportVue, string> = {
  commercial: "Rapport par commercial",
  point_vente: "Rapport par point de vente",
  ville: "Rapport par ville",
  quartier: "Rapport par quartier",
  vente: "Détail des ventes",
  produit: "Rapport par produit",
  historique: "Historique sur 12 mois",
};

const fcfa = (n: number) => `${formatMontant(n)} FCFA`;

function buildQuery(params: Record<string, string | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
  return sp.toString();
}

const CHAMP =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";
const LABEL = "mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400";

type Params = {
  vue?: string;
  page?: string;
  commercialId?: string;
  binomeId?: string;
  villeId?: string;
  quartier?: string;
  typeId?: string;
  gamme?: string;
  produitCode?: string;
  dateFrom?: string;
  dateTo?: string;
};

export default async function RapportsPage({ searchParams }: { searchParams: Params }) {
  await requireAdminPage();
  const vue: RapportVue = ONGLETS.find((o) => o.vue === searchParams.vue)?.vue ?? "commercial";
  const page = Number(searchParams.page ?? "1") || 1;

  // Sans date choisie, on borne à 90 jours : le rapport calcule en mémoire,
  // une période illimitée ralentirait avec le temps. Les champs affichent cette
  // valeur et restent modifiables. (L'historique 12 mois a sa propre période.)
  const datesParDefaut = !searchParams.dateFrom && !searchParams.dateTo;
  const depuisDefaut = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const filters: RapportFilters = {
    commercialId: searchParams.commercialId || undefined,
    binomeId: searchParams.binomeId || undefined,
    villeId: searchParams.villeId || undefined,
    quartier: searchParams.quartier?.trim() || undefined,
    typeId: searchParams.typeId || undefined,
    gamme: searchParams.gamme || undefined,
    produitCode: searchParams.produitCode || undefined,
    dateFrom: searchParams.dateFrom || (datesParDefaut ? depuisDefaut : undefined),
    dateTo: searchParams.dateTo || undefined,
  };

  const [rapport, commerciaux, binomes, villes, types, produits] = await Promise.all([
    getRapport(filters, vue, page),
    prisma.user.findMany({
      where: { role: "COMMERCIAL" },
      orderBy: { nom: "asc" },
      select: { id: true, nom: true, prenom: true },
    }),
    prisma.binome.findMany({ orderBy: { nom: "asc" } }),
    prisma.ville.findMany({ orderBy: { nom: "asc" } }),
    prisma.typePointVente.findMany({ orderBy: { nom: "asc" } }),
    prisma.produit.findMany({ orderBy: { code: "asc" }, select: { code: true, nom: true, gamme: true } }),
  ]);

  const gammes = [...new Set(produits.map((p) => p.gamme).filter(Boolean) as string[])].sort();
  const { totaux, colonnes, nbColsTexte, lignes, total, pagination } = rapport;

  const filtreLabel = [
    filters.commercialId &&
      (() => {
        const c = commerciaux.find((x) => x.id === filters.commercialId);
        return c ? `${c.prenom} ${c.nom}` : undefined;
      })(),
    filters.binomeId && binomes.find((b) => b.id === filters.binomeId)?.nom,
    filters.villeId && villes.find((v) => v.id === filters.villeId)?.nom,
    filters.quartier && `quartier « ${filters.quartier} »`,
    filters.typeId && types.find((t) => t.id === filters.typeId)?.nom,
    filters.gamme && `gamme ${filters.gamme}`,
    filters.produitCode,
    vue === "historique"
      ? "12 derniers mois"
      : [filters.dateFrom && `du ${filters.dateFrom}`, filters.dateTo && `au ${filters.dateTo}`].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(" · ");

  // Filtres passés à l'aperçu (sans vue ni page)
  const queryFiltres = buildQuery({
    commercialId: filters.commercialId,
    binomeId: filters.binomeId,
    villeId: filters.villeId,
    quartier: filters.quartier,
    typeId: filters.typeId,
    gamme: filters.gamme,
    produitCode: filters.produitCode,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
  });
  const baseQuery = { ...filters, vue };

  const tuiles: [string, string][] = [
    ["Points de vente recensés", String(totaux.pointsVente)],
    ["Visites", String(totaux.visites)],
    ["Commandes", String(totaux.commandes)],
    ["Chiffre d'affaires (FCFA)", formatMontant(totaux.ca)],
  ];

  return (
    <main>
      <AdminPageHeader
        title="Rapports"
        subtitle="Performance et chiffre d'affaires par commercial, produit, point de vente, ville ou quartier — historique sur 12 mois et détail des ventes."
      />

      <div className="p-4 md:p-6">
        {/* Onglets */}
        <div className="mb-4 flex flex-wrap gap-2 print:hidden">
          {ONGLETS.map((o) => {
            const Icon = o.icon;
            return (
              <Link
                key={o.vue}
                href={`/admin/rapports?${buildQuery({ ...filters, vue: o.vue })}`}
                className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold ${
                  vue === o.vue
                    ? "bg-brand text-white shadow-sm"
                    : "bg-white text-slate-500 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:ring-slate-700"
                }`}
              >
                <Icon size={13} />
                {o.label}
              </Link>
            );
          })}
        </div>

        {/* Filtres + exports */}
        <div className="mb-5 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800 print:hidden">
          <form action="/admin/rapports" className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-5">
            <input type="hidden" name="vue" value={vue} />
            <div>
              <label className={LABEL}>Du</label>
              <input type="date" name="dateFrom" defaultValue={filters.dateFrom ?? ""} className={CHAMP} disabled={vue === "historique"} />
            </div>
            <div>
              <label className={LABEL}>Au</label>
              <input type="date" name="dateTo" defaultValue={filters.dateTo ?? ""} className={CHAMP} disabled={vue === "historique"} />
            </div>
            <div>
              <label className={LABEL}>Commercial</label>
              <select name="commercialId" defaultValue={filters.commercialId ?? ""} className={CHAMP}>
                <option value="">Tous</option>
                {commerciaux.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.prenom} {c.nom}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL}>Binôme</label>
              <select name="binomeId" defaultValue={filters.binomeId ?? ""} className={CHAMP}>
                <option value="">Tous</option>
                {binomes.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.nom}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL}>Ville</label>
              <select name="villeId" defaultValue={filters.villeId ?? ""} className={CHAMP}>
                <option value="">Toutes</option>
                {villes.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.nom}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL}>Type de boutique</label>
              <select name="typeId" defaultValue={filters.typeId ?? ""} className={CHAMP}>
                <option value="">Tous</option>
                {types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nom}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL}>Gamme</label>
              <select name="gamme" defaultValue={filters.gamme ?? ""} className={CHAMP}>
                <option value="">Toutes</option>
                {gammes.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL}>Produit</label>
              <select name="produitCode" defaultValue={filters.produitCode ?? ""} className={CHAMP}>
                <option value="">Tous</option>
                {produits.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.code} — {p.nom}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL}>Quartier</label>
              <input type="text" name="quartier" defaultValue={filters.quartier ?? ""} placeholder="Contient..." className={CHAMP} />
            </div>
            <div className="col-span-2 flex items-end gap-2 md:col-span-4 xl:col-span-1">
              <button type="submit" className="flex-1 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white">
                Appliquer
              </button>
              <Link
                href={`/admin/rapports?vue=${vue}`}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300"
              >
                Réinitialiser
              </Link>
            </div>
          </form>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-slate-400 dark:text-slate-500">
              {vue === "historique"
                ? "Les 12 derniers mois, quels que soient les dates saisies."
                : datesParDefaut
                  ? "Période par défaut : 90 derniers jours — choisis des dates pour changer."
                  : ""}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <PdfExportButton
                titre={TITRE_VUE[vue]}
                filtreLabel={filtreLabel}
                colonnes={colonnes}
                lignes={lignes.map((l) => l.cellules)}
                ligneTotal={total?.cellules}
              />
              <ExportCsvButton
                colonnes={colonnes}
                lignes={lignes.map((l) => l.brut)}
                total={total?.brut}
                nomFichier={`rapport-${vue}`}
              />
              <ImprimerButton />
            </div>
          </div>
        </div>

        {/* En-tête visible seulement à l'impression de la page */}
        <div className="mb-3 hidden print:block">
          <p className="text-lg font-bold text-slate-800">SIRI IMPORT</p>
          <p className="text-sm text-slate-500">{TITRE_VUE[vue]}</p>
          {filtreLabel && <p className="text-xs text-slate-400">{filtreLabel}</p>}
        </div>

        {/* Tuiles */}
        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          {tuiles.map(([label, valeur]) => (
            <div
              key={label}
              className="rounded-2xl bg-white px-4 py-5 text-center shadow-sm ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800"
            >
              <p
                className="text-2xl font-semibold text-slate-900 dark:text-slate-100"
                style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
              >
                {valeur}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{label}</p>
            </div>
          ))}
        </div>

        <p className="mb-2 text-xs text-slate-400 dark:text-slate-500 print:hidden">
          Clique sur une ligne pour ouvrir son aperçu détaillé et l&apos;imprimer seule.
        </p>

        <RapportTableau
          vue={vue}
          colonnes={colonnes}
          nbColsTexte={nbColsTexte}
          lignes={lignes.map((l) => ({ cle: l.cle, cellules: l.cellules }))}
          total={total?.cellules}
          query={queryFiltres}
          filtreLabel={filtreLabel}
        />

        {/* Pagination — uniquement pour le détail des ventes */}
        {pagination && pagination.totalPages > 1 && (
          <div className="mt-5 flex items-center justify-between text-sm text-slate-500 dark:text-slate-400 print:hidden">
            <span>
              Page {pagination.page} / {pagination.totalPages} · {pagination.total} ventes · total de la période :{" "}
              {fcfa(totaux.ca)}
            </span>
            <div className="flex gap-2">
              <Link
                href={`/admin/rapports?${buildQuery({ ...baseQuery, page: String(pagination.page - 1) })}`}
                aria-disabled={pagination.page <= 1}
                className={`flex items-center gap-1 rounded-xl border px-3 py-1.5 font-medium ${
                  pagination.page <= 1
                    ? "pointer-events-none border-slate-100 text-slate-300 dark:border-slate-800"
                    : "border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300"
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
                    ? "pointer-events-none border-slate-100 text-slate-300 dark:border-slate-800"
                    : "border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300"
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
