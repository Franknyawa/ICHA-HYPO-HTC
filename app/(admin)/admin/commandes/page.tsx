import { listerVilles } from "@/lib/geo/synchro-villes";
import { Fragment } from "react";
import Link from "next/link";
import { Plus, Phone, Truck, Clock, XCircle, CheckCircle2, ChevronLeft, ChevronRight, ChevronDown, Pencil, UserCog, CalendarClock } from "lucide-react";
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
import { OriginesDetail } from "@/components/admin/OriginesDetail";
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
    vue?: string;
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
    listCommandes({ page, statut, ...filtresSansStatut, livraison: "courantes" }),
    countCommandesParStatut(filtresSansStatut),
    listerVilles(),
    prisma.user.findMany({
      where: { role: "COMMERCIAL" },
      orderBy: { nom: "asc" },
      select: { id: true, nom: true, prenom: true },
    }),
    prisma.binome.findMany({ orderBy: { nom: "asc" }, select: { id: true, nom: true } }),
  ]);

  // Livraisons à venir (hors du jour) : chargées à part, sur la 1re page seulement.
  const vueAvenir = searchParams.vue === "avenir";
  const aVenirListe = (await listCommandes({ pageSize: 100, statut, ...filtresSansStatut, livraison: "avenir" })).data;

  const baseQuery = { statut, villeId, commercialId, binomeId, dateFrom, dateTo };

  return (
    <main>
      <AdminPageHeader title="Commandes" subtitle={`${totalToutStatut} au total`} action={
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
        {/* Bouton « Livraisons à venir » (couleur à part) / retour */}
        <div className="mb-4">
          {vueAvenir ? (
            <Link
              href={`/admin/commandes?${buildQuery({ ...filtresSansStatut })}`}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-700 dark:bg-slate-700"
            >
              <ChevronLeft size={16} /> Retour aux commandes
            </Link>
          ) : (
            <Link
              href={`/admin/commandes?${buildQuery({ ...filtresSansStatut, vue: "avenir" })}`}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-600"
            >
              <CalendarClock size={16} />
              Livraisons à venir
              <span className="rounded-full bg-white/25 px-2 py-0.5 text-xs font-bold tabular-nums">{aVenirListe.length}</span>
            </Link>
          )}
        </div>

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
            const carte = (c: (typeof data)[number], dansJours?: number) => {
              const wa = waUrl(c.pointVente.telephoneVendeur);
              const livraisonAujourdhui = !!c.dateLivraisonPrevue && jourDouala(c.dateLivraisonPrevue) === aujourdhui;
              return (
                <Fragment key={c.id}>
                  <div className={`rounded-2xl p-4 shadow-sm ring-1 ${c.statut === "LIVREE" ? "bg-emerald-50 ring-emerald-200 dark:bg-emerald-950/40 dark:ring-emerald-900" : "bg-white ring-slate-100 dark:bg-slate-900 dark:ring-slate-800"}`}>
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div>
                        {dansJours !== undefined && (
                          <p className="mb-1 flex w-fit items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                            <CalendarClock size={11} /> {dansJours === 1 ? "Demain" : `Dans ${dansJours} jours`}
                          </p>
                        )}
                        <p className="font-semibold text-slate-800 dark:text-slate-100">
                          {c.client?.nom ?? c.pointVente.nom}
                        </p>
                        {c.saisiePar && (
                          <p className="mt-0.5 flex w-fit items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                            <UserCog size={11} /> Saisie au bureau : {c.saisiePar}
                          </p>
                        )}
                        {c.pointVente.nom === "CLIENT DIVERS" && (
                          <p className="mt-0.5 w-fit rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                            Ventes au détail de la journée : une seule facture
                          </p>
                        )}
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

                    {c.origines.length > 0 && <OriginesDetail origines={c.origines} />}

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
                        <p>Commandée le {new Date(c.dateCommande).toLocaleDateString("fr-FR", { timeZone: "Africa/Douala" })} à {new Date(c.dateCommande).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Douala" })}</p>
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
                        {(c.statut === "EN_ATTENTE" || c.statut === "EN_LIVRAISON") && peutModifier(session.role) && (
                          <Link
                            href={`/admin/commandes/${c.id}/modifier`}
                            className="flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
                            title="Modifier la commande"
                          >
                            <Pencil size={13} /> Modifier
                          </Link>
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
            // Section principale : commandes prises aujourd'hui + livraisons prévues aujourd'hui.
            const duJourListe = data.filter(
              (c) => jourDouala(c.dateCommande) === aujourdhui || (!!c.dateLivraisonPrevue && jourDouala(c.dateLivraisonPrevue) === aujourdhui)
            );
            const precedentes = data.filter((c) => !duJourListe.includes(c));
            const total = (l: typeof data) => formatFcfa(l.reduce((t, x) => t + Number(x.montantTotal), 0));
            const nbJoursAvant = (d: Date) =>
              Math.round((new Date(`${jourDouala(d)}T00:00:00Z`).getTime() - new Date(`${aujourdhui}T00:00:00Z`).getTime()) / 86_400_000);
            // Livraisons à venir regroupées par jour de livraison.
            const parJour = new Map<string, typeof aVenirListe>();
            for (const c of aVenirListe) {
              const j = jourDouala(c.dateLivraisonPrevue!);
              parJour.set(j, [...(parJour.get(j) ?? []), c]);
            }
            if (vueAvenir) {
              return (
                <>
                {aVenirListe.length === 0 && (
                  <p className="rounded-2xl bg-white py-10 text-center text-sm text-slate-400 shadow-sm ring-1 ring-slate-100 dark:bg-slate-900 dark:text-slate-500 dark:ring-slate-800">
                    Aucune livraison à venir.
                  </p>
                )}
                {aVenirListe.length > 0 && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-2 dark:border-amber-900/60 dark:bg-amber-950/10">
                    <div className="flex items-center justify-between gap-3 rounded-xl px-2 py-2">
                      <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-amber-800 dark:text-amber-300">
                        <CalendarClock size={16} />
                        Livraisons à venir ({aVenirListe.length})
                      </span>
                      <span className="text-xs font-semibold tabular-nums text-amber-800/80 dark:text-amber-300/80">{total(aVenirListe)}</span>
                    </div>
                    <p className="px-2 pb-2 text-[11px] text-amber-800/80 dark:text-amber-300/70">
                      Chaque commande passe dans « Commandes du jour » le jour de sa livraison.
                    </p>
                    <div className="space-y-3">
                      {[...parJour.entries()].map(([j, liste]) => (
                        <div key={j} className="space-y-2">
                          <div className="flex items-center justify-between gap-3 px-2">
                            <h3 className="text-xs font-bold capitalize text-slate-700 dark:text-slate-200">
                              {new Date(`${j}T12:00:00Z`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })}
                              <span className="ml-2 font-medium text-slate-500">{liste.length} commande{liste.length > 1 ? "s" : ""}</span>
                            </h3>
                            <span className="text-xs font-semibold tabular-nums text-slate-500 dark:text-slate-400">{total(liste)}</span>
                          </div>
                          {liste.map((c) => carte(c, nbJoursAvant(c.dateLivraisonPrevue!)))}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                </>
              );
            }
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
                    {duJourListe.map((c) => carte(c))}
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
                    <div className="mt-2 space-y-2">{precedentes.map((c) => carte(c))}</div>
                  </details>
                )}
              </>
            );
          })()}
          {!vueAvenir && data.length === 0 && (
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
