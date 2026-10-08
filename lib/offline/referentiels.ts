"use client";

import { cacheGet, cachePut, listPendingVisites } from "./db";

// Données nécessaires pour remplir une visite sans réseau. Chaque lecture
// essaie d'abord le serveur (données à jour, copie locale rafraîchie au
// passage) et se rabat sur la copie locale si le réseau est indisponible.

export type PointVenteLocal = {
  id: string;
  nom: string;
  vendeur: string | null;
  telephoneVendeur: string | null;
  villeNom: string | null;
  quartierNom: string | null;
  typeId: string | null;
  latitude: number | null;
  longitude: number | null;
  photoUrl: string | null;
};

// Erreur « le serveur a répondu non » (session expirée, droits) : on ne la masque
// PAS avec la copie locale — contrairement à une panne réseau.
class ReponseRefusee extends Error {}

async function lireAvecRepli<T>(url: string, cle: string): Promise<T> {
  try {
    const res = await fetch(url);
    if (res.ok) {
      const data = (await res.json()) as T;
      await cachePut(cle, data);
      return data;
    }
    if (res.status === 401 || res.status === 403) throw new ReponseRefusee(String(res.status));
    // 5xx : serveur en panne → copie locale
  } catch (e) {
    if (e instanceof ReponseRefusee) throw e;
    // réseau coupé → copie locale
  }
  const copie = await cacheGet<T>(cle);
  if (copie) return copie.value;
  throw new Error("Données indisponibles hors ligne : ouvre l'app une fois avec du réseau.");
}

export function chargerReferentiels<T = any>() {
  return lireAvecRepli<T>("/api/referentiels", "referentiels");
}

export function chargerMe<T = any>() {
  return lireAvecRepli<T>("/api/me", "me");
}

/** Télécharge et garde en local la liste des points de vente (recherche hors ligne). */
export async function rafraichirPointsVente() {
  const res = await fetch("/api/points-vente/hors-ligne");
  if (!res.ok) return;
  const d = await res.json();
  const liste: PointVenteLocal[] = d.data ?? [];

  // Points de vente créés hors ligne et pas encore envoyés : le serveur ne les
  // connaît pas encore, on les garde dans la liste pour pouvoir les retrouver.
  const connus = new Set(liste.map((p) => p.id));
  for (const v of await listPendingVisites()) {
    const p = pointVenteDepuisVisite(v.payload);
    if (p && !connus.has(p.id)) liste.push(p);
  }
  await cachePut("points-vente", liste);
}

/** Extrait le point de vente créé à la volée dans une visite saisie hors ligne. */
export function pointVenteDepuisVisite(payload: unknown): PointVenteLocal | null {
  const p = payload as {
    nouveauPointVente?: { uuidClient?: string; nom?: string; vendeur?: string; telephoneVendeur?: string; typeId?: string };
    latitude?: number;
    longitude?: number;
  };
  const n = p?.nouveauPointVente;
  if (!n?.uuidClient || !n.nom) return null;
  return {
    id: n.uuidClient,
    nom: n.nom,
    vendeur: n.vendeur ?? null,
    telephoneVendeur: n.telephoneVendeur ?? null,
    villeNom: null,
    quartierNom: null,
    typeId: n.typeId ?? null,
    latitude: p.latitude ?? null,
    longitude: p.longitude ?? null,
    photoUrl: null,
  };
}

/** Rafraîchit toutes les copies locales — à appeler quand on est en ligne. */
export async function rafraichirCaches() {
  if (!navigator.onLine) return;
  await Promise.allSettled([chargerReferentiels(), chargerMe(), rafraichirPointsVente()]);
  await cachePut("derniere-maj", Date.now());
}

function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function normaliser(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Même logique que /api/points-vente/recherche, sur la copie locale. */
export async function rechercherPointsVenteLocal(params: {
  search?: string;
  lat?: number;
  lng?: number;
  limit?: number;
}): Promise<(PointVenteLocal & { distanceKm?: number })[]> {
  const limit = params.limit ?? 15;
  const copie = await cacheGet<PointVenteLocal[]>("points-vente");
  let liste = copie?.value ?? [];

  if (params.search) {
    const q = normaliser(params.search);
    liste = liste.filter(
      (p) => normaliser(p.nom).includes(q) || (p.vendeur ? normaliser(p.vendeur).includes(q) : false)
    );
  }

  if (params.lat != null && params.lng != null) {
    const o = { lat: params.lat, lng: params.lng };
    return liste
      .filter((p) => p.latitude != null && p.longitude != null)
      .map((p) => ({ ...p, distanceKm: distanceKm(o, { lat: p.latitude!, lng: p.longitude! }) }))
      .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0))
      .slice(0, limit);
  }
  return liste.slice(0, limit);
}

export async function pointVenteLocal(id: string): Promise<PointVenteLocal | null> {
  const copie = await cacheGet<PointVenteLocal[]>("points-vente");
  return copie?.value.find((p) => p.id === id) ?? null;
}
