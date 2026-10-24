import Link from "next/link";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Scale,
  HandCoins,
  Banknote,
  Smartphone,
  Package,
  ArrowDownLeft,
  ArrowUpRight,
  Landmark,
} from "lucide-react";
import type { DonneesCaisse } from "@/lib/queries/caisse";
import { PERIODES_CAISSE, jourDouala } from "@/lib/utils/periode";
import { formatFcfa } from "@/lib/utils/format";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { KpiCard, Panneau, TitreSection } from "@/components/admin/ui";
import { CaisseOperations, SupprimerOperation } from "@/components/admin/caisse/CaisseOperations";
import { ExportCsvButton } from "@/components/admin/ExportCsvButton";
import { PdfExportButton } from "@/components/admin/PdfExportButton";
import { ImprimerButton } from "@/components/admin/ImprimerButton";

const LIBELLE_CANAL = { ESPECES: "Espèces", MOBILE_MONEY: "OM/MOMO", BANQUE: "Opération bancaire" } as const;

export function CaisseView({
  c,
  periode,
}: {
  c: DonneesCaisse;
  periode: { id: string; du: string | null; au: string | null; libelle: string };
}) {
  const colonnesExport = ["Date", "Sens", "Libellé", "Détail", "Canal", "Montant (FCFA)"];
  const lignesTexte = c.journal.map((l) => [
    new Date(l.date).toLocaleDateString("fr-FR"),
    l.sens === "ENTREE" ? "Entrée" : "Sortie",
    l.libelle,
    l.detail,
    LIBELLE_CANAL[l.canal],
    `${l.sens === "ENTREE" ? "+" : "-"}${formatFcfa(l.montant)}`,
  ]);
  const lignesNombres = c.journal.map((l) => [
    new Date(l.date).toLocaleDateString("fr-FR"),
    l.sens === "ENTREE" ? "Entrée" : "Sortie",
    l.libelle,
    l.detail,
    LIBELLE_CANAL[l.canal],
    l.sens === "ENTREE" ? l.montant : -l.montant,
  ]);

  const resultatPositif = c.resultat >= 0;
  const patrimoine = c.soldeTotal + (c.valeurStockCout ?? c.valeurStockVente) + c.creditsTotal;

  return (
    <main className="pb-12">
      <AdminPageHeader
        title="Caisse"
        subtitle={`${periode.libelle} — reliée aux ventes, aux crédits et au stock`}
        action={
          <div className="flex items-center gap-2 print:hidden">
            <PdfExportButton
              titre={`Caisse — ${periode.libelle}`}
              filtreLabel={`Recettes ${formatFcfa(c.recettes)} · Dépenses ${formatFcfa(c.depenses)} · Résultat ${formatFcfa(c.resultat)} · Solde ${formatFcfa(c.soldeTotal)}`}
              colonnes={colonnesExport}
              lignes={lignesTexte}
            />
            <ExportCsvButton colonnes={colonnesExport} lignes={lignesNombres} nomFichier="caisse" />
            <ImprimerButton />
          </div>
        }
      />

      <div className="mx-auto max-w-6xl space-y-6 px-4 pt-6 md:px-8">
        {/* Période */}
        <form
          method="get"
          className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200/70 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 print:hidden"
        >
          <span className="mr-1 px-2 text-xs font-bold uppercase tracking-wide text-slate-500">Période</span>
          {PERIODES_CAISSE.map((p) => (
            <Link
              key={p.id}
              href={`/admin/caisse?periode=${p.id}`}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                periode.id === p.id
                  ? "bg-[#1e3a8a] text-white shadow"
                  : "bg-slate-100 text-slate-600 hover:bg-blue-50 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              {p.label}
            </Link>
          ))}
          <span className="ml-auto flex items-center gap-2 text-xs text-slate-500">
            Du
            <input type="date" name="du" defaultValue={periode.du ?? ""} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900" />
            au
            <input type="date" name="au" defaultValue={periode.au ?? ""} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900" />
            <button className="rounded-lg bg-[#359980] px-3 py-1.5 text-xs font-semibold text-white">OK</button>
          </span>
        </form>

        {/* Solde + répartition par canal */}
        <section className="grid gap-4 lg:grid-cols-[1.3fr_1fr_1fr_1fr]">
          <div className="relative overflow-hidden rounded-2xl bg-[#1e3a8a] p-6 text-white shadow-sm">
            <div className="absolute -right-8 -top-8 h-36 w-36 rounded-full bg-white/10" />
            <div className="absolute -bottom-10 right-10 h-28 w-28 rounded-full bg-white/10" />
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/80">
              <Wallet size={15} /> Solde en caisse (cumul)
            </p>
            <p className="mt-3 text-3xl font-bold tabular-nums md:text-4xl">{formatFcfa(c.soldeTotal)}</p>
            <p className="mt-2 text-xs text-white/75">
              Tous les encaissements validés, plus les recettes, moins les dépenses.
            </p>
          </div>
          <KpiCard
            label="Solde espèces"
            valeur={formatFcfa(c.solde.ESPECES)}
            sous={`période : ${c.parCanalPeriode.ESPECES.entrees - c.parCanalPeriode.ESPECES.sorties >= 0 ? "+" : ""}${formatFcfa(c.parCanalPeriode.ESPECES.entrees - c.parCanalPeriode.ESPECES.sorties)}`}
            icone={Banknote}
            ton="vert"
          />
          <KpiCard
            label="Solde OM/MOMO"
            valeur={formatFcfa(c.solde.MOBILE_MONEY)}
            sous={`période : ${c.parCanalPeriode.MOBILE_MONEY.entrees - c.parCanalPeriode.MOBILE_MONEY.sorties >= 0 ? "+" : ""}${formatFcfa(c.parCanalPeriode.MOBILE_MONEY.entrees - c.parCanalPeriode.MOBILE_MONEY.sorties)}`}
            icone={Smartphone}
            ton="ambre"
          />
          <KpiCard
            label="Solde banque"
            valeur={formatFcfa(c.solde.BANQUE)}
            sous={`période : ${c.parCanalPeriode.BANQUE.entrees - c.parCanalPeriode.BANQUE.sorties >= 0 ? "+" : ""}${formatFcfa(c.parCanalPeriode.BANQUE.entrees - c.parCanalPeriode.BANQUE.sorties)}`}
            icone={Landmark}
            ton="bleu"
          />
        </section>

        {/* Chiffres de la période */}
        <section>
          <TitreSection>{periode.libelle}</TitreSection>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard
              label="Recettes"
              valeur={formatFcfa(c.recettes)}
              sous={
                <span className="block space-y-0.5">
                  <span className="block">
                    {c.nbEncaissements} encaissement{c.nbEncaissements > 1 ? "s" : ""} validé{c.nbEncaissements > 1 ? "s" : ""} : {formatFcfa(c.encaissementsVentes)}
                  </span>
                  {c.autresRecettes > 0 && <span className="block">Autres recettes : {formatFcfa(c.autresRecettes)}</span>}
                  {c.remboursements > 0 && <span className="block">Remboursements clients (avoirs / retours) : −{formatFcfa(c.remboursements)}</span>}
                  <span className="block text-slate-400">
                    Commandes validées : {c.commandesValideesNombre} pour {formatFcfa(c.commandesValideesMontant)}
                    {c.avoirsNombre > 0 ? ` · avoirs et retours : ${formatFcfa(c.avoirsMontant)}` : ""}
                  </span>
                </span>
              }
              icone={TrendingUp}
              ton="vert"
            />
            <KpiCard label="Dépenses" valeur={formatFcfa(c.depenses)} sous="achats de stock inclus" icone={TrendingDown} ton="rose" />
            <KpiCard
              label="Résultat"
              valeur={`${resultatPositif ? "" : "-"}${formatFcfa(Math.abs(c.resultat))}`}
              sous={resultatPositif ? "recettes − dépenses" : "dépenses supérieures aux recettes"}
              icone={Scale}
              ton={resultatPositif ? "bleu" : "rose"}
            />
            <KpiCard
              label="Commandes à encaisser"
              valeur={formatFcfa(c.creditsTotal)}
              sous={`${c.credits.length} commande${c.credits.length > 1 ? "s" : ""} livrée${c.credits.length > 1 ? "s" : ""} · toutes périodes`}
              icone={HandCoins}
              ton="ambre"
            />
          </div>
        </section>

        {/* Opérations + crédits */}
        <CaisseOperations
          jour={jourDouala()}
          credits={c.credits.map((x) => ({
            ...x,
            date: x.date.toISOString(),
            dateLivraisonPrevue: x.dateLivraisonPrevue ? x.dateLivraisonPrevue.toISOString() : null,
          }))}
        />

        {/* Stock présent */}
        <Panneau
          titre="Stock présent"
          sousTitre="Valorisé au prix du catalogue et au coût d'achat moyen"
          icone={Package}
          ton="violet"
          action={
            <Link href="/admin/stock" className="rounded-lg bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-100 dark:bg-violet-950/40 dark:text-violet-300">
              Gérer le stock
            </Link>
          }
        >
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-violet-50/70 p-3 text-center dark:bg-slate-800/60">
              <p className="text-xs text-slate-500 dark:text-slate-400">Cartons en stock</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{c.cartonsEnStock}</p>
            </div>
            <div className="rounded-xl bg-emerald-50/70 p-3 text-center dark:bg-slate-800/60">
              <p className="text-xs text-slate-500 dark:text-slate-400">Valeur à la vente</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{formatFcfa(c.valeurStockVente)}</p>
            </div>
            <div className="rounded-xl bg-blue-50/70 p-3 text-center dark:bg-slate-800/60">
              <p className="text-xs text-slate-500 dark:text-slate-400">Valeur au coût</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
                {c.valeurStockCout === null ? "—" : formatFcfa(c.valeurStockCout)}
              </p>
            </div>
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-wide">
                  <th className="px-4 py-2.5">Produit</th>
                  <th className="px-4 py-2.5 text-right">Cartons</th>
                  <th className="px-4 py-2.5 text-right">Prix vente</th>
                  <th className="px-4 py-2.5 text-right">Coût moyen</th>
                  <th className="px-4 py-2.5 text-right">Valeur vente</th>
                </tr>
              </thead>
              <tbody>
                {c.stock.map((s) => (
                  <tr key={s.produitId} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-slate-100">{s.nom}</td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{s.cartons}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-500">{formatFcfa(s.prixCarton)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-500">{s.coutCarton === null ? "—" : formatFcfa(s.coutCarton)}</td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{formatFcfa(s.valeurVente)}</td>
                  </tr>
                ))}
                {c.stock.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-slate-400">Aucun produit en stock.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="mt-3 flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-2.5 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
            <Landmark size={14} className="shrink-0 text-[#1e3a8a] dark:text-blue-300" />
            Valeur totale de l&apos;activité (caisse + stock {c.valeurStockCout === null ? "à la vente" : "au coût"} + crédits à encaisser) :{" "}
            <strong className="text-slate-900 dark:text-slate-100">{formatFcfa(patrimoine)}</strong>
          </p>
        </Panneau>

        {/* Journal */}
        <Panneau
          titre="Journal de la période"
          sousTitre={`${c.journalComplet} mouvement${c.journalComplet > 1 ? "s" : ""}${c.journalComplet > c.journal.length ? ` · ${c.journal.length} affichés` : ""}`}
          icone={Scale}
          ton="bleu"
        >
          {c.journal.length === 0 ? (
            <p className="text-sm text-slate-500">Aucun mouvement sur cette période.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold uppercase tracking-wide">
                    <th className="px-4 py-2.5">Date</th>
                    <th className="px-4 py-2.5">Opération</th>
                    <th className="px-4 py-2.5">Détail</th>
                    <th className="px-4 py-2.5">Canal</th>
                    <th className="px-4 py-2.5 text-right">Montant</th>
                    <th className="w-10 px-2 py-2.5 print:hidden" />
                  </tr>
                </thead>
                <tbody>
                  {c.journal.map((l) => (
                    <tr key={l.id} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="whitespace-nowrap px-4 py-2.5 text-slate-500">{new Date(l.date).toLocaleDateString("fr-FR")}</td>
                      <td className="px-4 py-2.5">
                        <span className="flex items-center gap-2 font-medium text-slate-800 dark:text-slate-100">
                          <span className={`flex h-6 w-6 items-center justify-center rounded-full ${l.sens === "ENTREE" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                            {l.sens === "ENTREE" ? <ArrowDownLeft size={13} /> : <ArrowUpRight size={13} />}
                          </span>
                          {l.libelle}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-500">{l.detail || "—"}</td>
                      <td className="px-4 py-2.5 text-slate-500">{LIBELLE_CANAL[l.canal]}</td>
                      <td className={`whitespace-nowrap px-4 py-2.5 text-right font-bold tabular-nums ${l.sens === "ENTREE" ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}>
                        {l.sens === "ENTREE" ? "+" : "−"}
                        {formatFcfa(l.montant)}
                      </td>
                      <td className="px-2 py-2.5 print:hidden">{l.supprimable && <SupprimerOperation id={l.id} />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panneau>
      </div>
    </main>
  );
}
