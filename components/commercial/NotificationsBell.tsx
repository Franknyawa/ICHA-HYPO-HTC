"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { apiFetch } from "@/lib/client/apiFetch";

type NotificationItem = {
  id: string;
  message: string;
  lu: boolean;
  createdAt: string;
};

type NotificationsResponse = {
  items: NotificationItem[];
  nonLues: number;
};

function formatRelatif(dateIso: string) {
  const diffMs = Date.now() - new Date(dateIso).getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return `il y a ${diffMin} min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `il y a ${diffH} h`;
  const diffJ = Math.round(diffH / 24);
  return `il y a ${diffJ} j`;
}

// Le décompte non-lu est intentionnellement rafraîchi par polling léger
// (toutes les 45s) plutôt que par une connexion temps réel — pas de socket
// dans cette PWA, et une notif "commande en livraison" n'est pas assez
// urgente pour justifier l'infrastructure supplémentaire.
const INTERVALLE_POLLING_MS = 45_000;

export function NotificationsBell({ initial }: { initial: NotificationsResponse }) {
  const [data, setData] = useState<NotificationsResponse>(initial);
  const [ouvert, setOuvert] = useState(false);
  const [chargement, setChargement] = useState(false);

  async function recharger() {
    try {
      const fresh = await apiFetch<NotificationsResponse>("/api/notifications");
      setData(fresh);
    } catch {
      // silencieux : un échec de polling ne doit pas perturber le tableau de bord
    }
  }

  useEffect(() => {
    const id = setInterval(recharger, INTERVALLE_POLLING_MS);
    return () => clearInterval(id);
  }, []);

  async function marquerLue(id: string) {
    setData((d) => ({
      items: d.items.map((n) => (n.id === id ? { ...n, lu: true } : n)),
      nonLues: Math.max(0, d.nonLues - (d.items.find((n) => n.id === id)?.lu ? 0 : 1)),
    }));
    try {
      await apiFetch(`/api/notifications/${id}`, { method: "PATCH" });
    } catch {
      recharger();
    }
  }

  async function marquerTout() {
    setChargement(true);
    setData((d) => ({ items: d.items.map((n) => ({ ...n, lu: true })), nonLues: 0 }));
    try {
      await apiFetch("/api/notifications/mark-all-read", { method: "POST" });
    } catch {
      recharger();
    } finally {
      setChargement(false);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => {
          setOuvert((o) => !o);
          if (!ouvert) recharger();
        }}
        className="relative flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white"
        aria-label="Notifications"
      >
        <Bell size={15} />
        {data.nonLues > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-alert px-1 text-[9px] font-bold text-white">
            {data.nonLues > 9 ? "9+" : data.nonLues}
          </span>
        )}
      </button>

      {ouvert && (
        <>
          {/* Zone de fermeture au clic extérieur */}
          <div className="fixed inset-0 z-30" onClick={() => setOuvert(false)} />
          <div className="absolute right-0 z-40 mt-2 w-80 max-w-[85vw] rounded-2xl bg-white dark:bg-slate-900 text-left shadow-xl ring-1 ring-slate-100 dark:ring-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-4 py-3">
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100">Notifications</p>
              {data.nonLues > 0 && (
                <button
                  onClick={marquerTout}
                  disabled={chargement}
                  className="text-xs font-semibold text-brand disabled:opacity-50"
                >
                  Tout marquer comme lu
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {data.items.length === 0 && (
                <p className="px-4 py-6 text-center text-xs text-slate-400 dark:text-slate-500">
                  Aucune notification pour l'instant.
                </p>
              )}
              {data.items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => !n.lu && marquerLue(n.id)}
                  className={`block w-full border-b border-slate-50 dark:border-slate-800 px-4 py-3 text-left last:border-0 ${
                    n.lu ? "" : "bg-blue-50/60 dark:bg-blue-950/20"
                  }`}
                >
                  <p className="text-sm text-slate-700 dark:text-slate-200">{n.message}</p>
                  <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                    {formatRelatif(n.createdAt)}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
