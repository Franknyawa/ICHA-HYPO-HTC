"use client";

import {
  listPendingVisites,
  removePendingVisite,
  markAttemptFailed,
  cachePut,
} from "./db";

// §11 CDC : « Dès que la connexion revient, les données sont envoyées
// automatiquement. Le serveur confirme la synchronisation. »
//
// Règles :
// - Envoi dans l'ordre de saisie (un point de vente créé hors ligne doit
//   exister avant la visite suivante qui s'y rattache).
// - Idempotent : rejouer un envoi déjà reçu par le serveur ne crée jamais de
//   doublon (uuidClient) — l'API renvoie l'existant.
// - Erreur réseau / serveur (5xx) : nouvel essai plus tard, avec une attente
//   qui double à chaque échec (15 s … 15 min).
// - Refus définitif (4xx : données invalides, stock insuffisant, date trop
//   ancienne…) : la visite n'est plus rejouée toute seule, elle reste visible
//   avec le motif pour que le commercial décide (réessayer ou supprimer).
// - Session expirée (401) : on s'arrête sans rien perdre ; la synchro reprend
//   après reconnexion.
// - Une visite n'est envoyée que par le compte qui l'a saisie.

let syncing = false;

export type SyncResult = {
  synced: number;
  failed: number;
  /** Visites ignorées car saisies par un autre compte sur cet appareil. */
  autreCompte: number;
  sessionExpiree: boolean;
};

const RIEN: SyncResult = { synced: 0, failed: 0, autreCompte: 0, sessionExpiree: false };

function attente(attempts: number) {
  return Math.min(15 * 60_000, 15_000 * 2 ** Math.min(attempts, 10));
}

export async function syncPendingVisites(opts: { force?: boolean } = {}): Promise<SyncResult> {
  if (syncing || !navigator.onLine) return RIEN;
  syncing = true;

  const result: SyncResult = { ...RIEN };

  try {
    const pending = await listPendingVisites();
    if (pending.length === 0) return result;

    // Qui est connecté ? (valide aussi que la session est toujours active)
    let userId: string | undefined;
    try {
      const me = await fetch("/api/me", { cache: "no-store" });
      if (me.status === 401) return { ...result, sessionExpiree: true };
      if (!me.ok) return result;
      const d = await me.json();
      userId = d.userId;
      await cachePut("me", d);
    } catch {
      return result; // pas de réseau réel
    }

    const maintenant = Date.now();

    for (const item of pending) {
      if (item.userId && userId && item.userId !== userId) {
        result.autreCompte += 1;
        continue;
      }
      if (item.permanent && !opts.force) continue;
      if (!opts.force && item.nextRetryAt && item.nextRetryAt > maintenant) continue;

      try {
        const res = await fetch("/api/visites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item.payload),
        });

        if (res.ok) {
          await removePendingVisite(item.uuidClient);
          result.synced += 1;
        } else if (res.status === 401) {
          result.sessionExpiree = true;
          break;
        } else if (res.status === 408 || res.status === 429 || res.status >= 500) {
          await markAttemptFailed(item.uuidClient, `Serveur indisponible (${res.status})`, {
            nextRetryAt: Date.now() + attente(item.attempts),
          });
          result.failed += 1;
        } else {
          const data = await res.json().catch(() => ({}));
          await markAttemptFailed(item.uuidClient, data.error ?? `Refusée (HTTP ${res.status})`, {
            permanent: true,
          });
          result.failed += 1;
        }
      } catch {
        // Réseau coupé en cours d'envoi : on arrête là, la suite attendra.
        await markAttemptFailed(item.uuidClient, "Réseau indisponible", {
          nextRetryAt: Date.now() + attente(item.attempts),
        });
        result.failed += 1;
        break;
      }
    }
  } finally {
    syncing = false;
  }

  return result;
}

/** À monter une fois (OfflineManager) : réessaie au retour réseau et au retour dans l'app. */
export function registerAutoSync() {
  if (typeof window === "undefined") return () => {};

  const lancer = () => {
    if (navigator.onLine) syncPendingVisites();
  };
  const onVisible = () => {
    if (document.visibilityState === "visible") lancer();
  };

  window.addEventListener("online", lancer);
  document.addEventListener("visibilitychange", onVisible);
  lancer(); // visites restées en attente d'une session précédente

  // Filet de sécurité : l'événement « online » n'est pas fiable partout.
  const interval = setInterval(lancer, 30_000);

  return () => {
    window.removeEventListener("online", lancer);
    document.removeEventListener("visibilitychange", onVisible);
    clearInterval(interval);
  };
}
