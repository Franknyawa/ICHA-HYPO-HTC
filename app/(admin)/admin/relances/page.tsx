import Link from "next/link";
import { Phone, MessageCircle, MapPin } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { RelanceActions } from "@/components/admin/RelanceActions";
import { requireAdminPage } from "@/lib/auth/rbac";
import { peutModifier } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

type Onglet = "a-relancer" | "retard" | "convertis" | "abandonnes";
const ONGLETS: { id: Onglet; label: string }[] = [
  { id: "a-relancer", label: "À relancer" },
  { id: "retard", label: "En retard" },
  { id: "convertis", label: "Convertis" },
  { id: "abandonnes", label: "Abandonnés" },
];

function chiffresTel(tel: string | null) {
  return tel ? tel.replace(/[^\d]/g, "") : "";
}

function echeance(date: Date) {
  const debutAujourdhui = new Date();
  debutAujourdhui.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const jours = Math.round((d.getTime() - debutAujourdhui.getTime()) / 86_400_000);
  if (jours < 0) return { texte: `En retard de ${-jours} jour${-jours > 1 ? "s" : ""}`, cls: "bg-red-50 text-alert" };
  if (jours === 0) return { texte: "À relancer aujourd'hui", cls: "bg-amber-50 text-amber-700" };
  return { texte: `Dans ${jours} jour${jours > 1 ? "s" : ""}`, cls: "bg-slate-100 text-slate-600" };
}

export default async function RelancesPage({ searchParams }: { searchParams: { onglet?: string } }) {
  const session = await requireAdminPage("relances");
  const onglet = (ONGLETS.find((o) => o.id === searchParams.onglet)?.id ?? "a-relancer") as Onglet;
  const maintenant = new Date();
  maintenant.setHours(0, 0, 0, 0);

  const where =
    onglet === "convertis" ? { statut: "CONVERTI" }
    : onglet === "abandonnes" ? { statut: "ABANDONNE" }
    : onglet === "retard" ? { statut: "A_RELANCER", dateRelance: { lt: maintenant } }
    : { statut: "A_RELANCER" };

  const [produits, liste, groupes, enRetard] = await Promise.all([
    prisma.produit.findMany({ where: { actif: true }, orderBy: { code: "asc" }, select: { code: true, nom: true } }),
    prisma.prospectIndecis.findMany({
      relationLoadStrategy: "join",
      where,
      orderBy: onglet === "convertis" || onglet === "abandonnes" ? { updatedAt: "desc" } : { dateRelance: "asc" },
      take: 100,
      include: {
        pointVente: { select: { id: true, nom: true, vendeur: true, telephoneVendeur: true, ville: { select: { nom: true } }, quartier: { select: { nom: true } } } },
        commercial: { select: { nom: true, prenom: true } },
      },
    }),
    prisma.prospectIndecis.groupBy({ by: ["statut"], _count: true }),
    prisma.prospectIndecis.count({ where: { statut: "A_RELANCER", dateRelance: { lt: maintenant } } }),
  ]);
  const nb = (s: string) => groupes.find((g) => g.statut === s)?._count ?? 0;
  const compteurs: Record<Onglet, number> = { "a-relancer": nb("A_RELANCER"), retard: enRetard, convertis: nb("CONVERTI"), abandonnes: nb("ABANDONNE") };
  const editable = peutModifier(session.role);

  return (
    <main>
      <AdminPageHeader title="Prospects indécis" subtitle="Clients visités qui ne sont pas encore fixés sur le nombre de cartons" />
      <div className="p-4 md:p-6">
        <div className="mb-4 flex flex-wrap gap-2">
          {ONGLETS.map((o) => (
            <Link
              key={o.id}
              href={`/admin/relances?onglet=${o.id}`}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${
                onglet === o.id ? "bg-brand text-white" : "bg-white text-slate-500 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:ring-slate-700"
              }`}
            >
              {o.label} ({compteurs[o.id]})
            </Link>
          ))}
        </div>

        <div className="space-y-2">
          {liste.map((p) => {
            const e = echeance(p.dateRelance);
            const tel = chiffresTel(p.pointVente.telephoneVendeur);
            return (
              <div key={p.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/admin/points-vente/${p.pointVente.id}`} className="font-semibold text-slate-800 hover:underline dark:text-slate-100">
                      {p.pointVente.nom}
                    </Link>
                    <p className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500 dark:text-slate-400">
                      {p.pointVente.vendeur && <span>{p.pointVente.vendeur}</span>}
                      <span className="flex items-center gap-1">
                        <MapPin size={11} />
                        {[p.pointVente.quartier?.nom, p.pointVente.ville?.nom].filter(Boolean).join(", ") || "—"}
                      </span>
                      <span>Commercial : {p.commercial.prenom} {p.commercial.nom}</span>
                    </p>
                  </div>
                  {p.statut === "A_RELANCER" && (
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${e.cls}`}>{e.texte}</span>
                  )}
                </div>

                <div className="mb-2 flex flex-wrap gap-2 text-xs text-slate-600 dark:text-slate-300">
                  {p.cartonsEstimes ? <span className="rounded-lg bg-slate-100 px-2.5 py-1 dark:bg-slate-800">Envisage {p.cartonsEstimes} carton{p.cartonsEstimes > 1 ? "s" : ""}</span> : <span className="rounded-lg bg-slate-100 px-2.5 py-1 dark:bg-slate-800">Quantité non précisée</span>}
                  <span className="rounded-lg bg-slate-100 px-2.5 py-1 dark:bg-slate-800">Relance prévue le {new Date(p.dateRelance).toLocaleDateString("fr-FR")}</span>
                  <span className="rounded-lg bg-slate-100 px-2.5 py-1 dark:bg-slate-800">
                    {p.nbRelances} relance{p.nbRelances > 1 ? "s" : ""} déjà faite{p.nbRelances > 1 ? "s" : ""}
                  </span>
                </div>
                {p.note && <p className="mb-2 whitespace-pre-line text-sm text-slate-600 dark:text-slate-300">{p.note}</p>}

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {tel && (
                      <>
                        <a href={`tel:+${tel}`} className="flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          <Phone size={13} /> Appeler
                        </a>
                        <a href={`https://wa.me/${tel}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          <MessageCircle size={13} /> WhatsApp
                        </a>
                      </>
                    )}
                  </div>
                  {editable && <RelanceActions id={p.id} statut={p.statut as "A_RELANCER" | "CONVERTI" | "ABANDONNE"} produits={produits} cartonsEstimes={p.cartonsEstimes} />}
                </div>
              </div>
            );
          })}
          {liste.length === 0 && (
            <p className="rounded-2xl bg-white py-10 text-center text-sm text-slate-400 shadow-sm ring-1 ring-slate-100 dark:bg-slate-900 dark:text-slate-500 dark:ring-slate-800">
              Aucun prospect dans cette liste.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
