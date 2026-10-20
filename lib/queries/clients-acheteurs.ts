import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { debutJour, finJour } from "@/lib/utils/periode";

export type FiltreClients = {
  search?: string;
  villeId?: string;
  quartier?: string;
  typeId?: string;
  du?: string;
  au?: string;
};

export type ClientAcheteur = {
  id: string;
  nom: string;
  contact: string | null;
  telephone: string | null;
  ville: string | null;
  quartier: string | null;
  type: string | null;
  nbAchats: number;
  montant: number;
  dernierAchat: string;
};

const JOUR = /^\d{4}-\d{2}-\d{2}$/;
const MAX_CLIENTS = 3000;

/**
 * « Clients » = tous les points de vente qui ont déjà acheté, c'est-à-dire
 * au moins une vente ou une commande non annulée (dans la période choisie,
 * s'il y en a une). Les totaux ne comptent que cette période.
 */
export async function getClientsAcheteurs(f: FiltreClients): Promise<ClientAcheteur[]> {
  const debut = f.du && JOUR.test(f.du) ? debutJour(f.du) : null;
  const fin = f.au && JOUR.test(f.au) ? finJour(f.au) : null;
  const plage = (champ: "dateVente" | "dateCommande") =>
    debut || fin ? { [champ]: { ...(debut ? { gte: debut } : {}), ...(fin ? { lte: fin } : {}) } } : {};

  const venteOk: Prisma.VenteWhereInput = plage("dateVente");
  const commandeOk: Prisma.CommandeWhereInput = { statut: { not: "ANNULEE" }, ...plage("dateCommande") };

  const recherche = f.search?.trim();
  const where: Prisma.PointVenteWhereInput = {
    AND: [
      { OR: [{ ventes: { some: venteOk } }, { commandes: { some: commandeOk } }] },
      ...(f.villeId ? [{ villeId: f.villeId }] : []),
      ...(f.quartier?.trim() ? [{ quartier: { nom: { contains: f.quartier.trim(), mode: "insensitive" as const } } }] : []),
      ...(f.typeId ? [{ OR: [{ typeId: f.typeId }, { typesIds: { has: f.typeId } }] }] : []),
      ...(recherche
        ? [
            {
              OR: [
                { nom: { contains: recherche, mode: "insensitive" as const } },
                { vendeur: { contains: recherche, mode: "insensitive" as const } },
                { telephoneVendeur: { contains: recherche } },
              ],
            },
          ]
        : []),
    ],
  };

  const points = await prisma.pointVente.findMany({
    where,
    take: MAX_CLIENTS,
    select: {
      id: true,
      nom: true,
      vendeur: true,
      telephoneVendeur: true,
      ville: { select: { nom: true } },
      quartier: { select: { nom: true } },
      type: { select: { nom: true } },
    },
  });
  if (points.length === 0) return [];
  const ids = points.map((p) => p.id);

  const [ventes, commandes] = await Promise.all([
    prisma.vente.groupBy({
      by: ["pointVenteId"],
      where: { pointVenteId: { in: ids }, ...venteOk },
      _sum: { montantTotal: true },
      _count: { _all: true },
      _max: { dateVente: true },
    }),
    prisma.commande.groupBy({
      by: ["pointVenteId"],
      where: { pointVenteId: { in: ids }, ...commandeOk },
      _sum: { montantTotal: true },
      _count: { _all: true },
      _max: { dateCommande: true },
    }),
  ]);
  const vMap = new Map(ventes.map((v) => [v.pointVenteId, v]));
  const cMap = new Map(commandes.map((c) => [c.pointVenteId, c]));

  return points
    .map((p) => {
      const v = vMap.get(p.id);
      const c = cMap.get(p.id);
      const dates = [v?._max.dateVente, c?._max.dateCommande].filter(Boolean) as Date[];
      const dernier = dates.length ? new Date(Math.max(...dates.map((d) => d.getTime()))) : new Date(0);
      return {
        id: p.id,
        nom: p.nom,
        contact: p.vendeur,
        telephone: p.telephoneVendeur,
        ville: p.ville?.nom ?? null,
        quartier: p.quartier?.nom ?? null,
        type: p.type?.nom ?? null,
        nbAchats: (v?._count._all ?? 0) + (c?._count._all ?? 0),
        montant: Number(v?._sum.montantTotal ?? 0) + Number(c?._sum.montantTotal ?? 0),
        dernierAchat: dernier.toISOString(),
      };
    })
    .sort((a, b) => b.dernierAchat.localeCompare(a.dernierAchat));
}
