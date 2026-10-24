import { listerVilles } from "@/lib/geo/synchro-villes";
import { Fragment } from "react";
import Link from "next/link";
import { Plus, Phone, Truck, Clock, XCircle, CheckCircle2, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { listCommandes, countCommandesParStatut, type StatutCommandeFiltre } from "@/lib/queries/commandes";
import { prisma } from "@/lib/prisma";
import { jourDouala } from "@/lib/utils/periode";
import { formatFcfa } from "@/lib/utils/format";
import { cartonsEq, libelleCartons, detailQte } from "@/lib/utils/cartons-equiv";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { CommandeStatusActions } from "@/components/admin/CommandeStatusActions";
import { ArchiveButton, ArchiverAnciennesButton } from "@/components/admin/ArchiveButton";
import { BonCommandeButton } from "@/components/admin/BonCommandeButton";
import { BonLivraisonButton } from "@/components/admin/BonLivraisonButton";
import { FactureButton } from "@/components/admin/FactureButton";
import { ModePaiementSelect } from "@/components/admin/ModePaiementSelect";
import { requireAdminPage } from "@/lib/auth/rbac";
import { peutAcceder, peutModifier } from "@/lib/auth/permissions";

// Données live (base de données) : jamais pré-généré statiquement au build
// (évite d'épuiser le pool de connexions Prisma pendant `next build`, et
// une page admin ne doit de toute façon jamais servir de données figées).
export const dynamic = "force-dynamic";

function waUrl(tel: string | null) {
  if (!tel) return null;
  return `https://wa.me/${tel.replace(/[^\d]/g, "")}`;
}

const CONFIG_STATUT: Record<StatutCommandeFiltre, { label: string; cls: string; icon: React.ElementType }> = {
  EN_ATTENTE: { label: "En attente", cls: "bg-amber-50 text-amber-700", icon: Clock },
  EN_LIVRAISON: { label: "Effectuer la livraison", cls: "bg-blue-50 text-brand", icon: Truck },
  LIVREE: { label: "Livrée", cls: "bg-emerald-600 text-white", icon: CheckCircle2 },
  ANNULEE: { label: "Annulée", cls: "bg-red-50 text-alert", icon: XCircle },
};

function StatutBadge({ statut }: { statut: StatutCommandeFiltre }) {
  const config = CONFIG_STATUT[statut];
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
    binomeId?: string;
    dateFrom?: string;
    dateTo?: string;
  };
}) {
  const session = await requireAdminPage("commandes");
  const aujourdhui = jourDouala();
  const peutArchiver = peutAcceder(session.role, "archives");
  const page = Number(searchParams.page ?? "1") || 1;
  const statut = (searchParams.statut as StatutCommandeFiltre | undefined) ?? undefined;
  const villeId = searchParams.villeId ?? "";
  const commercialId = searchParams.commercialId ?? "";
  const binomeId = searchParams.binomeId ?? "";
  const dateFrom = searchParams.dateFrom ?? "";
  const dateTo = searchParams.dateTo ?? "";

  const filtresSansStatut = { villeId, commercialId, binomeId, dateFrom, dateTo };

  const [{ data, pagination }, { parStatut, total: totalToutStatut }, villes, commerciaux, binomes] = await Promise.all([
    listCommandes({ page, statut, ...filtresSansStatut }),
    countCommandesParStatut(filtresSansStatut),
    listerVilles(),
    prisma.user.findMany({
      where: { role: "COMMERCIAL" },
      orderBy: { nom: "asc" },
      select: { id: true, nom: true, prenom: true },
    }),
    prisma.binome.findMany({ orderBy: { nom: "asc" }, select: { id: true, nom: true } }),
  ]);

  const baseQuery = { statut, villeId, commercialId, binomeId, dateFrom, dateTo };

  return (
    <main>
      <AdminPageHeader title="Commandes" subtitle={`${pagination.total} au total`} action={
          <div className="flex items-center gap-2">
            {(
              <Link href="/admin/commandes/nouvelle" className="flex items-center gap-1.5 rounded-xl bg-[#1e3a8a] px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#2563eb]">
                <Plus size={15} /> Nouvelle commande
              </Link>
            )}
            {peutArchiver ? <ArchiverAnciennesButton jours={30} /> : null}
          </div>
        } />

      <div className="p-4 md:p-6">
        {(
          <Link
            href="/admin/commandes/nouvelle"
            className="mb-4 flex w-fit items-center gap-1.5 rounded-xl bg-[#1e3a8a] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#2563eb] md:hidden"
          >
            <Plus size={15} /> Nouvelle commande
          </Link>
        )}
        {/* Pastilles de filtre rapide par statut */}
        <div className="mb-4 flex flex-wrap gap-2">
          <Link
            href={`/admin/commandes?${buildQuery({ ...filtresSansStatut })}`}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              !statut ? "bg-brand text-white" : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 ring-1 ring-slate-200 dark:ring-slate-700"
            }`}
          >
            Toutes ({totalToutStatut})
          </Link>
          {(Object.keys(CONFIG_STATUT) as StatutCommandeFiltre[]).map((s) => (
            <Link
              key={s}
              href={`/admin/commandes?${buildQuery({ ...filtresSansStatut, statut: s })}`}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                statut === s ? "bg-brand text-white" : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 ring-1 ring-slate-200 dark:ring-slate-700"
              }`}
            >
              {CONFIG_STATUT[s].label} ({parStatut[s]})
            </Link>
          ))}
        </div>

        {/* Filtres */}
        <form className="mb-4 grid grid-cols-2 gap-2 rounded-2xl bg-white dark:bg-slate-900 p-4 shadow-sm ring-1 ring-slate-100 dark:ring-slate-800 md:grid-cols-5" action="/admin/commandes">
          <select name="statut" defaultValue={statut ?? ""} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-100">
            <option value="">Tous les statuts</option>
            <option value="EN_ATTENTE">En attente</option>
            <option value="EN_LIVRAISON">Effectuer la livraison</option>
            <option value="LIVREE">Livrée</option>
            <option value="ANNULEE">Annulée</option>
          </select>
          <select name="villeId" defaultValue={villeId} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-100">
            <option value="">Toutes les villes</option>
            {villes.map((v) => (
              <option key={v.id} value={v.id}>{v.nom}</option>
            ))}
          </select>
          <select name="commercialId" defaultValue={commercialId} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-100">
            <option value="">Tous les commerciaux</option>
            {commerciaux.map((c) => (
              <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>
            ))}
          </select>
          <select name="binomeId" defaultValue={binomeId} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-100">
            <option value="">Tous les binômes</option>
            {binomes.map((b) => (
              <option key={b.id} value={b.id}>{b.nom}</option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input type="date" name="dateFrom" defaultValue={dateFrom} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-100" />
            <input type="date" name="dateTo" defaultValue={dateTo} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-100" />
          </div>
          <button type="submit" className="col-span-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white md:col-span-5">
            Filtrer
          </button>
        </form>

        {/* Liste */}
        <div className="space-y-2">
          {(() => {
            const carte = (c: (typeof data)[number]) => {
              const wa = waUrl(c.pointVente.telephoneVendeur);
              const livraisonAujourdhui = !!c.dateLivraisonPrevue && jourDouala(c.dateLivraisonPrevue) === aujourdhui;
              return (
                <Fragment key={c.id}>
                  <div className={`rounded-2xl p-4 shadow-sm ring-1 ${c.statut === "LIVREE" ? "bg-emerald-50 ring-emerald-200 dark:bg-emerald-950/40 dark:ring-emerald-900" : "bg-white ring-slate-100 dark:bg-slate-900 dark:ring-slate-800"}`}>
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-slate-800 dark:text-slate-100">
                          {c.client?.nom ?? c.pointVente.nom}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">
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
                          {l.produit.code} —{" "}
                          {l.detail
                            ? `détail : ${detailQte(l)}`
                            : libelleCartons(cartonsEq(l, l.produit))}
                        </span>
                      ))}
                    </div>

                    <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-bold tabular-nums text-slate-800 dark:text-slate-100">
                        {Number(c.montantTotal).toLocaleString("fr-FR")} FCFA
                      </span>
                      <ModePaiementSelect
                        type="COMMANDE"
                        id={c.id}
                        valeur={c.modePaiement}
                        modifiable={peutModifier(session.role)}
                      />
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-400 dark:text-slate-500">
                      <div>
                        <p>Commandée le {new Date(c.dateCommande).toLocaleDateString("fr-FR")}</p>
                        {c.dateLivraisonPrevue && (
                          <p>
                            Livraison prévue le {new Date(c.dateLivraisonPrevue).toLocaleDateString("fr-FR")}
                            {livraisonAujourdhui && (
                              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                Aujourd&apos;hui
                              </span>
                            )}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {wa && (
                          <a href={wa} target="_blank" rel="noopener noreferrer" className="text-green-600">
                            <Phone size={15} />
                          </a>
                        )}
                        {c.statut !== "ANNULEE" && peutModifier(session.role) && <BonCommandeButton commandeId={c.id} />}
                        {/* Facture et bon de livraison : seulement une fois la commande validée par l'admin. */}
                        {(c.statut === "EN_LIVRAISON" || c.statut === "LIVREE") && peutModifier(session.role) && (
                          <>
                            <BonLivraisonButton commandeId={c.id} />
                            <FactureButton type="COMMANDE" id={c.id} />
                          </>
                        )}
                        {peutArchiver && (c.statut === "LIVREE" || c.statut === "ANNULEE") && (
                          <ArchiveButton url={`/api/commandes/${c.id}/archiver`} archive compact />
                        )}
                      </div>
                    </div>

                    {peutModifier(session.role) && (
                      <div className={`mt-3 rounded-xl px-3 py-2.5 ${c.statut === "LIVREE" ? "bg-emerald-100/70 dark:bg-emerald-900/30" : "bg-slate-50 dark:bg-slate-800/60"}`}>
                        <CommandeStatusActions id={c.id} statut={c.statut} dateLivraisonPrevue={c.dateLivraisonPrevue?.toISOString() ?? null} />
                      </div>
                    )}
                  </div>
                </Fragment>
              );
            };
            const duJourListe = data.filter((c) => jourDouala(c.dateCommande) === aujourdhui);
            const precedentes = data.filter((c) => jourDouala(c.dateCommande) !== aujourdhui);
            const total = (l: typeof data) => formatFcfa(l.reduce((t, x) => t + Number(x.montantTotal), 0));
            return (
              <>
                {duJourListe.length > 0 && (
                  <>
                    <div className="flex items-center justify-between gap-3 px-1">
                      <h2 className="text-xs font-bold uppercase tracking-wide text-[#1e3a8a] dark:text-blue-300">
                        Commandes du jour ({duJourListe.length})
                      </h2>
                      <span className="text-xs font-semibold tabular-nums text-slate-500 dark:text-slate-400">{total(duJourListe)}</span>
                    </div>
                    {duJourListe.map(carte)}
                  </>
                )}
                {precedentes.length > 0 && (
                  <details className="group pt-2">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl bg-white px-3 py-2.5 shadow-sm ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800 [&::-webkit-details-marker]:hidden">
                      <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        <ChevronDown size={16} className="transition-transform group-open:rotate-180" />
                        Commandes précédentes ({precedentes.length})
                      </span>
                      <span className="text-xs font-semibold tabular-nums text-slate-500 dark:text-slate-400">{total(precedentes)}</span>
                    </summary>
                    <div className="mt-2 space-y-2">{precedentes.map(carte)}</div>
                  </details>
                )}
              </>
            );
          })()}
          {data.length === 0 && (
            <p className="rounded-2xl bg-white dark:bg-slate-900 py-10 text-center text-sm text-slate-400 dark:text-slate-500 shadow-sm ring-1 ring-slate-100 dark:ring-slate-800">
              Aucune commande trouvée.
            </p>
          )}
        </div>

        {/* Pagination */}
        <div className="mt-5 flex items-center justify-between text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500">
          <span>Page {pagination.page} / {pagination.totalPages}</span>
          <div className="flex gap-2">
            <Link
              href={`/admin/commandes?${buildQuery({ ...baseQuery, page: String(pagination.page - 1) })}`}
              aria-disabled={pagination.page <= 1}
              className={`flex items-center gap-1 rounded-xl border px-3 py-1.5 font-medium ${
                pagination.page <= 1 ? "pointer-events-none border-slate-100 dark:border-slate-800 text-slate-300" : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
              }`}
            >
              <ChevronLeft size={15} />
              Précédent
            </Link>
            <Link
              href={`/admin/commandes?${buildQuery({ ...baseQuery, page: String(pagination.page + 1) })}`}
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
      </div>
    </main>
  );
}
