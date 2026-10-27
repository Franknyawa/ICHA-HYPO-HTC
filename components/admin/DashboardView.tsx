import type { DashboardKpis, VisitesParJour, BilanCommandesEnCours } from "@/lib/queries/dashboard";
import type { getCaisseResume } from "@/lib/queries/caisse";
import type { ReactNode } from "react";
import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { CaChart, PrintButton } from "@/components/admin/DashboardCharts";
import { VisitesChart } from "@/components/admin/VisitesChart";
import { ObservationsTerrain } from "@/components/admin/ObservationsTerrain";
import { KpiCard, Panneau, TitreSection } from "@/components/admin/ui";
import {
  MapPinned,
  Footprints,
  ShoppingBag,
  Banknote,
  Wallet,
  Truck,
  Package,
  HandCoins,
  Users2,
  Trophy,
  ArrowUpRight,
} from "lucide-react";

function formatFcfa(n: number) {
  return new Intl.NumberFormat("fr-FR").format(Math.round(n)) + " FCFA";
}

function fmtCartons(n: number) {
  return String(Math.round(n * 10) / 10).replace(".", ",");
}

function tendance(auj: number, hier: number) {
  const d = auj - hier;
  if (d === 0) return `comme hier (${hier})`;
  return `${d > 0 ? "+" : ""}${d} par rapport à hier (${hier})`;
}

export function DashboardView({
  prenom,
  dateLongue,
  jour,
  kpis,
  enCours,
  visites,
  caisse,
  parBinome,
  parVendeur,
  observations,
  ventesSlot,
  cartonsJourSlot,
  territoiresSlot,
  peutCaisse = true,
  peutStock = true,
}: {
  prenom: string;
  dateLongue: string;
  jour: string;
  kpis: DashboardKpis;
  enCours: BilanCommandesEnCours;
  visites: VisitesParJour;
  caisse: Awaited<ReturnType<typeof getCaisseResume>>;
  parBinome: { nom: string; montant: number }[];
  parVendeur: { nom: string; montant: number }[];
  observations: React.ComponentProps<typeof ObservationsTerrain>["observations"];
  ventesSlot: ReactNode;
  cartonsJourSlot: ReactNode;
  territoiresSlot: ReactNode;
  peutCaisse?: boolean;
  peutStock?: boolean;
}) {
  const maxCommercial = Math.max(...visites.parCommercial.map((c) => c.points), 1);

  return (
    <main className="pb-12">
      <AdminPageHeader
        title={`Bonjour ${prenom}`.trim()}
        subtitle={`${dateLongue.charAt(0).toUpperCase()}${dateLongue.slice(1)} — activité du jour`}
        action={<PrintButton />}
      />

      <div className="mx-auto max-w-6xl space-y-8 px-4 pt-6 md:px-8">
        {/* Chiffres clés du jour */}
        <section>
          <TitreSection>Aujourd&apos;hui</TitreSection>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <KpiCard
              label="Points visités"
              valeur={visites.aujourdhui.pointsVisites}
              sous={tendance(visites.aujourdhui.pointsVisites, visites.hier.pointsVisites)}
              icone={MapPinned}
              ton="vert"
              href={`/admin/tracking?mode=visites&date=${jour}`}
            />
            <KpiCard
              label="Visites réalisées"
              valeur={kpis.visitesAujourdhui}
              sous={`moyenne ${visites.moyenne7} points / jour sur 7 jours`}
              icone={Footprints}
              ton="bleu"
              href={`/admin/tracking?mode=visites&date=${jour}`}
            />
            <KpiCard
              label="Ventes validées"
              valeur={kpis.ventesAujourdhui}
              sous={`${String(Math.round((kpis.cartonsHypo + kpis.cartonsHtc) * 10) / 10).replace(".", ",")} cartons (commandes validées)`}
              icone={ShoppingBag}
              ton="violet"
              href={`/admin/factures?dateFrom=${jour}&dateTo=${jour}`}
            />
            <KpiCard
              label="Chiffre d'affaires"
              valeur={formatFcfa(kpis.caAujourdhui)}
              sous="argent encaissé aujourd'hui"
              icone={Banknote}
              ton="ambre"
              href={`/admin/rapports?dateFrom=${jour}&dateTo=${jour}`}
            />
            {peutCaisse && (
            <KpiCard
              label="Encaissé en caisse"
              valeur={formatFcfa(caisse.recettesJour)}
              sous={`dépenses du jour : ${formatFcfa(caisse.depensesJour)}`}
              icone={Wallet}
              ton="bleu"
              href="/admin/caisse"
            />
            )}
            <KpiCard
              label="Commandes en attente"
              valeur={kpis.commandesEnAttente}
              sous={kpis.commandesEnAttente > 0 ? "à préparer et livrer" : "rien en attente"}
              icone={Truck}
              ton={kpis.commandesEnAttente > 0 ? "rose" : "ardoise"}
              href="/admin/commandes?statut=EN_ATTENTE"
            />
          </div>
        </section>

        {/* Commandes en cours : cumul par produit */}
        <section>
          <TitreSection ton="rose">Commandes en cours</TitreSection>
          <Panneau
            titre={`${enCours.reduce((s, b) => s + b.nbCommandes, 0)} commande(s) en cours · ${fmtCartons(enCours.reduce((s, b) => s + b.cartons, 0))} cartons`}
            sousTitre={`Valeur totale : ${formatFcfa(enCours.reduce((s, b) => s + b.montant, 0))}`}
            icone={Truck}
            ton="rose"
          >
            <div className="grid gap-6 md:grid-cols-2">
              {enCours.map((b) => (
                <div key={b.statut}>
                  <div className="mb-2 flex items-baseline justify-between gap-3">
                    <Link
                      href={`/admin/commandes?statut=${b.statut}`}
                      className="text-sm font-bold text-slate-800 hover:underline dark:text-slate-100"
                    >
                      {b.statut === "EN_ATTENTE" ? "En attente de validation" : "Validées, à livrer"}
                    </Link>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {b.nbCommandes} commande(s) · {fmtCartons(b.cartons)} cartons · {formatFcfa(b.montant)}
                    </span>
                  </div>
                  {b.produits.length === 0 ? (
                    <p className="py-4 text-sm text-slate-400">Rien en cours.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 text-left text-xs text-slate-400 dark:border-slate-800">
                          <th className="py-1.5 font-medium">Produit</th>
                          <th className="py-1.5 font-medium">Quantité</th>
                          <th className="py-1.5 text-right font-medium">Cartons</th>
                          <th className="py-1.5 text-right font-medium">Valeur</th>
                        </tr>
                      </thead>
                      <tbody>
                        {b.produits.map((p) => (
                          <tr key={p.code} className="border-b border-slate-50 dark:border-slate-800/60">
                            <td className="py-2 font-semibold text-slate-800 dark:text-slate-100">{p.code}</td>
                            <td className="py-2 text-slate-600 dark:text-slate-300">{p.detail}</td>
                            <td className="py-2 text-right tabular-nums">{fmtCartons(p.cartons)}</td>
                            <td className="whitespace-nowrap py-2 text-right tabular-nums">{formatFcfa(p.montant)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              ))}
            </div>
          </Panneau>
        </section>

        {/* Points visités par jour */}
        <section className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Panneau
            titre="Points de vente visités par jour"
            sousTitre={`${visites.total30} points visités sur 30 jours · moyenne ${visites.moyenne7} par jour sur la dernière semaine`}
            icone={MapPinned}
            ton="vert"
          >
            <VisitesChart serie={visites.serie} />
          </Panneau>

          <Panneau titre="Aujourd'hui par commercial" sousTitre="Points de vente différents visités" icone={Trophy} ton="ambre">
            {visites.parCommercial.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-400">Aucune visite aujourd&apos;hui.</p>
            ) : (
              <ul className="space-y-3">
                {visites.parCommercial.map((c, i) => (
                  <li key={c.nom}>
                    <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate font-medium text-slate-800 dark:text-slate-100">
                        <span className="mr-1.5 text-slate-400">{i + 1}.</span>
                        {c.nom}
                      </span>
                      <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        {c.points}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className="h-full rounded-full bg-[#359980]/80"
                        style={{ width: `${Math.max(6, (c.points / maxCommercial) * 100)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panneau>
        </section>

        {/* Caisse, stock, réseau */}
        <section className="grid gap-4 lg:grid-cols-3">
          {peutCaisse && (
          <Link
            href="/admin/caisse"
            className="group relative overflow-hidden rounded-2xl bg-[#1e3a8a] p-6 text-white shadow-sm"
          >
            <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10" />
            <div className="absolute -bottom-10 right-8 h-24 w-24 rounded-full bg-white/10" />
            <p className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-white/80">
              <span className="flex items-center gap-2">
                <Wallet size={15} /> Solde en caisse
              </span>
              <ArrowUpRight size={16} className="opacity-70 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </p>
            <p className="mt-3 text-3xl font-bold tabular-nums">{formatFcfa(caisse.solde)}</p>
            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/20 pt-3 text-xs">
              <div>
                <p className="text-white/70">Crédits à encaisser</p>
                <p className="mt-0.5 text-sm font-bold tabular-nums">{formatFcfa(caisse.creditsTotal)}</p>
              </div>
              <div>
                <p className="text-white/70">Stock à la vente</p>
                <p className="mt-0.5 text-sm font-bold tabular-nums">{formatFcfa(caisse.valeurStockVente)}</p>
              </div>
            </div>
          </Link>
          )}

          {peutStock && (
          <Panneau
            titre="Stock par produit"
            sousTitre="Cartons disponibles"
            icone={Package}
            ton="violet"
            action={
              <Link href="/admin/stock" className="text-xs font-semibold text-violet-700 hover:underline dark:text-violet-300">
                Gérer
              </Link>
            }
          >
            {caisse.stock.length === 0 ? (
              <p className="text-sm text-slate-400">Aucun stock enregistré.</p>
            ) : (
              <ul className="space-y-3.5">
                {caisse.stock.slice(0, 6).map((s) => {
                  const bas = s.seuilCartons > 0 && s.cartons < s.seuilCartons;
                  const ref = Math.max(s.seuilCartons * 3, s.cartons, 1);
                  return (
                    <li key={s.produitId}>
                      <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                        <span className="min-w-0 truncate font-medium text-slate-800 dark:text-slate-100">{s.nom}</span>
                        <span className={`shrink-0 text-xs font-bold tabular-nums ${bas ? "text-red-600" : "text-slate-600 dark:text-slate-300"}`}>
                          {s.cartons} cartons{bas ? " · faible" : ""}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div
                          className={`h-full rounded-full ${bas ? "bg-red-500/80" : "bg-slate-500"}`}
                          style={{ width: `${Math.max(4, (s.cartons / ref) * 100)}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panneau>
          )}

          <Panneau titre="Réseau et crédits" sousTitre="Vue d'ensemble" icone={Users2} ton="bleu">
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {[
                { label: "Clients", value: kpis.clientsTotal, href: "/admin/clients" },
                { label: "Prospects", value: kpis.prospectsTotal, href: undefined },
                ...(peutCaisse
                  ? [
                      {
                        label: "Crédits à encaisser",
                        value: `${caisse.nbCredits} · ${formatFcfa(caisse.creditsTotal)}`,
                        href: "/admin/caisse" as string | undefined,
                        alerte: caisse.creditsTotal > 0,
                      },
                    ]
                  : []),
              ].map((l) => {
                const contenu = (
                  <>
                    <span className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                      {l.label === "Crédits à encaisser" && <HandCoins size={14} className="text-amber-500" />}
                      {l.label}
                    </span>
                    <span className={`text-sm font-bold tabular-nums ${l.alerte ? "text-amber-700 dark:text-amber-400" : "text-slate-900 dark:text-slate-100"}`}>
                      {l.value}
                    </span>
                  </>
                );
                return (
                  <li key={l.label}>
                    {l.href ? (
                      <Link href={l.href} className="flex items-center justify-between py-3 hover:opacity-80">
                        {contenu}
                      </Link>
                    ) : (
                      <div className="flex items-center justify-between py-3">{contenu}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </Panneau>
        </section>

        {/* CA du jour par binôme et par vendeur (imprimables) */}
        <section>
          <TitreSection ton="violet">Performance du jour</TitreSection>
          <div className="grid gap-4 md:grid-cols-2">
            <CaChart title="CA encaissé par binôme" items={parBinome} color="#1e3a8a" />
            <CaChart title="CA encaissé par vendeur" items={parVendeur} color="#359980" />
          </div>
        </section>

        {/* Cartons vendus par jour : chargé en streaming */}
        <section>{cartonsJourSlot}</section>

        {/* Ventes par produit : chargé en streaming */}
        <section>{ventesSlot}</section>

        {/* Objectifs par région et par ville */}
        <section>
          <TitreSection ton="vert">Objectifs par région et par ville</TitreSection>
          {territoiresSlot}
        </section>

        {/* Observations terrain récentes */}
        <section>
          <TitreSection ton="ambre">Observations terrain</TitreSection>
          <ObservationsTerrain observations={observations} />
        </section>
      </div>
    </main>
  );
}
