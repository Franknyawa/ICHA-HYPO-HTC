import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAdminPage } from "@/lib/auth/rbac";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ImprimerButton } from "@/components/admin/ImprimerButton";
import { getBilanVentes } from "@/lib/queries/bilan-ventes";
import { texteDetail } from "@/lib/utils/cartons-equiv";
import { formatMontant } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

const fcfa = (n: number) => `${formatMontant(n)} FCFA`;
const qte = (n: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(n);
const dateLongue = (j: string) => new Date(`${j}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const carte = "rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100 print:shadow-none print:ring-slate-300 dark:bg-slate-900 dark:ring-slate-800";

export default async function BilanVentesPage() {
  await requireAdminPage("rapports");
  const b = await getBilanVentes();
  const periode = b.premierJour ? `du ${dateLongue(b.premierJour)} au ${dateLongue(b.aujourdhui)}` : `au ${dateLongue(b.aujourdhui)}`;

  return (
    <main>
      <div className="hidden p-6 pb-2 print:block">
        <h1 className="text-xl font-bold text-slate-900">ICHA IMPORT — Bilan des ventes depuis le début de l&apos;activité</h1>
        <p className="text-sm text-slate-500">
          {periode} · édité le {dateLongue(b.aujourdhui)}
        </p>
      </div>
      <div className="print:hidden">
        <AdminPageHeader title="Bilan des ventes depuis le début" subtitle="Toutes les commandes livrées, rapprochées de la caisse." />
      </div>

      <div className="space-y-4 p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Link href="/admin/rapports" className="flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-300">
            <ArrowLeft size={16} /> Retour aux rapports
          </Link>
          <div className="flex gap-2">
            <ImprimerButton />
          </div>
        </div>

        <div className={carte}>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Période couverte</p>
          <p className="mt-1 text-base font-bold text-slate-900 dark:text-slate-50">{periode}</p>
          <p className="mt-0.5 text-xs font-semibold text-slate-500">
            {b.nbCommandes} commande{b.nbCommandes > 1 ? "s" : ""} livrée{b.nbCommandes > 1 ? "s" : ""}
          </p>
        </div>

        {/* Chiffres clés */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            ["Ventes livrées (nettes)", fcfa(b.ventesNettes), b.avoirs > 0 ? `après ${fcfa(b.avoirs)} d'avoirs / retours` : "aucun avoir ni retour"],
            ["Cartons vendus", qte(b.vol.gros), "ventes en cartons"],
            ["Vente au détail", texteDetail(b.vol), "sachets et filets à l'unité"],
            ["Solde de la caisse", fcfa(b.caisse.soldeTotal), "espèces + OM/MoMo + banque"],
          ].map(([titre, val, sous]) => (
            <div key={titre} className={carte}>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{titre}</p>
              <p className="mt-1.5 text-xl font-bold text-slate-800 dark:text-slate-100">{val}</p>
              <p className="mt-0.5 text-[11px] text-slate-400">{sous}</p>
            </div>
          ))}
        </div>

        {/* Rapprochement */}
        <div className={`${carte} !p-0 overflow-hidden`}>
          <div className="border-b border-slate-100 px-5 py-3 dark:border-slate-800">
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">Rapprochement ventes et caisse</h2>
          </div>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {[
                ["Ventes livrées (brut)", fcfa(b.ventesBrutes), false],
                ["Avoirs et retours", `− ${fcfa(b.avoirs)}`, false],
                ["Ventes livrées nettes", fcfa(b.ventesNettes), true],
                ["Encaissé sur ces ventes", fcfa(b.encaisse), false],
                ["Reste à encaisser (créances)", fcfa(b.resteAEncaisser), false],
              ].map(([l, v, fort]) => (
                <tr key={String(l)} className={fort ? "bg-slate-50 font-bold dark:bg-slate-800/40" : ""}>
                  <td className="px-5 py-2.5 text-slate-600 dark:text-slate-300">{l}</td>
                  <td className="px-5 py-2.5 text-right font-semibold tabular-nums text-slate-800 dark:text-slate-100">{v}</td>
                </tr>
              ))}
              <tr>
                <td className="px-5 py-2.5 text-slate-500">
                  Écart de rapprochement
                  <span className="block text-[11px] text-slate-400">ventes nettes − encaissé − reste à encaisser (arrondis, anciennes corrections)</span>
                </td>
                <td className={`px-5 py-2.5 text-right font-semibold tabular-nums ${b.ecart === 0 ? "text-teal-600" : "text-amber-600"}`}>{fcfa(b.ecart)}</td>
              </tr>
            </tbody>
          </table>
          <div className="grid grid-cols-3 gap-px border-t border-slate-100 bg-slate-100 text-center dark:border-slate-800 dark:bg-slate-800">
            {([
              ["Espèces", b.caisse.solde.ESPECES],
              ["OM/MoMo", b.caisse.solde.MOBILE_MONEY],
              ["Banque", b.caisse.solde.BANQUE],
            ] as const).map(([l, v]) => (
              <div key={l} className="bg-white px-3 py-3 dark:bg-slate-900">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Solde {l}</p>
                <p className="mt-0.5 font-bold tabular-nums text-slate-800 dark:text-slate-100">{fcfa(v)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Par produit */}
        <div className={`${carte} !p-0 overflow-hidden`}>
          <div className="border-b border-slate-100 px-5 py-3 dark:border-slate-800">
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">Ventes par produit</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-2 font-semibold">Produit</th>
                  <th className="px-2 py-2 text-right font-semibold">Cartons</th>
                  <th className="px-2 py-2 text-right font-semibold">Détail</th>
                  <th className="px-2 py-2 text-right font-semibold">Commandes</th>
                  <th className="px-5 py-2 text-right font-semibold">Montant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {b.produits.length === 0 && (
                  <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-400">Aucune commande livrée pour le moment.</td></tr>
                )}
                {b.produits.map((p) => (
                  <tr key={p.code}>
                    <td className="px-5 py-2.5"><p className="font-semibold text-slate-800 dark:text-slate-100">{p.code}</p><p className="text-xs text-slate-400">{p.nom}</p></td>
                    <td className="px-2 py-2.5 text-right font-semibold tabular-nums">{qte(p.vol.gros)}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{texteDetail(p.vol)}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{p.commandes}</td>
                    <td className="px-5 py-2.5 text-right font-semibold tabular-nums">{fcfa(p.montant)}</td>
                  </tr>
                ))}
              </tbody>
              {b.produits.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-slate-200 font-bold dark:border-slate-700">
                    <td className="px-5 py-3">Total</td>
                    <td className="px-2 py-3 text-right tabular-nums">{qte(b.vol.gros)}</td>
                    <td className="px-2 py-3 text-right tabular-nums">{texteDetail(b.vol)}</td>
                    <td className="px-2 py-3 text-right tabular-nums">{b.nbCommandes}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{fcfa(b.ventesBrutes)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* Par mois */}
        <div className={`${carte} !p-0 overflow-hidden`}>
          <div className="border-b border-slate-100 px-5 py-3 dark:border-slate-800">
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">Mois par mois</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-2 font-semibold">Mois</th>
                  <th className="px-2 py-2 text-right font-semibold">Commandes</th>
                  <th className="px-2 py-2 text-right font-semibold">Cartons</th>
                  <th className="px-2 py-2 text-right font-semibold">Détail</th>
                  <th className="px-2 py-2 text-right font-semibold">Montant</th>
                  <th className="px-5 py-2 text-right font-semibold">Cumul</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {b.mois.map((m) => (
                  <tr key={m.cle}>
                    <td className="px-5 py-2.5 font-semibold capitalize text-slate-800 dark:text-slate-100">{m.libelle}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{m.commandes}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{qte(m.vol.gros)}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{texteDetail(m.vol)}</td>
                    <td className="px-2 py-2.5 text-right font-semibold tabular-nums">{fcfa(m.montant)}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums text-slate-500">{fcfa(m.cumul)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-[11px] text-slate-400">
          Ventes = commandes livrées (stock sorti), classées à leur date de validation. Le solde de caisse est le cumul depuis le début : encaissements, autres recettes, dépenses et remboursements.
        </p>
      </div>
    </main>
  );
}
