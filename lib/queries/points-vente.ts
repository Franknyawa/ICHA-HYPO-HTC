import { prisma } from "@/lib/prisma";
import { getPaginationParams, buildPaginatedResponse } from "@/lib/pagination";
import type { Prisma } from "@prisma/client";

export type ListPointsVenteParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  villeId?: string;
  quartierId?: string;
  typeId?: string;
  // Tri par nombre de commandes plutôt que par date de création — utile
  // pour repérer les points de vente les plus/moins actifs (demande de
  // Victor : filtre "par nombre de commandes").
  triCommandes?: "asc" | "desc";
};

export async function listPointsVente(params: ListPointsVenteParams) {
  const sp = new URLSearchParams();
  if (params.page) sp.set("page", String(params.page));
  if (params.pageSize) sp.set("pageSize", String(params.pageSize));
  const { page, pageSize, skip, take } = getPaginationParams(sp);

  const where: Prisma.PointVenteWhereInput = {
    ...(params.villeId ? { villeId: params.villeId } : {}),
    ...(params.quartierId ? { quartierId: params.quartierId } : {}),
    ...(params.typeId ? { typeId: params.typeId } : {}),
    ...(params.search
      ? {
          OR: [
            { nom: { contains: params.search, mode: "insensitive" } },
            { vendeur: { contains: params.search, mode: "insensitive" } },
            { repere: { contains: params.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const orderBy: Prisma.PointVenteOrderByWithRelationInput = params.triCommandes
    ? { commandes: { _count: params.triCommandes } }
    : { createdAt: "desc" };

  const [data, total] = await prisma.$transaction([
    prisma.pointVente.findMany({
      where,
      skip,
      take,
      orderBy,
      include: {
        ville: { select: { id: true, nom: true } },
        quartier: { select: { id: true, nom: true } },
        type: { select: { id: true, nom: true } },
        photos: { orderBy: { createdAt: "desc" }, take: 1 },
        _count: { select: { commandes: true } },
      },
    }),
    prisma.pointVente.count({ where }),
  ]);

  return buildPaginatedResponse(data, total, page, pageSize);
}
