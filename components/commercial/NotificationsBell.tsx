"use client";

import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
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
          <div className="fixed inset-0 z-30 bg-slate-900/30 md:bg-transparent" onClick={() => setOuvert(false)} />
          {/* Mobile : panneau pleine largeur sous l'en-tête (jamais coupé par le bord
              de l'écran) ; ordinateur : sous la cloche, aligné à droite. */}
          <div className="fixed inset-x-3 top-16 z-40 overflow-hidden rounded-2xl bg-white text-left shadow-2xl ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700 md:absolute md:inset-x-auto md:right-0 md:top-auto md:mt-2 md:w-96">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3.5 dark:border-slate-800">
              <p className="text-base font-bold text-slate-900 dark:text-slate-50">Notifications</p>
              {data.nonLues > 0 && (
                <button
                  onClick={marquerTout}
                  disabled={chargement}
                  className="ml-auto whitespace-nowrap text-[13px] font-semibold text-[#1e3a8a] disabled:opacity-50 dark:text-blue-300"
                >
                  Tout marquer lu
                </button>
              )}
              <button
                onClick={() => setOuvert(false)}
                aria-label="Fermer"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>
            <div className="max-h-[65vh] overflow-y-auto md:max-h-96">
              {data.items.length === 0 && (
                <p className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                  Aucune notification pour l'instant.
                </p>
              )}
              {data.items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => !n.lu && marquerLue(n.id)}
                  className={`block w-full border-b border-slate-100 px-4 py-3.5 text-left last:border-0 dark:border-slate-800 ${
                    n.lu ? "" : "border-l-4 border-l-[#359980] bg-teal-50/70 dark:bg-teal-950/20"
                  }`}
                >
                  <p className={`text-[15px] leading-snug text-slate-800 dark:text-slate-100 ${n.lu ? "" : "font-medium"}`}>{n.message}</p>
                  <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
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
