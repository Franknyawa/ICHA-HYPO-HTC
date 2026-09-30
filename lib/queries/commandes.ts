import { prisma } from "@/lib/prisma";
import { getPaginationParams, buildPaginatedResponse } from "@/lib/pagination";
import type { Prisma } from "@prisma/client";

export type StatutCommandeFiltre = "EN_ATTENTE" | "EN_LIVRAISON" | "LIVREE" | "ANNULEE";

export type ListCommandesParams = {
  page?: number;
  pageSize?: number;
  statut?: StatutCommandeFiltre;
  villeId?: string;
  commercialId?: string;
  dateFrom?: string;
  dateTo?: string;
};

export async function listCommandes(params: ListCommandesParams) {
  const sp = new URLSearchParams();
  if (params.page) sp.set("page", String(params.page));
  if (params.pageSize) sp.set("pageSize", String(params.pageSize));
  const { page, pageSize, skip, take } = getPaginationParams(sp);

  const where: Prisma.CommandeWhereInput = {
    ...(params.statut ? { statut: params.statut } : {}),
    ...(params.villeId ? { pointVente: { villeId: params.villeId } } : {}),
    ...(params.commercialId ? { commercialId: params.commercialId } : {}),
    ...(params.dateFrom || params.dateTo
      ? {
          dateCommande: {
            ...(params.dateFrom ? { gte: new Date(params.dateFrom) } : {}),
            ...(params.dateTo ? { lte: new Date(`${params.dateTo}T23:59:59`) } : {}),
          },
        }
      : {}),
  };

  const [data, total] = await prisma.$transaction([
    prisma.commande.findMany({
      where,
      skip,
      take,
      orderBy: { dateCommande: "desc" },
      include: {
        pointVente: {
          select: {
            nom: true,
            vendeur: true,
            telephoneVendeur: true,
            ville: { select: { nom: true } },
            quartier: { select: { nom: true } },
          },
        },
        client: { select: { nom: true } },
        commercial: { select: { nom: true, prenom: true } },
        lignes: { select: { nbSachets: true, nbFilets: true, nbCartons: true, produit: { select: { code: true } } } },
      },
    }),
    prisma.commande.count({ where }),
  ]);

  return buildPaginatedResponse(data, total, page, pageSize);
}

/**
 * Compte les commandes par statut, pour les pastilles de filtre rapide de
 * la page admin (mêmes filtres ville/commercial/date que la liste, mais
 * sans filtrer par statut — sinon les autres pastilles retomberaient à 0).
 */
export async function countCommandesParStatut(
  params: Omit<ListCommandesParams, "page" | "pageSize" | "statut">
) {
  const where: Prisma.CommandeWhereInput = {
    ...(params.villeId ? { pointVente: { villeId: params.villeId } } : {}),
    ...(params.commercialId ? { commercialId: params.commercialId } : {}),
    ...(params.dateFrom || params.dateTo
      ? {
          dateCommande: {
            ...(params.dateFrom ? { gte: new Date(params.dateFrom) } : {}),
            ...(params.dateTo ? { lte: new Date(`${params.dateTo}T23:59:59`) } : {}),
          },
        }
      : {}),
  };

  const groupes = await prisma.commande.groupBy({
    by: ["statut"],
    where,
    _count: true,
  });

  const parStatut: Record<StatutCommandeFiltre, number> = {
    EN_ATTENTE: 0,
    EN_LIVRAISON: 0,
    LIVREE: 0,
    ANNULEE: 0,
  };
  for (const g of groupes) parStatut[g.statut as StatutCommandeFiltre] = g._count;

  const total = Object.values(parStatut).reduce((a, b) => a + b, 0);
  return { parStatut, total };
}
