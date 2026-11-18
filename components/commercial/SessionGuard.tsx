"use client";

import { useEffect } from "react";
import { fetchAvecDelai } from "@/lib/utils/fetch-delai";
import { quitterSessionExpiree } from "@/lib/offline/session-locale";

/**
 * Surveille la session de l'application terrain. Dès que le serveur répond « non authentifié » (session expirée,
 * révoquée, compte désactivé), l'appli vide les données locales du compte et ouvre la page de connexion, au lieu
 * de laisser un formulaire affiché qui échouera à l'envoi. Une absence de réseau n'est jamais prise pour une expiration.
 */
export function SessionGuard() {
  useEffect(() => {
    let arrete = false;

    async function verifier() {
      if (arrete || !navigator.onLine) return;
      try {
        const res = await fetchAvecDelai("/api/me", { cache: "no-store" }, 10_000);
        if (res.status === 401 && !arrete) await quitterSessionExpiree();
      } catch {
        /* réseau coupé ou lent : on ne conclut rien */
      }
    }

    const visible = () => {
      if (document.visibilityState === "visible") verifier();
    };
    verifier();
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("online", verifier);
    window.addEventListener("pageshow", verifier);
    const minuteur = setInterval(verifier, 60_000);
    return () => {
      arrete = true;
      document.removeEventListener("visibilitychange", visible);
      window.removeEventListener("online", verifier);
      window.removeEventListener("pageshow", verifier);
      clearInterval(minuteur);
    };
  }, []);

  return null;
}
