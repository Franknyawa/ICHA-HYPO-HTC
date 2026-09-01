"use client";

import {
  listPendingVisites,
  removePendingVisite,
  markAttemptFailed,
} from "./db";

// §11 CDC : "Dès que la connexion revient, les données sont envoyées
// automatiquement. Le serveur confirme la synchronisation."
// Chaque entrée porte son propre uuidClient, donc rejouer un envoi qui a
// réussi côté serveur mais échoué côté client (ex. coupure juste après la
// réponse) ne crée jamais de doublon — l'API renvoie l'existant.

let syncing = false;

export async function syncPendingVisites(): Promise<{
  synced: number;
  failed: number;
}> {
  if (syncing || !navigator.onLine) return { synced: 0, failed: 0 };
  syncing = true;

  let synced = 0;
  let failed = 0;

  try {
    const pending = await listPendingVisites();

    for (const item of pending) {
      try {
        const res = await fetch("/api/visites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item.payload),
        });

        if (res.ok) {
          await removePendingVisite(item.uuidClient);
          synced += 1;
        } else if (res.status >= 400 && res.status < 500) {
          // Erreur de validation définitive (ex. données invalides) : pas la
          // peine de la rejouer indéfiniment, mais on la garde visible pour
          // diagnostic plutôt que de la supprimer silencieusement.
          const data = await res.json().catch(() => ({}));
          await markAttemptFailed(item.uuidClient, data.error ?? `HTTP ${res.status}`);
          failed += 1;
        } else {
          await markAttemptFailed(item.uuidClient, `HTTP ${res.status}`);
          failed += 1;
        }
      } catch {
        // Toujours hors-ligne ou requête interrompue — on retentera plus tard.
        await markAttemptFailed(item.uuidClient, "Réseau indisponible");
        failed += 1;
      }
    }
  } finally {
    syncing = false;
  }

  return { synced, failed };
}

/** À monter une fois dans le layout : réessaie automatiquement au retour réseau. */
export function registerAutoSync() {
  if (typeof window === "undefined") return () => {};

  const onOnline = () => {
    syncPendingVisites();
  };

  window.addEventListener("online", onOnline);
  // Tentative initiale au chargement, au cas où on a des éléments en attente
  // d'une session précédente et qu'on est déjà en ligne.
  if (navigator.onLine) syncPendingVisites();

  // Nouvelle tentative périodique légère (toutes les 60s) tant que l'onglet
  // reste ouvert — filet de sécurité si l'événement "online" du navigateur
  // ne se déclenche pas de façon fiable.
  const interval = setInterval(() => {
    if (navigator.onLine) syncPendingVisites();
  }, 60000);

  return () => {
    window.removeEventListener("online", onOnline);
    clearInterval(interval);
  };
}
