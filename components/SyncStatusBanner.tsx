"use client";

import { useEffect, useState } from "react";
import { countPendingVisites } from "@/lib/offline/db";
import { registerAutoSync, syncPendingVisites } from "@/lib/offline/sync";

export function SyncStatusBanner() {
  const [pending, setPending] = useState(0);
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);

  async function refreshCount() {
    setPending(await countPendingVisites());
  }

  useEffect(() => {
    setOnline(navigator.onLine);
    refreshCount();

    const unregister = registerAutoSync();

    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    // Le compteur peut changer suite à une synchro déclenchée ailleurs
    // (formulaire, retour réseau) — on le rafraîchit à intervalle court.
    const interval = setInterval(refreshCount, 5000);

    return () => {
      unregister();
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      clearInterval(interval);
    };
  }, []);

  async function handleManualSync() {
    setSyncing(true);
    await syncPendingVisites();
    await refreshCount();
    setSyncing(false);
  }

  if (pending === 0 && online) return null;

  return (
    <div
      className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
        online ? "bg-amber-50 text-amber-800" : "bg-slate-200 text-slate-700"
      }`}
    >
      <span>
        {!online && "Hors ligne — "}
        {pending > 0
          ? `${pending} visite${pending > 1 ? "s" : ""} en attente de synchronisation`
          : "Connecté"}
      </span>
      {online && pending > 0 && (
        <button
          onClick={handleManualSync}
          disabled={syncing}
          className="font-medium underline disabled:opacity-50"
        >
          {syncing ? "Synchro..." : "Synchroniser"}
        </button>
      )}
    </div>
  );
}
