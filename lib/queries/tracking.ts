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

export type PointVenteCarte = {
  id: string;
  nom: string;
  latitude: number;
  longitude: number;
  vendeur: string | null;
  telephone: string | null;
  ville: string | null;
  quartier: string | null;
  type: string | null;
  /** client = au moins une commande validée ; indecis = à relancer ; prospect = renseigné sans commande. */
  statut: "client" | "indecis" | "prospect";
  nbCommandes: number;
  commercial: string;
};

/** Tous les points de vente renseignés (non archivés), avec leur position GPS quand elle existe. */
export async function getPointsVenteCarte(filters: { villeId?: string; typeId?: string; statut?: string; commercialId?: string }) {
  const where: Prisma.PointVenteWhereInput = {
    archivedAt: null,
    nom: { not: "CLIENT DIVERS" },
    ...(filters.villeId ? { villeId: filters.villeId } : {}),
    ...(filters.typeId ? { OR: [{ typeId: filters.typeId }, { typesIds: { has: filters.typeId } }] } : {}),
    ...(filters.commercialId ? { createdById: filters.commercialId } : {}),
  };
  const lignes = await prisma.pointVente.findMany({
    where,
    select: {
      id: true,
      nom: true,
      vendeur: true,
      telephoneVendeur: true,
      latitude: true,
      longitude: true,
      ville: { select: { nom: true } },
      quartier: { select: { nom: true } },
      type: { select: { nom: true } },
      createdBy: { select: { nom: true, prenom: true } },
      commandes: { where: { valideeAt: { not: null }, statut: { not: "ANNULEE" } }, select: { id: true } },
      prospectsIndecis: { where: { statut: "A_RELANCER" }, select: { id: true } },
    },
    orderBy: { nom: "asc" },
  });

  const tous = lignes.map((p) => {
    const statut: PointVenteCarte["statut"] = p.commandes.length > 0 ? "client" : p.prospectsIndecis.length > 0 ? "indecis" : "prospect";
    return {
      id: p.id,
      nom: p.nom,
      latitude: p.latitude === null ? NaN : Number(p.latitude),
      longitude: p.longitude === null ? NaN : Number(p.longitude),
      vendeur: p.vendeur,
      telephone: p.telephoneVendeur,
      ville: p.ville?.nom ?? null,
      quartier: p.quartier?.nom ?? null,
      type: p.type?.nom ?? null,
      statut,
      nbCommandes: p.commandes.length,
      commercial: `${p.createdBy.prenom} ${p.createdBy.nom}`,
    };
  });
  const filtres = filters.statut === "client" || filters.statut === "indecis" || filters.statut === "prospect" ? tous.filter((p) => p.statut === filters.statut) : tous;
  const geolocalises = filtres.filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude));
  return { points: geolocalises as PointVenteCarte[], total: filtres.length, sansPosition: filtres.length - geolocalises.length };
}
