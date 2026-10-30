import Link from "next/link";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { requireAdminPage } from "@/lib/auth/rbac";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { FusionGroupe } from "@/components/admin/FusionGroupe";
import { trouverDoublons } from "@/lib/queries/doublons-clients";

export const dynamic = "force-dynamic";

export default async function DoublonsPage() {
  const session = await requireAdminPage("clients");
  const superAdmin = session.role === "SUPER_ADMIN";
  const { groupes, total } = await trouverDoublons();
  const concernes = groupes.reduce((s, g) => s + g.membres.length, 0);

  return (
    <main>
      <AdminPageHeader title="Doublons de clients" subtitle={`${total} points de vente analysés`} />
      <div className="space-y-4 p-4 md:p-6">
        <Link href="/admin/clients" className="flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-300">
          <ArrowLeft size={16} /> Retour aux clients
        </Link>

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">
            Doublons possibles : {groupes.length} groupe(s), {concernes} points de vente
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Critères : même téléphone, même nom ou nom très proche dans la même ville, même emplacement GPS. Rien n&apos;est modifié automatiquement :
            utilisez « Fusionner » pour regrouper les fiches d&apos;un même client en un seul profil (nom définitif au choix). Le stock et la caisse ne changent pas.
          </p>
        </div>

        {groupes.length === 0 && (
          <div className="flex items-center gap-2 rounded-2xl bg-teal-50 p-5 text-sm font-medium text-teal-800">
            <CheckCircle2 size={18} /> Aucun doublon détecté.
          </div>
        )}

        {groupes.map((g, i) => (
          <div key={i} className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
            <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 bg-amber-50 px-4 py-2 dark:border-slate-800 dark:bg-amber-950/30">
              {g.raisons.map((r) => (
                <span key={r} className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">{r}</span>
              ))}
              {superAdmin && <span className="ml-auto"><FusionGroupe membres={g.membres} /></span>}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {g.membres.map((m) => (
                    <tr key={m.id}>
                      <td className="px-4 py-2.5">
                        <Link href={`/admin/points-vente/${m.id}`} className="font-semibold text-slate-800 hover:text-brand dark:text-slate-100">{m.nom}</Link>
                        <p className="text-xs text-slate-400">{m.interlocuteur ?? "—"} · {m.telephone ?? "pas de téléphone"}</p>
                      </td>
                      <td className="px-2 py-2.5 text-slate-600 dark:text-slate-300">{[m.quartier, m.ville].filter(Boolean).join(", ") || "—"}</td>
                      <td className="px-2 py-2.5 text-slate-500">Créé le {new Date(m.creeLe).toLocaleDateString("fr-FR")}</td>
                      <td className="px-4 py-2.5 text-right text-slate-600 dark:text-slate-300">
                        {m.commandesValidees} validée(s) / {m.commandes} commande(s)
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
