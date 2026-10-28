import Link from "next/link";
import { ChevronLeft, ChevronRight, Copy, MapPin, Phone } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/auth/rbac";
import { listerVilles } from "@/lib/geo/synchro-villes";
import { getClientsAcheteurs } from "@/lib/queries/clients-acheteurs";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ClientsActions } from "@/components/admin/ClientsActions";
import { formatFcfa } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

const PAR_PAGE = 30;
const champ =
  "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";

function lien(params: Record<string, string | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
  return `/admin/clients?${sp.toString()}`;
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: { page?: string; search?: string; villeId?: string; quartier?: string; typeId?: string; du?: string; au?: string };
}) {
  await requireAdminPage("clients");
  const f = {
    search: searchParams.search ?? "",
    villeId: searchParams.villeId ?? "",
    quartier: searchParams.quartier ?? "",
    typeId: searchParams.typeId ?? "",
    du: searchParams.du ?? "",
    au: searchParams.au ?? "",
  };

  const [clients, villes, types] = await Promise.all([
    getClientsAcheteurs(f),
    listerVilles(),
    prisma.typePointVente.findMany({ where: { actif: true }, orderBy: { ordre: "asc" }, select: { id: true, nom: true } }),
  ]);

  const page = Math.max(1, Number(searchParams.page) || 1);
  const totalPages = Math.max(1, Math.ceil(clients.length / PAR_PAGE));
  const visibles = clients.slice((page - 1) * PAR_PAGE, page * PAR_PAGE);

  const criteres = [
    f.du || f.au ? `Commandes validées du ${f.du || "…"} au ${f.au || "…"}` : "Toute la période",
    villes.find((v) => v.id === f.villeId)?.nom,
    f.quartier && `Quartier : ${f.quartier}`,
    types.find((t) => t.id === f.typeId)?.nom,
    f.search && `Recherche : ${f.search}`,
  ]
    .filter(Boolean)
    .join(" · ");

  const filtreActif = Boolean(f.search || f.villeId || f.quartier || f.typeId || f.du || f.au);

  return (
    <main>
      <AdminPageHeader title="Clients" subtitle={`${clients.length} point${clients.length > 1 ? "s" : ""} de vente dont la commande a été validée`} />

      <div className="space-y-4 p-4 md:p-6">
        <form action="/admin/clients" className="grid grid-cols-2 gap-2 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800 md:grid-cols-4">
          <input name="search" defaultValue={f.search} placeholder="Code, nom, contact ou téléphone" className={`${champ} col-span-2 md:col-span-2`} />
          <select name="villeId" defaultValue={f.villeId} className={champ}>
            <option value="">Toutes les villes</option>
            {villes.map((v) => (
              <option key={v.id} value={v.id}>{v.nom}</option>
            ))}
          </select>
          <input name="quartier" defaultValue={f.quartier} placeholder="Quartier" className={champ} />
          <select name="typeId" defaultValue={f.typeId} className={champ}>
            <option value="">Tous les types de point de vente</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>{t.nom}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-xs text-slate-500">
            Achats du
            <input type="date" name="du" defaultValue={f.du} className={`${champ} min-w-0 flex-1`} />
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-500">
            au
            <input type="date" name="au" defaultValue={f.au} className={`${champ} min-w-0 flex-1`} />
          </label>
          <div className="col-span-2 flex gap-2 md:col-span-1">
            <button type="submit" className="flex-1 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white">Filtrer</button>
            {filtreActif && (
              <Link href="/admin/clients" className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300">
                Effacer
              </Link>
            )}
          </div>
        </form>

        <div className="flex flex-wrap items-center gap-2">
          <ClientsActions clients={clients} sousTitre={criteres} />
          <Link href="/admin/clients/doublons" className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
            <Copy size={15} /> Doublons et codes clients
          </Link>
        </div>

        <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-400 dark:border-slate-800">
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Localisation</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3 text-right">Commandes</th>
                <th className="px-4 py-3 text-right">Cartons</th>
                <th className="px-4 py-3 text-right">Montant</th>
                <th className="px-4 py-3">Dernier achat</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((c) => (
                <tr key={c.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/70 dark:border-slate-800 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-3">
                    <Link href={`/admin/clients/${c.id}?retour=${encodeURIComponent(lien({ ...f, page: String(page) }))}`} className="font-semibold text-slate-800 hover:text-brand dark:text-slate-100">
                      {c.nom}
                    </Link>
                    {c.codeClient && <span className="ml-2 rounded-md bg-brand/10 px-1.5 py-0.5 text-[10px] font-bold text-brand">{c.codeClient}</span>}
                    <p className="flex items-center gap-1 text-xs text-slate-400">
                      {c.contact}
                      {c.telephone && (
                        <span className="flex items-center gap-0.5"><Phone size={11} />{c.telephone}</span>
                      )}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                    <span className="flex items-center gap-1"><MapPin size={12} className="text-slate-400" />{[c.quartier, c.ville].filter(Boolean).join(", ") || "—"}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{c.type ?? "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{c.nbAchats}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{c.cartons.toLocaleString("fr-FR")}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatFcfa(c.montant)}</td>
                  <td className="px-4 py-3 text-slate-500">{new Date(c.dernierAchat).toLocaleDateString("fr-FR")}</td>
                </tr>
              ))}
              {visibles.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-400">
                    Aucun client ne correspond à ces critères.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
            <span>Page {page} / {totalPages}</span>
            <div className="flex gap-2">
              <Link href={lien({ ...f, page: String(page - 1) })} aria-disabled={page <= 1} className={`flex items-center gap-1 rounded-xl border px-3 py-1.5 font-medium ${page <= 1 ? "pointer-events-none border-slate-100 text-slate-300" : "border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300"}`}>
                <ChevronLeft size={15} /> Précédent
              </Link>
              <Link href={lien({ ...f, page: String(page + 1) })} aria-disabled={page >= totalPages} className={`flex items-center gap-1 rounded-xl border px-3 py-1.5 font-medium ${page >= totalPages ? "pointer-events-none border-slate-100 text-slate-300" : "border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300"}`}>
                Suivant <ChevronRight size={15} />
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
