import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight, TrendingDown, TrendingUp } from "lucide-react";
import { requireAdminPage } from "@/lib/auth/rbac";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ImprimerButton } from "@/components/admin/ImprimerButton";
import { getRapportPeriodique, type TypePeriode } from "@/lib/queries/rapport-periodique";
import { partsVente, texteDetail, type Vol } from "@/lib/utils/cartons-equiv";
import { formatMontant } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

const qte = (n: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(n);
const pct = (n: number) => `${String(Math.round(n * 10) / 10).replace(".", ",")} %`;
const carte = "rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800";

/** Barre empilée : part cartons (bleu) / part détail (ambre). */
function BarreParts({ vol }: { vol: Vol }) {
  const p = partsVente(vol);
  if (!p) return <span className="text-slate-300">—</span>;
  return (
    <div className="min-w-[140px]">
      <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div className="bg-brand" style={{ width: `${p.cartons}%` }} />
        <div className="bg-amber-400" style={{ width: `${p.detail}%` }} />
      </div>
      <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
        <span className="font-semibold text-brand">{pct(p.cartons)}</span> cartons · <span className="font-semibold text-amber-600">{pct(p.detail)}</span> détail
      </p>
    </div>
  );
}

export default async function RapportsPeriodiquesPage({ searchParams }: { searchParams: { type?: string; ref?: string } }) {
  await requireAdminPage("rapports");
  const type: TypePeriode = searchParams.type === "mois" ? "mois" : "semaine";
  const r = await getRapportPeriodique(type, searchParams.ref);
  const lien = (t: TypePeriode, ref?: string) => `/admin/rapports/periodiques?type=${t}${ref ? `&ref=${ref}` : ""}`;
  const t = r.totaux;
  const maxJour = Math.max(1, ...r.jours.map((j) => j.vol.gros + j.vol.detailEq));
  const variation = t.variationEq;

  return (
    <main>
      <div className="hidden p-6 pb-2 print:block">
        <h1 className="text-xl font-bold text-slate-900">ICHA IMPORT — Rapport {type === "mois" ? "mensuel" : "hebdomadaire"}</h1>
        <p className="text-sm text-slate-500">{r.periode.libelle}</p>
      </div>
      <div className="print:hidden">
        <AdminPageHeader title="Rapports hebdomadaires et mensuels" subtitle="Ventes par produit : cartons, sachets et filets au détail, avec les pourcentages." />
      </div>

      <div className="space-y-4 p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Link href="/admin/rapports" className="flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-300">
            <ArrowLeft size={16} /> Retour aux rapports
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            {(["semaine", "mois"] as const).map((x) => (
              <Link
                key={x}
                href={lien(x)}
                className={`rounded-full px-4 py-2 text-xs font-semibold ${
                  type === x ? "bg-brand text-white shadow-sm" : "bg-white text-slate-500 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:ring-slate-700"
                }`}
              >
                {x === "semaine" ? "Hebdomadaire" : "Mensuel"}
              </Link>
            ))}
            <ImprimerButton />
          </div>
        </div>

        <div className={`${carte} flex items-center justify-between`}>
          <Link href={lien(type, r.periode.precedente)} className="flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 print:hidden dark:border-slate-700 dark:text-slate-300">
            <ChevronLeft size={15} /> Précédent
          </Link>
          <div className="text-center">
            <p className="text-lg font-bold text-slate-800 dark:text-slate-100">{r.periode.libelle}</p>
            <p className="text-xs text-slate-400">Comparé à : {r.precedent.libelle}</p>
          </div>
          <Link href={lien(type, r.periode.suivante)} className="flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 print:hidden dark:border-slate-700 dark:text-slate-300">
            Suivant <ChevronRight size={15} />
          </Link>
        </div>

        {/* Chiffres clés */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            ["Cartons vendus", qte(t.vol.gros), "ventes en cartons"],
            ["Vente au détail", texteDetail(t.vol), "sachets et filets à l'unité"],
            ["Commandes validées", String(t.commandes), `${t.visites} visite(s) · ${t.nouveauxPv} nouveau(x) PV`],
            ["Encaissé en caisse", `${formatMontant(r.caisse.encaisse)} FCFA`, `dépenses ${formatMontant(r.caisse.depenses)} FCFA`],
          ].map(([titre, val, sous]) => (
            <div key={titre} className={carte}>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{titre}</p>
              <p className="mt-1.5 text-xl font-bold text-slate-800 dark:text-slate-100">{val}</p>
              <p className="mt-0.5 text-[11px] text-slate-400">{sous}</p>
            </div>
          ))}
        </div>

        {/* Lecture de la période */}
        <div className={`${carte} !p-0 overflow-hidden`}>
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-800/40">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Lecture de la période</p>
              <p className="mt-1 text-base font-bold capitalize text-slate-900 dark:text-slate-50">{r.datesLongues}</p>
              <p className="mt-0.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                {r.nbJours} jour{r.nbJours > 1 ? "s" : ""} · {t.commandes} commande{t.commandes > 1 ? "s" : ""} validée{t.commandes > 1 ? "s" : ""}
              </p>
            </div>
            {variation != null && (
              <span className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${variation >= 0 ? "bg-teal-50 text-teal-700" : "bg-red-50 text-red-700"}`}>
                {variation >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                {variation >= 0 ? "+" : "−"}
                {pct(Math.abs(variation))} vs période précédente
              </span>
            )}
          </div>
          <div className="px-5 pt-4">
            <BarreParts vol={t.vol} />
          </div>
          <ul className="grid gap-3 p-5 md:grid-cols-2">
            {r.lecture.map((l) => (
              <li
                key={l.titre}
                className={`rounded-xl border-l-4 bg-slate-50 px-4 py-3 dark:bg-slate-800/40 ${
                  l.ton === "bon" ? "border-teal-500" : l.ton === "alerte" ? "border-red-500" : l.ton === "info" ? "border-brand" : "border-slate-300 dark:border-slate-600"
                }`}
              >
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{l.titre}</p>
                <p className="mt-1 text-sm font-medium leading-relaxed text-slate-800 dark:text-slate-200">{l.texte}</p>
              </li>
            ))}
          </ul>
        </div>

        {/* Par produit */}
        <div className={`${carte} !p-0 overflow-hidden`}>
          <div className="border-b border-slate-100 px-5 py-3 dark:border-slate-800">
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">Détail par produit</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-2 font-semibold">Produit</th>
                  <th className="px-2 py-2 text-right font-semibold">Cartons</th>
                  <th className="px-2 py-2 text-right font-semibold">Sachets (détail)</th>
                  <th className="px-2 py-2 text-right font-semibold">Filets (détail)</th>
                  <th className="px-2 py-2 font-semibold">Cartons / détail</th>
                  <th className="px-2 py-2 text-right font-semibold">Part du total</th>
                  <th className="px-5 py-2 text-right font-semibold">Évolution</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {r.produits.length === 0 && (
                  <tr><td colSpan={7} className="px-5 py-8 text-center text-slate-400">Aucune vente validée sur cette période.</td></tr>
                )}
                {r.produits.map((p) => (
                  <tr key={p.code}>
                    <td className="px-5 py-3">
                      <p className="font-semibold text-slate-800 dark:text-slate-100">{p.code}</p>
                      <p className="text-xs text-slate-400">{p.nom}</p>
                    </td>
                    <td className="px-2 py-3 text-right font-semibold tabular-nums">{qte(p.vol.gros)}</td>
                    <td className="px-2 py-3 text-right tabular-nums">{p.vol.sd > 0 ? qte(p.vol.sd) : "—"}</td>
                    <td className="px-2 py-3 text-right tabular-nums">{p.vol.fd > 0 ? qte(p.vol.fd) : "—"}</td>
                    <td className="px-2 py-3"><BarreParts vol={p.vol} /></td>
                    <td className="px-2 py-3 text-right font-semibold tabular-nums">{pct(p.partProduit)}</td>
                    <td className={`px-5 py-3 text-right text-xs font-semibold ${p.variation == null ? "text-slate-300" : p.variation >= 0 ? "text-teal-600" : "text-red-600"}`}>
                      {p.variation == null ? "nouveau" : `${p.variation >= 0 ? "+" : "−"}${pct(Math.abs(p.variation))}`}
                    </td>
                  </tr>
                ))}
              </tbody>
              {r.produits.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-slate-200 font-bold dark:border-slate-700">
                    <td className="px-5 py-3">Total</td>
                    <td className="px-2 py-3 text-right tabular-nums">{qte(t.vol.gros)}</td>
                    <td className="px-2 py-3 text-right tabular-nums">{t.vol.sd > 0 ? qte(t.vol.sd) : "—"}</td>
                    <td className="px-2 py-3 text-right tabular-nums">{t.vol.fd > 0 ? qte(t.vol.fd) : "—"}</td>
                    <td className="px-2 py-3"><BarreParts vol={t.vol} /></td>
                    <td className="px-2 py-3 text-right">100 %</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* Évolution dans la période */}
        <div className={carte}>
          <h2 className="mb-3 text-sm font-bold text-slate-800 dark:text-slate-100">{type === "semaine" ? "Jour par jour" : "Semaine par semaine"}</h2>
          <div className="space-y-2">
            {r.jours.map((j) => {
              const total = j.vol.gros + j.vol.detailEq;
              return (
                <div key={j.cle} className="grid grid-cols-[110px_1fr_auto] items-center gap-3 text-xs md:grid-cols-[170px_1fr_auto]">
                  <span className="capitalize text-slate-500 dark:text-slate-400">{j.libelle}</span>
                  <div className="flex h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div className="bg-brand" style={{ width: `${(j.vol.gros / maxJour) * 100}%` }} />
                    <div className="bg-amber-400" style={{ width: `${(j.vol.detailEq / maxJour) * 100}%` }} />
                  </div>
                  <span className="whitespace-nowrap text-right text-slate-600 dark:text-slate-300">
                    {total > 0 ? `${qte(j.vol.gros)} cartons${j.vol.sd + j.vol.fd > 0 ? ` · ${texteDetail(j.vol)}` : ""}` : "—"}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="mt-3 flex gap-4 text-[11px] text-slate-400">
            <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-brand" />Cartons</span>
            <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-400" />Détail</span>
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {[
            { titre: "Commerciaux", lignes: r.commerciaux },
            { titre: "Meilleurs points de vente", lignes: r.pointsVente },
          ].map((b) => (
            <div key={b.titre} className={`${carte} !p-0 overflow-hidden`}>
              <div className="border-b border-slate-100 px-5 py-3 dark:border-slate-800">
                <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">{b.titre}</h2>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {b.lignes.length === 0 && <p className="px-5 py-6 text-center text-sm text-slate-400">Aucune vente.</p>}
                {b.lignes.map((l) => (
                  <div key={l.nom} className="px-5 py-3 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-slate-800 dark:text-slate-100">{l.nom}</p>
                        {l.sous && <p className="text-xs text-slate-400">{l.sous}</p>}
                      </div>
                      <p className="text-right text-xs text-slate-600 dark:text-slate-300">
                        {qte(l.vol.gros)} cartons{l.vol.sd + l.vol.fd > 0 ? ` · ${texteDetail(l.vol)}` : ""}
                        <span className="block text-slate-400">{l.commandes} commande(s)</span>
                      </p>
                    </div>
                    <div className="mt-1.5"><BarreParts vol={l.vol} /></div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
