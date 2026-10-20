import { listerVilles } from "@/lib/geo/synchro-villes";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Receipt, FileMinus2, Undo2 } from "lucide-react";
import { listCommandes } from "@/lib/queries/commandes";
import { prisma } from "@/lib/prisma";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { FactureButton } from "@/components/admin/FactureButton";
import { ModePaiementSelect } from "@/components/admin/ModePaiementSelect";
import { CorrectionButton } from "@/components/admin/CorrectionButton";
import { CorrectionPdfButton } from "@/components/admin/CorrectionPdfButton";
import { listerCorrections } from "@/lib/services/corrections";
import { requireAdminPage } from "@/lib/auth/rbac";

// Données live (base de données) : jamais pré-généré statiquement au build
// (évite d'épuiser le pool de connexions Prisma pendant `next build`, et
// une page admin ne doit de toute façon jamais servir de données figées).
export const dynamic = "force-dynamic";

function buildQuery(params: Record<string, string | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
  return sp.toString();
}

export default async function FacturesPage({
  searchParams,
}: {
  searchParams: { onglet?: string; page?: string; commercialId?: string; villeId?: string; dateFrom?: string; dateTo?: string };
}) {
  await requireAdminPage("factures");
  const onglet = searchParams.onglet === "avoirs" || searchParams.onglet === "retours" ? searchParams.onglet : "factures";
  const page = Number(searchParams.page ?? "1") || 1;
  const commercialId = searchParams.commercialId ?? "";
  const villeId = searchParams.villeId ?? "";
  const dateFrom = searchParams.dateFrom ?? "";
  const dateTo = searchParams.dateTo ?? "";

  const estFactures = onglet === "factures";
  const [liste, villes, commerciaux, corrections] = await Promise.all([
    estFactures
      ? listCommandes({ page, commercialId, villeId, dateFrom, dateTo, statuts: ["EN_LIVRAISON", "LIVREE"] })
      : Promise.resolve(null),
    estFactures ? listerVilles() : Promise.resolve([]),
    estFactures
      ? prisma.user.findMany({
          where: { role: "COMMERCIAL" },
          orderBy: { nom: "asc" },
          select: { id: true, nom: true, prenom: true },
        })
      : Promise.resolve([]),
    !estFactures ? listerCorrections(onglet === "avoirs" ? "AVOIR" : "RETOUR") : Promise.resolve([]),
  ]);
  const data = liste?.data ?? [];
  const pagination = liste?.pagination ?? { page: 1, totalPages: 1, total: 0 };

  const baseQuery = { commercialId, villeId, dateFrom, dateTo };

  return (
    <main>
      <AdminPageHeader title="Facturation" subtitle="Factures, avoirs et retours" />

      <div className="p-4 md:p-6">
        <div className="mb-4 flex flex-wrap gap-2">
          {[
            { id: "factures", label: "Factures" },
            { id: "avoirs", label: "Factures d'avoir (FA)" },
            { id: "retours", label: "Factures retour (FR)" },
          ].map((t) => (
            <Link
              key={t.id}
              href={`/admin/factures?onglet=${t.id}`}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${
                onglet === t.id ? "bg-brand text-white" : "bg-white text-slate-500 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:ring-slate-700"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </div>

        {!estFactures && (
          <div className="space-y-2">
            {corrections.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-brand">
                    {d.type === "AVOIR" ? <FileMinus2 size={16} /> : <Undo2 size={16} />}
                  </span>
                  <div>
                    <p className="font-medium text-slate-800 dark:text-slate-100">
                      {d.numero} · {d.client.nom}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {new Date(d.date).toLocaleDateString("fr-FR")} à{" "}
                      {new Date(d.date).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                      {d.factureOrigine ? ` · Facture ${d.factureOrigine}` : ""} · {d.motif}
                      {d.destination ? ` · ${d.destination === "AVARIES" ? "Avaries" : "Retour en stock"}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    {d.montant.toLocaleString("fr-FR")} FCFA
                  </p>
                  <CorrectionPdfButton doc={d} />
                </div>
              </div>
            ))}
            {corrections.length === 0 && (
              <p className="rounded-2xl bg-white py-10 text-center text-sm text-slate-400 shadow-sm ring-1 ring-slate-100 dark:bg-slate-900 dark:text-slate-500 dark:ring-slate-800">
                Aucun document. Émettez-le depuis l&apos;onglet Factures avec le bouton « Avoir / Retour ».
              </p>
            )}
          </div>
        )}

        {estFactures && (<>
        <form className="mb-4 grid grid-cols-2 gap-2 rounded-2xl bg-white dark:bg-slate-900 p-4 shadow-sm ring-1 ring-slate-100 dark:ring-slate-800 md:grid-cols-4" action="/admin/factures">
          <select name="commercialId" defaultValue={commercialId} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-100">
            <option value="">Tous les commerciaux</option>
            {commerciaux.map((c) => (
              <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>
            ))}
          </select>
          <select name="villeId" defaultValue={villeId} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-100">
            <option value="">Toutes les villes</option>
            {villes.map((v) => (
              <option key={v.id} value={v.id}>{v.nom}</option>
            ))}
          </select>
          <input type="date" name="dateFrom" defaultValue={dateFrom} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-100" />
          <input type="date" name="dateTo" defaultValue={dateTo} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-100" />
          <button type="submit" className="col-span-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white md:col-span-4">
            Filtrer
          </button>
        </form>

        <div className="space-y-2">
          {data.map((v) => (
            <div key={v.id} className="flex items-center justify-between rounded-2xl bg-white dark:bg-slate-900 p-4 shadow-sm ring-1 ring-slate-100 dark:ring-slate-800">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-brand">
                  <Receipt size={16} />
                </span>
                <div>
                  <p className="font-medium text-slate-800 dark:text-slate-100">{v.pointVente.nom}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">
                    {v.commercial.prenom} {v.commercial.nom} · {v.pointVente.ville?.nom ?? "—"} ·{" "}
                    {new Date(v.dateCommande).toLocaleDateString("fr-FR")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  {Number(v.montantTotal).toLocaleString("fr-FR")} FCFA
                </p>
                <ModePaiementSelect
                  type="COMMANDE"
                  id={v.id}
                  valeur={v.modePaiement}
                />
                <FactureButton type="COMMANDE" id={v.id} />
                <CorrectionButton commandeId={v.id} />
              </div>
            </div>
          ))}
          {data.length === 0 && (
            <p className="rounded-2xl bg-white dark:bg-slate-900 py-10 text-center text-sm text-slate-400 dark:text-slate-500 shadow-sm ring-1 ring-slate-100 dark:ring-slate-800">
              Aucune commande validée. Validez une commande pour pouvoir la facturer.
            </p>
          )}
        </div>

        <div className="mt-5 flex items-center justify-between text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500">
          <span>Page {pagination.page} / {pagination.totalPages}</span>
          <div className="flex gap-2">
            <Link
              href={`/admin/factures?${buildQuery({ ...baseQuery, page: String(pagination.page - 1) })}`}
              aria-disabled={pagination.page <= 1}
              className={`flex items-center gap-1 rounded-xl border px-3 py-1.5 font-medium ${
                pagination.page <= 1 ? "pointer-events-none border-slate-100 dark:border-slate-800 text-slate-300" : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
              }`}
            >
              <ChevronLeft size={15} />
              Précédent
            </Link>
            <Link
              href={`/admin/factures?${buildQuery({ ...baseQuery, page: String(pagination.page + 1) })}`}
              aria-disabled={pagination.page >= pagination.totalPages}
              className={`flex items-center gap-1 rounded-xl border px-3 py-1.5 font-medium ${
                pagination.page >= pagination.totalPages ? "pointer-events-none border-slate-100 dark:border-slate-800 text-slate-300" : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
              }`}
            >
              Suivant
              <ChevronRight size={15} />
            </Link>
          </div>
        </div>
        </>)}
      </div>
    </main>
  );
}
