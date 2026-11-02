import { prisma } from "@/lib/prisma";
import { cartonsEq, SELECT_CONV } from "@/lib/utils/cartons-equiv";

export type VenteBureau = { commercialId: string; binomeId: string | null; cartons: number };

/**
 * Commandes saisies au bureau (administrateur ou superviseur) au nom d'un commercial : elles n'ont pas de « vente terrain »,
 * mais elles comptent dans les chiffres de ce commercial (objectifs, progression, statistiques personnelles).
 * Comprend les cartons commandés et la vente au détail saisie au bureau (facture « CLIENT DIVERS »).
 * Les commandes annulées sont ignorées.
 */
export async function ventesBureau(depuis: Date, jusqua?: Date): Promise<VenteBureau[]> {
  const plage = { gte: depuis, ...(jusqua ? { lte: jusqua } : {}) };
  const [commandes, origines, produits] = await Promise.all([
    prisma.commande.findMany({
      where: { saisiePar: { not: null }, venteId: null, statut: { not: "ANNULEE" }, dateCommande: plage, commercial: { role: "COMMERCIAL" } },
      select: {
        commercialId: true,
        commercial: { select: { binomeId: true } },
        lignes: { where: { detail: false }, select: { nbCartons: true, nbSachets: true, nbFilets: true, produit: { select: SELECT_CONV } } },
      },
    }),
    prisma.commandeDetailOrigine.findMany({
      where: { source: { not: "Terrain" }, createdAt: plage, commande: { statut: { not: "ANNULEE" } } },
      select: { commercialId: true, produitId: true, nbSachets: true, nbFilets: true },
    }),
    prisma.produit.findMany({ select: { id: true, ...SELECT_CONV } }),
  ]);

  const sortie: VenteBureau[] = [];
  for (const c of commandes) {
    const cartons = c.lignes.reduce((s, l) => s + cartonsEq(l, l.produit), 0);
    if (cartons > 0) sortie.push({ commercialId: c.commercialId, binomeId: c.commercial.binomeId, cartons });
  }
  if (origines.length) {
    const pParId = new Map(produits.map((p) => [p.id, p]));
    const ids = [...new Set(origines.map((o) => o.commercialId))];
    const users = await prisma.user.findMany({ where: { id: { in: ids }, role: "COMMERCIAL" }, select: { id: true, binomeId: true } });
    const binomeDe = new Map(users.map((u) => [u.id, u.binomeId]));
    for (const o of origines) {
      if (!binomeDe.has(o.commercialId)) continue; // saisi au nom du bureau, pas d'un commercial
      const p = pParId.get(o.produitId);
      if (!p) continue;
      const cartons = cartonsEq({ nbCartons: 0, nbSachets: o.nbSachets, nbFilets: o.nbFilets }, p);
      if (cartons > 0) sortie.push({ commercialId: o.commercialId, binomeId: binomeDe.get(o.commercialId) ?? null, cartons });
    }
  }
  return sortie;
}
