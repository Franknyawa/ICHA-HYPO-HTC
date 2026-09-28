"use client";

import { openDB, type DBSchema, type IDBPDatabase } from "idb";

// Schéma IndexedDB local (§12 CDC : "prévoir une solution de stockage côté
// navigateur adaptée à une PWA"). Une seule table pour l'instant : les
// soumissions de visite en attente de synchronisation. Chaque entrée porte
// déjà son uuidClient (généré au moment de la saisie) — c'est CETTE valeur,
// pas une clé locale, qui garantit l'idempotence côté serveur si l'envoi est
// rejoué après une coupure.

export type PendingVisite = {
  uuidClient: string; // clé primaire locale = clé d'idempotence serveur
  payload: unknown; // corps exact envoyé à POST /api/visites
  createdAt: string;
  attempts: number;
  lastError?: string;
};

interface IchaDB extends DBSchema {
  "pending-visites": {
    key: string;
    value: PendingVisite;
  };
}

const DB_NAME = "icha-import-offline";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<IchaDB>> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<IchaDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        db.createObjectStore("pending-visites", { keyPath: "uuidClient" });
      },
    });
  }
  return dbPromise;
}

export async function queuePendingVisite(uuidClient: string, payload: unknown) {
  const db = await getDb();
  await db.put("pending-visites", {
    uuidClient,
    payload,
    createdAt: new Date().toISOString(),
    attempts: 0,
  });
}

export async function listPendingVisites(): Promise<PendingVisite[]> {
  const db = await getDb();
  return db.getAll("pending-visites");
}

export async function countPendingVisites(): Promise<number> {
  const db = await getDb();
  return db.count("pending-visites");
}

export async function removePendingVisite(uuidClient: string) {
  const db = await getDb();
  await db.delete("pending-visites", uuidClient);
}

export async function markAttemptFailed(uuidClient: string, error: string) {
  const db = await getDb();
  const existing = await db.get("pending-visites", uuidClient);
  if (!existing) return;
  await db.put("pending-visites", {
    ...existing,
    attempts: existing.attempts + 1,
    lastError: error,
  });
}
