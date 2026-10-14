import { requireAdminPage } from "@/lib/auth/rbac";
import {
  getDashboardKpis,
  getCaParBinomeEtVendeur,
  getObservationsRecentes,
} from "@/lib/queries/dashboard";
import { Suspense } from "react";
import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { VentesParProduitSection, VentesParProduitSkeleton } from "@/components/admin/VentesParProduitSection";
import { CaChart, PrintButton } from "@/components/admin/DashboardCharts";
import { ArrowUpRight } from "lucide-react";

// Données live (base de données) : jamais pré-généré statiquement au build
// (évite d'épuiser le pool de connexions Prisma pendant `next build`, et
// une page admin ne doit de toute façon jamais servir de données figées).
export const dynamic = "force-dynamic";

function formatFcfa(n: number) {
  return new Intl.NumberFormat("fr-FR").format(n) + " FCFA";
}

const CARTE = "rounded-xl border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900";

function Titre({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
      {children}
    </h2>
  );
}

/** Chiffre clé du jour : libellé discret, valeur en grand, aucun fond coloré. */
function Chiffre({ label, value, href }: { label: string; value: string | number; href?: string }) {
  const contenu = (
    <>
      <p className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
        {label}
        {href && <ArrowUpRight size={13} className="text-slate-300 transition-colors group-hover:text-[#359980]" />}
      </p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">{value}</p>
    </>
  );
  const classe = "group block p-5";
  return href ? (
    <Link href={href} className={`${classe} transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/40`}>
      {contenu}
    </Link>
  ) : (
    <div className={classe}>{contenu}</div>
  );
}

type Ligne = { label: string; value: string | number; href?: string; ton?: "alerte" | "attention" };

/** Liste compacte libellé / valeur, séparée par de fines lignes. */
function ListeLignes({ titre, lignes }: { titre: string; lignes: Ligne[] }) {
  return (
    <div className={`${CARTE} p-5`}>
      <p className="mb-1 text-sm font-semibold text-slate-800 dark:text-slate-200">{titre}</p>
      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
        {lignes.map((l) => {
          const couleur =
            l.ton === "alerte"
              ? "text-red-700 dark:text-red-400"
              : l.ton === "attention"
                ? "text-amber-700 dark:text-amber-400"
                : "text-slate-900 dark:text-slate-100";
          const contenu = (
            <>
              <span className="text-sm text-slate-500 dark:text-slate-400">{l.label}</span>
              <span className={`text-sm font-semibold tabular-nums ${couleur}`}>{l.value}</span>
            </>
          );
          return (
            <li key={l.label}>
              {l.href ? (
                <Link href={l.href} className="flex items-center justify-between py-3 transition-colors hover:opacity-80">
                  {contenu}
                </Link>
              ) : (
                <div className="flex items-center justify-between py-3">{contenu}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default async function AdminDashboardPage() {
  const session = await requireAdminPage();
  const kpis = await getDashboardKpis();
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const [{ parBinome, parVendeur }, observations] = await Promise.all([
    getCaParBinomeEtVendeur(),
    getObservationsRecentes(),
  ]);
  const dateLongue = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <main className="pb-12">
      <AdminPageHeader
        title={`Bonjour ${session?.prenom ?? ""}`.trim()}
        subtitle={`${dateLongue.charAt(0).toUpperCase()}${dateLongue.slice(1)} — activité du jour`}
        action={<PrintButton />}
      />

      <div className="mx-auto max-w-6xl space-y-8 px-4 pt-6 md:px-8">
        {/* Chiffres clés du jour */}
        <section>
          <Titre>Aujourd&apos;hui</Titre>
          <div
            className={`${CARTE} grid grid-cols-2 divide-x divide-y divide-slate-100 overflow-hidden dark:divide-slate-800 md:grid-cols-4 md:divide-y-0`}
          >
            <Chiffre
              label="Chiffre d'affaires"
              value={formatFcfa(kpis.caAujourdhui)}
              href={`/admin/rapports?dateFrom=${aujourdhui}&dateTo=${aujourdhui}`}
            />
            <Chiffre
              label="Encaissements"
              value={formatFcfa(kpis.encaissements)}
              href={`/admin/factures?dateFrom=${aujourdhui}&dateTo=${aujourdhui}`}
            />
            <Chiffre
              label="Ventes"
              value={kpis.ventesAujourdhui}
              href={`/admin/factures?dateFrom=${aujourdhui}&dateTo=${aujourdhui}`}
            />
            <Chiffre
              label="Visites"
              value={kpis.visitesAujourdhui}
              href={`/admin/tracking?mode=visites&date=${aujourdhui}`}
            />
          </div>
        </section>

        {/* Réseau, cartons et stock */}
        <section className="grid gap-4 md:grid-cols-2">
          <ListeLignes
            titre="Réseau et suivi"
            lignes={[
              { label: "Clients", value: kpis.clientsTotal, href: "/admin/clients" },
              { label: "Prospects", value: kpis.prospectsTotal },
              {
                label: "Commandes en attente",
                value: kpis.commandesEnAttente,
                href: "/admin/commandes?statut=EN_ATTENTE",
                ton: kpis.commandesEnAttente > 0 ? "attention" : undefined,
              },
              {
                label: "Crédits en cours",
                value: formatFcfa(kpis.credits),
                ton: kpis.credits > 0 ? "alerte" : undefined,
              },
            ]}
          />
          <ListeLignes
            titre="Cartons et stock"
            lignes={[
              {
                label: "Cartons HYPO vendus",
                value: kpis.cartonsHypo,
                href: `/admin/rapports?produitCode=HYPO&dateFrom=${aujourdhui}&dateTo=${aujourdhui}`,
              },
              {
                label: "Cartons HTC vendus",
                value: kpis.cartonsHtc,
                href: `/admin/rapports?produitCode=HTC&dateFrom=${aujourdhui}&dateTo=${aujourdhui}`,
              },
              { label: "Stock HYPO", value: `${kpis.stockHypoCartons} cartons`, href: "/admin/stock" },
              { label: "Stock HTC", value: `${kpis.stockHtcCartons} cartons`, href: "/admin/stock" },
            ]}
          />
        </section>

        {/* CA du jour par binôme et par vendeur (imprimables) */}
        <section>
          <Titre>Performance du jour</Titre>
          <div className="grid gap-4 md:grid-cols-2">
            <CaChart title="CA par binôme" items={parBinome} color="#1e3a8a" />
            <CaChart title="CA par vendeur" items={parVendeur} color="#359980" />
          </div>
        </section>

        {/* Ventes par produit : classement, meilleurs points de vente/quartiers,
            évolution 12 mois et 30 jours — chargé en streaming */}
        <section>
          <Suspense fallback={<VentesParProduitSkeleton />}>
            <VentesParProduitSection />
          </Suspense>
        </section>

        {/* Observations terrain récentes */}
        <section>
          <Titre>Observations terrain</Titre>
          <div className={`${CARTE} px-5`}>
            {observations.length === 0 ? (
              <p className="py-5 text-sm text-slate-400 dark:text-slate-500">Aucune observation pour le moment.</p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {observations.map((o) => (
                  <li key={o.id} className="py-4">
                    <p className="text-sm text-slate-700 dark:text-slate-300">{o.observation}</p>
                    <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                      {o.commercial.prenom} {o.commercial.nom} · {o.pointVente.nom} ·{" "}
                      {new Date(o.dateVisite).toLocaleDateString("fr-FR")}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
