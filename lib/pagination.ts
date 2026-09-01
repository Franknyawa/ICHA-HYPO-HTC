import { z } from "zod";

// Pagination OFFSET classique pour les listes admin (§4 doc scalabilité).
// Suffisant tant que les tables restent sous quelques centaines de milliers
// de lignes ; à remplacer par une pagination par curseur sur les tables les
// plus volumineuses (visites, ventes) si la volumétrie l'exige plus tard.

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export function getPaginationParams(searchParams: URLSearchParams) {
  const parsed = paginationSchema.safeParse({
    page: searchParams.get("page") ?? undefined,
    pageSize: searchParams.get("pageSize") ?? undefined,
  });
  const { page, pageSize } = parsed.success
    ? parsed.data
    : { page: 1, pageSize: 20 };

  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

export function buildPaginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  pageSize: number
) {
  return {
    data,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}
