import { prisma } from "@/lib/prisma";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

function enCartons(sachets: number, parCarton: number) {
  const c = Math.floor(sachets / parCarton);
  const reste = sachets % parCarton;
  return reste > 0 ? `${c.toLocaleString("fr-FR")} cartons + ${reste} sachets` : `${c.toLocaleString("fr-FR")} cartons`;
}

/** Vue du superviseur : stock initial et stock disponible par produit, rien d'autre. */
export default async function EtatStock() {
  const [stocks, entrees] = await Promise.all([
    prisma.stock.findMany({ include: { produit: { select: { code: true, nom: true, sachetsParCarton: true } } }, orderBy: { produit: { code: "asc" } } }),
    // Stock initial = total des entrées d'approvisionnement enregistrées (hors retours clients).
    prisma.mouvementStock.groupBy({
      by: ["produitId"],
      where: { type: "ENTREE", referenceType: "AJUSTEMENT_MANUEL" },
      _sum: { quantiteSachets: true },
    }),
  ]);
  const initial = new Map(entrees.map((e) => [e.produitId, e._sum.quantiteSachets ?? 0]));

  return (
    <main>
      <AdminPageHeader title="Gestion du stock" subtitle="État du stock (consultation)" />
      <div className="grid gap-3 p-4 md:grid-cols-2 md:p-6">
        {stocks.map((s) => (
          <div key={s.id} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
            <p className="font-bold text-slate-800 dark:text-slate-100">{s.produit.nom}</p>
            <p className="text-xs text-slate-400">{s.produit.code}</p>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-slate-500 dark:text-slate-400">Stock initial (total entré)</dt>
                <dd className="font-semibold text-slate-800 dark:text-slate-100">{enCartons(initial.get(s.produitId) ?? 0, s.produit.sachetsParCarton)}</dd>
              </div>
              <div className="flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
                <dt className="text-slate-500 dark:text-slate-400">Stock disponible</dt>
                <dd className="text-lg font-bold text-brand">{enCartons(s.quantiteSachets, s.produit.sachetsParCarton)}</dd>
              </div>
            </dl>
          </div>
        ))}
        {stocks.length === 0 && <p className="text-sm text-slate-400">Aucun produit en stock.</p>}
      </div>
    </main>
  );
}
