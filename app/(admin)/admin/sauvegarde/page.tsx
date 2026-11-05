import { FileSpreadsheet, FileText, ShieldCheck } from "lucide-react";
import { requireAdminPage } from "@/lib/auth/rbac";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

export const dynamic = "force-dynamic";

const carte = "flex flex-col rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800";
const bouton = "mt-auto rounded-xl bg-brand px-4 py-3 text-center text-sm font-bold text-white";

export default async function SauvegardePage() {
  await requireAdminPage("sauvegarde");
  return (
    <main>
      <AdminPageHeader title="Sauvegarde et export" subtitle="Une copie complète de vos données, à conserver hors de l'application." />
      <div className="grid gap-4 p-4 md:grid-cols-2 md:p-6">
        <section className={carte}>
          <FileSpreadsheet className="mb-3 text-emerald-600" size={28} />
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Export Excel complet</h2>
          <p className="mb-4 mt-1 text-sm text-slate-500">
            Un classeur avec une feuille par domaine : points de vente, commandes et leur détail, ventes terrain, paiements, caisse, stock et mouvements, avoirs et retours, utilisateurs. Filtrable et exploitable.
          </p>
          <a href="/api/sauvegarde/excel" className={bouton}>Télécharger le fichier Excel</a>
        </section>
        <section className={carte}>
          <FileText className="mb-3 text-rose-600" size={28} />
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Export PDF complet</h2>
          <p className="mb-4 mt-1 text-sm text-slate-500">
            Un document paginé avec page de garde, synthèse chiffrée, puis toutes les tables. Idéal pour archiver ou imprimer. Peut prendre quelques secondes.
          </p>
          <a href="/api/sauvegarde/pdf" className={bouton}>Télécharger le PDF</a>
        </section>
        <section className="flex gap-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600 ring-1 ring-slate-100 md:col-span-2 dark:bg-slate-800/50 dark:text-slate-300 dark:ring-slate-800">
          <ShieldCheck className="mt-0.5 shrink-0 text-slate-400" size={18} />
          <p>Les mots de passe ne sont jamais exportés. Chaque téléchargement est inscrit au journal des modifications. Conservez ces fichiers dans un endroit sûr : ils contiennent des données commerciales sensibles.</p>
        </section>
      </div>
    </main>
  );
}
