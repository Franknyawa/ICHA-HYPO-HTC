import { prisma } from "@/lib/prisma";
import { getPaginationParams, buildPaginatedResponse } from "@/lib/pagination";
import type { Prisma } from "@prisma/client";

export type ListVentesParams = {
  page?: number;
  pageSize?: number;
  commercialId?: string;
  villeId?: string;
  dateFrom?: string;
  dateTo?: string;
};

export async function listVentes(params: ListVentesParams) {
  const sp = new URLSearchParams();
  if (params.page) sp.set("page", String(params.page));
  if (params.pageSize) sp.set("pageSize", String(params.pageSize));
  const { page, pageSize, skip, take } = getPaginationParams(sp);

  const where: Prisma.VenteWhereInput = {
    ...(params.commercialId ? { commercialId: params.commercialId } : {}),
    ...(params.villeId ? { pointVente: { villeId: params.villeId } } : {}),
    ...(params.dateFrom || params.dateTo
      ? {
          createdAt: {
            ...(params.dateFrom ? { gte: new Date(params.dateFrom) } : {}),
            ...(params.dateTo ? { lte: new Date(`${params.dateTo}T23:59:59`) } : {}),
          },
        }
      : {}),
  };

  const [data, total] = await prisma.$transaction([
    prisma.vente.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      include: {
        pointVente: { select: { nom: true, ville: { select: { nom: true } } } },
        commercial: { select: { nom: true, prenom: true } },
        client: { select: { nom: true } },
        lignes: { select: { nbSachets: true, nbFilets: true, nbCartons: true, produit: { select: { code: true } } } },
        paiements: { select: { montant: true, modePaiement: true, estCredit: true } },
      },
    }),
    prisma.vente.count({ where }),
  ]);

  return buildPaginatedResponse(data, total, page, pageSize);
}
