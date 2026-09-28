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

/**
 * Dernière position connue de chaque commercial actif — alimentée par le
 * battement envoyé depuis la PWA pendant que l'app reste ouverte
 * (voir components/commercial/LocationHeartbeat.tsx). Ce n'est PAS un
 * suivi en arrière-plan garanti : un commercial sans l'app ouverte
 * récemment n'aura pas de position à jour.
 */
export async function getPositionsActuelles(filters: { binomeId?: string }) {
  const users = await prisma.user.findMany({
    where: {
      role: "COMMERCIAL",
      actif: true,
      dernierePositionLat: { not: null },
      dernierePositionLng: { not: null },
      ...(filters.binomeId ? { binomeId: filters.binomeId } : {}),
    },
    select: {
      id: true,
      nom: true,
      prenom: true,
      dernierePositionLat: true,
      dernierePositionLng: true,
      dernierePositionAt: true,
      binome: { select: { nom: true } },
    },
    orderBy: { dernierePositionAt: "desc" },
  });

  return users.map((u) => ({
    id: u.id,
    nom: `${u.prenom} ${u.nom}`,
    binomeNom: u.binome?.nom ?? null,
    latitude: Number(u.dernierePositionLat),
    longitude: Number(u.dernierePositionLng),
    positionAt: u.dernierePositionAt!.toISOString(),
  }));
}
