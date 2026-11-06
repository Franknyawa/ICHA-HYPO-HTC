"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

/**
 * Prévient quand la page affichée vient de la copie enregistrée sur le téléphone (réseau lent) :
 * les chiffres peuvent alors être en retard. Le service worker nous le dit ; « Actualiser » recharge depuis le serveur.
 */
export function BandeauPageCache() {
  const [etat, setEtat] = useState<"perimee" | "fraiche" | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const url = location.pathname + location.search;
    const sur = (e: MessageEvent) => {
      const d = e.data || {};
      if (d.url !== url) return;
      if (d.type === "ETAT_PAGE" && d.perimee && navigator.onLine) setEtat("perimee");
      if (d.type === "PAGE_FRAICHE_PRETE") setEtat("fraiche");
    };
    navigator.serviceWorker.addEventListener("message", sur);
    navigator.serviceWorker.ready.then((r) => r.active?.postMessage({ type: "ETAT_PAGE", url })).catch(() => {});
    return () => navigator.serviceWorker.removeEventListener("message", sur);
  }, []);

  if (!etat) return null;
  return (
    <div className="flex items-center justify-between gap-3 bg-sky-50 px-4 py-2 text-sm text-sky-900 print:hidden dark:bg-sky-950/40 dark:text-sky-200">
      <span>
        {etat === "fraiche"
          ? "Des données plus récentes sont disponibles."
          : "Réseau lent : cette page affiche la dernière copie enregistrée, les chiffres peuvent être en retard."}
      </span>
      <button onClick={() => location.reload()} className="flex shrink-0 items-center gap-1.5 font-semibold underline">
        <RefreshCw size={14} /> Actualiser
      </button>
    </div>
  );
}
