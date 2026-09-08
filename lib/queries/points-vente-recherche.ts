import { prisma } from "@/lib/prisma";

export type ResultatRecherchePointVente = {
  id: string;
  nom: string;
  vendeur: string | null;
  telephoneVendeur: string | null;
  villeNom: string | null;
  quartierNom: string | null;
  latitude: number | null;
  longitude: number | null;
  photoUrl: string | null;
  distanceKm?: number;
};

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/**
 * Recherche de point de vente pour les visites de rotation/réassort :
 * par texte (nom boutique ou vendeur) et/ou par proximité GPS. Les deux
 * peuvent se combiner — le texte filtre, la position trie par distance.
 */
export async function rechercherPointsVente(params: {
  search?: string;
  lat?: number;
  lng?: number;
  limit?: number;
}) {
  const limit = params.limit ?? 15;

  const points = await prisma.pointVente.findMany({
    where: params.search
      ? {
          OR: [
            { nom: { contains: params.search, mode: "insensitive" } },
            { vendeur: { contains: params.search, mode: "insensitive" } },
          ],
        }
      : undefined,
    take: params.lat && params.lng ? 200 : limit, // large échantillon si tri par distance ensuite
    orderBy: { createdAt: "desc" },
    include: {
      ville: { select: { nom: true } },
      quartier: { select: { nom: true } },
      photos: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  let resultats: ResultatRecherchePointVente[] = points.map((p) => ({
    id: p.id,
    nom: p.nom,
    vendeur: p.vendeur,
    telephoneVendeur: p.telephoneVendeur,
    villeNom: p.ville?.nom ?? null,
    quartierNom: p.quartier?.nom ?? null,
    latitude: p.latitude ? Number(p.latitude) : null,
    longitude: p.longitude ? Number(p.longitude) : null,
    photoUrl: p.photos[0]?.url ?? null,
  }));

  if (params.lat != null && params.lng != null) {
    const origine = { lat: params.lat, lng: params.lng };
    resultats = resultats
      .filter((r) => r.latitude != null && r.longitude != null)
      .map((r) => ({
        ...r,
        distanceKm: haversineKm(origine, { lat: r.latitude!, lng: r.longitude! }),
      }))
      .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0))
      .slice(0, limit);
  }

  return resultats;
}
