import { prisma } from "@/lib/prisma";
import { getPaginationParams, buildPaginatedResponse } from "@/lib/pagination";
import type { Prisma } from "@prisma/client";

export type ListCommandesParams = {
  page?: number;
  pageSize?: number;
  statut?: "EN_ATTENTE" | "LIVREE" | "ANNULEE";
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
        pointVente: { select: { nom: true, telephoneVendeur: true, ville: { select: { nom: true } } } },
        client: { select: { nom: true } },
        commercial: { select: { nom: true, prenom: true } },
        lignes: { select: { nbSachets: true, nbFilets: true, nbCartons: true, produit: { select: { code: true } } } },
      },
    }),
    prisma.commande.count({ where }),
  ]);

  return buildPaginatedResponse(data, total, page, pageSize);
}
