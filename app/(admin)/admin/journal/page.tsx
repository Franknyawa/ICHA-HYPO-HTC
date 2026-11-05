import Link from "next/link";
import { ChevronLeft, ChevronRight, History, Search } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/auth/rbac";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ImprimerButton } from "@/components/admin/ImprimerButton";
import { debutJour, finJour } from "@/lib/utils/periode";

export const dynamic = "force-dynamic";

const PAR_PAGE = 50;
const TYPES: Record<string, string> = {
  COMMANDE: "Commandes",
  VENTE: "Ventes",
  CAISSE: "Caisse",
  STOCK: "Stock",
  CLIENT: "Clients",
  POINT_VENTE: "Points de vente",
  UTILISATEUR: "Utilisateurs",
  PARAMETRE: "Paramètres",
  EXPORT: "Sauvegarde / export",
};
const ROLES: Record<string, string> = { SUPER_ADMIN: "Super admin", ADMIN: "Admin", SUPERVISEUR: "Superviseur", COMMERCIAL: "Commercial" };
const champ = "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";
const heure = (d: Date) =>
  d.toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Douala" });

export default async function JournalPage({ searchParams }: { searchParams: { q?: string; user?: string; type?: string; du?: string; au?: string; page?: string } }) {
  await requireAdminPage("journal");
  const page = Math.max(1, Number(searchParams.page) || 1);
  const q = searchParams.q?.trim();

  const where: Prisma.JournalModificationWhereInput = {
    ...(searchParams.user ? { userId: searchParams.user } : {}),
    ...(searchParams.type ? { entiteType: searchParams.type } : {}),
    ...(searchParams.du || searchParams.au
      ? {
          createdAt: {
            ...(searchParams.du ? { gte: debutJour(searchParams.du) } : {}),
            ...(searchParams.au ? { lte: finJour(searchParams.au) } : {}),
          },
        }
      : {}),
    ...(q
      ? {
          OR: [
            { libelle: { contains: q, mode: "insensitive" } },
            { resume: { contains: q, mode: "insensitive" } },
            { userNom: { contains: q, mode: "insensitive" } },
            { entiteId: { contains: q } },
          ],
        }
      : {}),
  };

  const [lignes, total, utilisateurs] = await Promise.all([
    prisma.journalModification.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAR_PAGE, take: PAR_PAGE }),
    prisma.journalModification.count({ where }),
    prisma.user.findMany({ where: { role: { not: "COMMERCIAL" } }, orderBy: { nom: "asc" }, select: { id: true, nom: true, prenom: true } }),
  ]);

  // Nom lisible de l'élément concerné (client d'une commande, point de vente, utilisateur…).
  const ids = (t: string) => [...new Set(lignes.filter((l) => l.entiteType === t && l.entiteId).map((l) => l.entiteId!))];
  const [commandes, pvs, users] = await Promise.all([
    ids("COMMANDE").length
      ? prisma.commande.findMany({ where: { id: { in: ids("COMMANDE") } }, select: { id: true, montantTotal: true, pointVente: { select: { nom: true } } } })
      : [],
    ids("POINT_VENTE").length ? prisma.pointVente.findMany({ where: { id: { in: ids("POINT_VENTE") } }, select: { id: true, nom: true } }) : [],
    ids("UTILISATEUR").length ? prisma.user.findMany({ where: { id: { in: ids("UTILISATEUR") } }, select: { id: true, nom: true, prenom: true } }) : [],
  ]);
  const nomElement = new Map<string, string>([
    ...commandes.map((c): [string, string] => [c.id, `${c.pointVente.nom} · ${Number(c.montantTotal).toLocaleString("fr-FR")} FCFA`]),
    ...pvs.map((p): [string, string] => [p.id, p.nom]),
    ...users.map((u): [string, string] => [u.id, `${u.prenom} ${u.nom}`]),
  ]);

  const pages = Math.max(1, Math.ceil(total / PAR_PAGE));
  const lien = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...searchParams, page: String(p) })) if (v) sp.set(k, v);
    return `/admin/journal?${sp.toString()}`;
  };

  return (
    <main>
      <div className="hidden p-6 pb-2 print:block">
        <h1 className="text-xl font-bold text-slate-900">ICHA IMPORT — Journal des modifications</h1>
        <p className="text-sm text-slate-500">{total} action{total > 1 ? "s" : ""} · édité le {new Date().toLocaleDateString("fr-FR", { timeZone: "Africa/Douala" })}</p>
      </div>
      <div className="print:hidden">
        <AdminPageHeader title="Journal des modifications" subtitle="Qui a fait quoi, et quand. Visible par le super admin uniquement." />
      </div>

      <div className="space-y-4 p-4 md:p-6">
        <form className="flex flex-wrap items-end gap-2 print:hidden" action="/admin/journal">
          <label className="relative">
            <Search size={14} className="pointer-events-none absolute left-3 top-3 text-slate-400" />
            <input name="q" defaultValue={q} placeholder="Rechercher…" className={`${champ} pl-8`} />
          </label>
          <select name="user" defaultValue={searchParams.user ?? ""} className={champ}>
            <option value="">Toutes les personnes</option>
            {utilisateurs.map((u) => (
              <option key={u.id} value={u.id}>{u.prenom} {u.nom}</option>
            ))}
          </select>
          <select name="type" defaultValue={searchParams.type ?? ""} className={champ}>
            <option value="">Tous les types</option>
            {Object.entries(TYPES).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <input type="date" name="du" defaultValue={searchParams.du} className={champ} aria-label="Du" />
          <input type="date" name="au" defaultValue={searchParams.au} className={champ} aria-label="Au" />
          <button className="rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white">Filtrer</button>
          <Link href="/admin/journal" className="px-2 py-2 text-xs font-semibold text-slate-500">Réinitialiser</Link>
          <div className="ml-auto flex gap-2">
            <ImprimerButton />
          </div>
        </form>

        <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-slate-100 print:shadow-none print:ring-slate-300 dark:bg-slate-900 dark:ring-slate-800">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400 dark:border-slate-800">
                <th className="px-4 py-3 font-semibold">Date et heure</th>
                <th className="px-3 py-3 font-semibold">Qui</th>
                <th className="px-3 py-3 font-semibold">Action</th>
                <th className="px-3 py-3 font-semibold">Élément</th>
                <th className="px-4 py-3 font-semibold">Détail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {lignes.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400"><History className="mx-auto mb-2" size={22} />Aucune action enregistrée pour ces critères.</td></tr>
              )}
              {lignes.map((l) => (
                <tr key={l.id} className="align-top">
                  <td className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-600 dark:text-slate-300">{heure(l.createdAt)}</td>
                  <td className="px-3 py-3">
                    <p className="font-semibold text-slate-800 dark:text-slate-100">{l.userNom}</p>
                    <p className="text-[11px] text-slate-400">{ROLES[l.role] ?? l.role}</p>
                  </td>
                  <td className="px-3 py-3">
                    <p className="font-semibold text-slate-800 dark:text-slate-100">{l.libelle}</p>
                    <p className="text-[11px] text-slate-400">{TYPES[l.entiteType ?? ""] ?? l.entiteType}</p>
                  </td>
                  <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{l.entiteId ? nomElement.get(l.entiteId) ?? <span className="text-[11px] text-slate-400">{l.entiteId.slice(0, 8)}…</span> : "—"}</td>
                  <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                    {l.resume ?? "—"}
                    {l.details != null && (
                      <details className="mt-1 print:hidden">
                        <summary className="cursor-pointer text-[11px] font-semibold text-brand">Données envoyées</summary>
                        <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-2 text-[11px] dark:bg-slate-800">{JSON.stringify(l.details, null, 2)}</pre>
                      </details>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between text-sm print:hidden">
          <p className="text-slate-500">{total} action{total > 1 ? "s" : ""} · page {page} / {pages}</p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={lien(page - 1)} className="flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300"><ChevronLeft size={15} /> Précédent</Link>
            )}
            {page < pages && (
              <Link href={lien(page + 1)} className="flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300">Suivant <ChevronRight size={15} /></Link>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
