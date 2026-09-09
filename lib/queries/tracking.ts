import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export type TrackingFilters = {
  commercialId?: string;
  binomeId?: string;
  date?: string; // YYYY-MM-DD, défaut aujourd'hui
};

export async function getVisitesAvecPosition(filters: TrackingFilters) {
  const jour = filters.date ? new Date(filters.date) : new Date();
  const debut = new Date(jour);
  debut.setHours(0, 0, 0, 0);
  const fin = new Date(jour);
  fin.setHours(23, 59, 59, 999);

  const where: Prisma.VisiteWhereInput = {
    dateVisite: { gte: debut, lte: fin },
    latitude: { not: null },
    longitude: { not: null },
    ...(filters.commercialId ? { commercialId: filters.commercialId } : {}),
    ...(filters.binomeId ? { binomeId: filters.binomeId } : {}),
  };

  return prisma.visite.findMany({
    where,
    orderBy: { dateVisite: "asc" },
    select: {
      id: true,
      dateVisite: true,
      latitude: true,
      longitude: true,
      precisionGps: true,
      pointVente: { select: { nom: true } },
      commercial: { select: { id: true, nom: true, prenom: true } },
      binome: { select: { id: true, nom: true } },
    },
  });
}
