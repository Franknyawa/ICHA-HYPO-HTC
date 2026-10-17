import Link from "next/link";
import { Store, Truck, UserX, Archive } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/auth/rbac";
import { peutAcceder, LIBELLES_ROLES } from "@/lib/auth/permissions";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ArchiveButton } from "@/components/admin/ArchiveButton";
import { RestaurerUtilisateurButton } from "@/components/admin/RestaurerUtilisateurButton";
import { Panneau } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

const STATUTS = { EN_ATTENTE: "En attente", EN_LIVRAISON: "En livraison", LIVREE: "Livrée", ANNULEE: "Annulée" } as const;

const date = (d: Date) => d.toLocaleDateString("fr-FR", { timeZone: "Africa/Douala" });

export default async function ArchivesPage() {
  const session = await requireAdminPage("archives");
  const voirUtilisateurs = peutAcceder(session.role, "utilisateurs");

  const [pointsVente, commandes, utilisateurs] = await Promise.all([
    prisma.pointVente.findMany({
      where: { archivedAt: { not: null } },
      orderBy: { archivedAt: "desc" },
      take: 200,
      select: { id: true, nom: true, archivedAt: true, ville: { select: { nom: true } }, quartier: { select: { nom: true } } },
    }),
    prisma.commande.findMany({
      where: { archivedAt: { not: null } },
      orderBy: { archivedAt: "desc" },
      take: 200,
      select: {
        id: true,
        statut: true,
        dateCommande: true,
        archivedAt: true,
        pointVente: { select: { nom: true } },
        lignes: { select: { nbCartons: true } },
      },
    }),
    voirUtilisateurs
      ? prisma.user.findMany({
          where: { actif: false },
          orderBy: { updatedAt: "desc" },
          select: { id: true, nom: true, prenom: true, username: true, role: true },
        })
      : Promise.resolve([]),
  ]);

  const vide = (txt: string) => <p className="py-6 text-center text-sm text-slate-400">{txt}</p>;

  return (
    <main className="pb-12">
      <AdminPageHeader
        title="Archives"
        subtitle="Les éléments archivés disparaissent des listes mais leur historique est conservé. Tu peux les restaurer à tout moment."
      />

      <div className="mx-auto max-w-5xl space-y-5 px-4 pt-6 md:px-8">
        <Panneau titre={`Points de vente archivés (${pointsVente.length})`} icone={Store} ton="vert">
          {pointsVente.length === 0 ? (
            vide("Aucun point de vente archivé. Archive-en depuis sa fiche.")
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {pointsVente.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <Link href={`/admin/points-vente/${p.id}`} className="truncate text-sm font-semibold text-slate-800 hover:underline dark:text-slate-100">
                      {p.nom}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {[p.ville?.nom, p.quartier?.nom].filter(Boolean).join(" · ") || "—"} · archivé le {date(p.archivedAt!)}
                    </p>
                  </div>
                  <ArchiveButton url={`/api/points-vente/${p.id}/archiver`} archive={false} compact />
                </li>
              ))}
            </ul>
          )}
        </Panneau>

        <Panneau titre={`Commandes archivées (${commandes.length})`} icone={Truck} ton="ambre">
          {commandes.length === 0 ? (
            vide("Aucune commande archivée. Les commandes livrées ou annulées peuvent être archivées depuis la page Commandes.")
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {commandes.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{c.pointVente.nom}</p>
                    <p className="text-xs text-slate-500">
                      {STATUTS[c.statut]} · {c.lignes.reduce((s, l) => s + l.nbCartons, 0)} carton(s) · commandée le {date(c.dateCommande)} · archivée le {date(c.archivedAt!)}
                    </p>
                  </div>
                  <ArchiveButton url={`/api/commandes/${c.id}/archiver`} archive={false} compact />
                </li>
              ))}
            </ul>
          )}
        </Panneau>

        {voirUtilisateurs && (
          <Panneau titre={`Comptes désactivés (${utilisateurs.length})`} icone={UserX} ton="rose">
            {utilisateurs.length === 0 ? (
              vide("Aucun compte désactivé.")
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {utilisateurs.map((u) => (
                  <li key={u.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {u.prenom} {u.nom}
                      </p>
                      <p className="text-xs text-slate-500">
                        {u.username} · {LIBELLES_ROLES[u.role].nom}
                      </p>
                    </div>
                    <RestaurerUtilisateurButton id={u.id} />
                  </li>
                ))}
              </ul>
            )}
          </Panneau>
        )}

        <p className="flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-500 dark:bg-slate-900">
          <Archive size={14} className="shrink-0" />
          Les ventes, paiements et visites d&apos;un élément archivé restent comptés dans les rapports et la caisse.
        </p>
      </div>
    </main>
  );
}
