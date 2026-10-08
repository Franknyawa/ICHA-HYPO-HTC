"use client";

import { openDB, type DBSchema, type IDBPDatabase } from "idb";

// Stockage local (IndexedDB) du mode hors ligne :
// - "pending-visites" : visites saisies hors ligne, en attente d'envoi. Chaque
//   entrée porte son uuidClient (généré à la saisie) : c'est lui qui garantit
//   l'idempotence côté serveur si l'envoi est rejoué après une coupure.
// - "cache" : copies locales des données de référence (produits, prix, villes,
//   points de vente, profil) pour pouvoir remplir un formulaire sans réseau.

export type PendingVisite = {
  uuidClient: string; // clé primaire locale = clé d'idempotence serveur
  payload: unknown; // corps exact envoyé à POST /api/visites
  createdAt: string;
  attempts: number;
  lastError?: string;
  /** Compte qui a saisi la visite : une visite n'est jamais envoyée sous un autre compte. */
  userId?: string;
  /** Refus définitif du serveur (données invalides…) : n'est plus rejouée automatiquement. */
  permanent?: boolean;
  /** Prochain essai autorisé (ms epoch) — attente croissante après un échec réseau/serveur. */
  nextRetryAt?: number;
};

type CacheEntry = { key: string; value: unknown; savedAt: number };

interface SiriDB extends DBSchema {
  "pending-visites": {
    key: string;
    value: PendingVisite;
  };
  cache: {
    key: string;
    value: CacheEntry;
  };
}

const DB_NAME = "icha-import-offline"; // nom conservé : les visites en attente d'avant la mise à jour restent lisibles
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase<SiriDB>> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<SiriDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("pending-visites")) {
          db.createObjectStore("pending-visites", { keyPath: "uuidClient" });
        }
        if (!db.objectStoreNames.contains("cache")) {
          db.createObjectStore("cache", { keyPath: "key" });
        }
      },
    });
  }
  return dbPromise;
}

// Signale à l'interface (bandeau d'état) que la file a changé.
function notifierChangement() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("siri-sync-changed"));
}

// ---------- Cache de données de référence ----------

export async function cachePut(key: string, value: unknown) {
  try {
    const db = await getDb();
    await db.put("cache", { key, value, savedAt: Date.now() });
  } catch {
    // Stockage plein ou indisponible : le mode hors ligne sera dégradé, rien de bloquant.
  }
}

export async function cacheGet<T>(key: string): Promise<{ value: T; savedAt: number } | null> {
  try {
    const db = await getDb();
    const e = await db.get("cache", key);
    return e ? { value: e.value as T, savedAt: e.savedAt } : null;
  } catch {
    return null;
  }
}

/** À la déconnexion : efface les copies de données, mais JAMAIS les visites en attente. */
export async function clearOfflineCaches() {
  try {
    const db = await getDb();
    await db.clear("cache");
  } catch {
    // ignoré
  }
}

// ---------- File des visites en attente ----------

export async function queuePendingVisite(uuidClient: string, payload: unknown) {
  const db = await getDb();
  const me = await cacheGet<{ userId?: string }>("me");
  await db.put("pending-visites", {
    uuidClient,
    payload,
    createdAt: new Date().toISOString(),
    attempts: 0,
    userId: me?.value?.userId,
  });

  // Point de vente créé à la volée : on l'ajoute tout de suite à la liste
  // locale pour pouvoir le retrouver (réassort…) avant même la synchronisation.
  const pv = (payload as { nouveauPointVente?: { uuidClient?: string; nom?: string; vendeur?: string; telephoneVendeur?: string; typeId?: string }; latitude?: number; longitude?: number })?.nouveauPointVente;
  if (pv?.uuidClient && pv.nom) {
    const liste = (await cacheGet<{ id: string }[]>("points-vente"))?.value ?? [];
    if (!liste.some((p) => p.id === pv.uuidClient)) {
      const p = payload as { latitude?: number; longitude?: number };
      liste.push({
        id: pv.uuidClient,
        nom: pv.nom,
        vendeur: pv.vendeur ?? null,
        telephoneVendeur: pv.telephoneVendeur ?? null,
        villeNom: null,
        quartierNom: null,
        typeId: pv.typeId ?? null,
        latitude: p.latitude ?? null,
        longitude: p.longitude ?? null,
        photoUrl: null,
      } as unknown as { id: string });
      await cachePut("points-vente", liste);
    }
  }
  notifierChangement();
}

export async function listPendingVisites(): Promise<PendingVisite[]> {
  const db = await getDb();
  const all = await db.getAll("pending-visites");
  return all.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function countPendingVisites(): Promise<number> {
  const db = await getDb();
  return db.count("pending-visites");
}

export async function removePendingVisite(uuidClient: string) {
  const db = await getDb();
  await db.delete("pending-visites", uuidClient);
  notifierChangement();
}

export async function markAttemptFailed(
  uuidClient: string,
  error: string,
  opts: { permanent?: boolean; nextRetryAt?: number } = {}
) {
  const db = await getDb();
  const existing = await db.get("pending-visites", uuidClient);
  if (!existing) return;
  await db.put("pending-visites", {
    ...existing,
    attempts: existing.attempts + 1,
    lastError: error,
    permanent: opts.permanent ?? false,
    nextRetryAt: opts.nextRetryAt,
  });
  notifierChangement();
}

/** Remet une visite refusée dans la file (bouton « Réessayer »). */
export async function resetPendingVisite(uuidClient: string) {
  const db = await getDb();
  const existing = await db.get("pending-visites", uuidClient);
  if (!existing) return;
  await db.put("pending-visites", {
    ...existing,
    permanent: false,
    nextRetryAt: undefined,
    lastError: undefined,
    attempts: 0,
  });
  notifierChangement();
}
