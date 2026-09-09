"use client";

import { useEffect } from "react";

const INTERVALLE_MS = 3 * 60 * 1000; // 3 minutes

/**
 * Envoie la position du commercial en arrière-plan tant que l'app reste
 * ouverte — alimente le "tracking en direct" côté admin. Ne rend rien à
 * l'écran.
 *
 * Limitation assumée : ce n'est PAS un suivi en arrière-plan permanent.
 * Sans l'app ouverte au premier plan (surtout sur iOS, très restrictif),
 * la position ne se met plus à jour — la carte admin affichera alors la
 * dernière position connue avec son horodatage, pas une position "live"
 * garantie.
 */
export function LocationHeartbeat() {
  useEffect(() => {
    if (!navigator.geolocation) return;

    function envoyerPosition() {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          fetch("/api/me/position", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
            }),
          }).catch(() => {
            // Échec silencieux — pas grave de manquer un battement.
          });
        },
        () => {
          // Autorisation refusée ou position indisponible — silencieux,
          // ne doit jamais interrompre l'usage normal de l'app.
        },
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
      );
    }

    envoyerPosition(); // premier battement immédiat
    const interval = setInterval(envoyerPosition, INTERVALLE_MS);
    return () => clearInterval(interval);
  }, []);

  return null;
}
