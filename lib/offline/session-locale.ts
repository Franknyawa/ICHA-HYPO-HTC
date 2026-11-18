"use client";

import { clearOfflineCaches } from "./db";
import { effacerVerrou } from "./admin-verrou";

/**
 * Session terminée (expirée ou déconnexion) : on retire du téléphone tout ce qui appartient à l'utilisateur
 * (copies de données, pages en cache, verrou PIN) pour qu'à la réouverture l'appli montre la connexion.
 * Les visites EN ATTENTE d'envoi sont conservées : elles partiront après reconnexion, sous le même compte.
 */
export async function viderDonneesSession() {
  await clearOfflineCaches();
  try {
    effacerVerrou();
  } catch {
    /* ignoré */
  }
  try {
    const sw = await navigator.serviceWorker?.getRegistration();
    sw?.active?.postMessage({ type: "VIDER_PAGES" });
  } catch {
    /* ignoré */
  }
}

/** Envoie l'utilisateur à la page de connexion après avoir vidé ses données locales. */
export async function quitterSessionExpiree() {
  await viderDonneesSession();
  if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
    window.location.replace("/login?expired=1");
  }
}
