"use client";

import { useCallback, useEffect, useState } from "react";
import { CloudOff, RefreshCw, CheckCircle2 } from "lucide-react";

const CLE_SYNC = "icha_admin_hors_ligne_sync";
const DELAI_AUTO_MS = 20 * 60 * 1000;

function useEnLigne() {
  const [enLigne, setEnLigne] = useState(true);
  useEffect(() => {
    setEnLigne(navigator.onLine);
    const on = () => setEnLigne(true);
    const off = () => setEnLigne(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return enLigne;
}

const lireSync = () => {
  try {
    return Number(localStorage.getItem(CLE_SYNC) ?? 0) || 0;
  } catch {
    return 0;
  }
};

const heure = (t: number) =>
  new Date(t).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/**
 * Mode hors ligne de l'admin = CONSULTATION : les pages visitées ou préchargées restent lisibles sans internet
 * (service worker, public/sw.js). Ce composant : précharge les pages en arrière-plan, affiche un bandeau hors ligne
 * avec la date des données, et bloque proprement toute modification tant qu'il n'y a pas de réseau.
 */
export function HorsLigneAdmin({ hrefs }: { hrefs: string[] }) {
  const enLigne = useEnLigne();
  const [dateDonnees, setDateDonnees] = useState<number | null>(null);

  // Hors ligne : on bloque les modifications (POST / PATCH / PUT / DELETE) avec un message clair.
  useEffect(() => {
    if (enLigne) return;
    const original = window.fetch;
    window.fetch = async (input, init) => {
      const methode = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
      if (methode !== "GET" && methode !== "HEAD") {
        return new Response(
          JSON.stringify({ error: "Hors ligne : le logiciel admin est en consultation seule. Reconnecte-toi à internet pour modifier." }),
          { status: 503, headers: { "Content-Type": "application/json" } }
        );
      }
      return original(input, init);
    };
    return () => {
      window.fetch = original;
    };
  }, [enLigne]);

  // Date d'enregistrement de la page affichée (en-tête Date de la réponse gardée en cache).
  useEffect(() => {
    if (enLigne || !("caches" in window)) return;
    (async () => {
      try {
        const noms = (await caches.keys()).filter((k) => k.startsWith("siri-admin-"));
        for (const nom of noms) {
          const cache = await caches.open(nom);
          const rep = (await cache.match(location.pathname + location.search)) ?? (await cache.match(location.pathname, { ignoreSearch: true }));
          const d = rep?.headers.get("date");
          if (d) return setDateDonnees(new Date(d).getTime());
        }
      } catch {
        // pas de date : le bandeau reste affiché sans
      }
    })();
  }, [enLigne]);

  return enLigne ? null : (
    <div className="sticky top-0 z-50 flex items-start gap-2 bg-amber-500 px-4 py-2 text-sm font-bold text-white shadow print:hidden">
      <CloudOff size={17} className="mt-0.5 shrink-0" />
      <span>
        Hors ligne — consultation seule.{" "}
        <span className="font-semibold text-white/90">
          {dateDonnees ? `Données enregistrées le ${heure(dateDonnees)}.` : "Dernières données enregistrées sur cet appareil."} Les modifications sont désactivées.
        </span>
      </span>
      <span className="hidden" aria-hidden>{hrefs.length}</span>
    </div>
  );
}

/** Pastille du bas de la barre latérale : état de la préparation hors ligne + mise à jour manuelle. */
export function StatutHorsLigne({ hrefs }: { hrefs: string[] }) {
  const enLigne = useEnLigne();
  const [derniere, setDerniere] = useState(0);
  const [enCours, setEnCours] = useState(false);

  const lancer = useCallback(async () => {
    if (!("serviceWorker" in navigator) || !navigator.onLine) return;
    const reg = await navigator.serviceWorker.ready.catch(() => null);
    if (!reg?.active) return;
    setEnCours(true);
    reg.active.postMessage({ type: "PRECHARGER_ADMIN", urls: hrefs });
  }, [hrefs]);

  useEffect(() => {
    setDerniere(lireSync());
    if (!("serviceWorker" in navigator)) return;
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type !== "ADMIN_PRECHARGE_OK") return;
      try {
        localStorage.setItem(CLE_SYNC, String(e.data.date));
      } catch {}
      setDerniere(e.data.date);
      setEnCours(false);
    };
    navigator.serviceWorker.addEventListener("message", onMsg);
    // Préchargement automatique au démarrage si le dernier date de plus de 20 minutes.
    const t = setTimeout(() => {
      if (Date.now() - lireSync() > DELAI_AUTO_MS) lancer();
    }, 4000);
    return () => {
      navigator.serviceWorker.removeEventListener("message", onMsg);
      clearTimeout(t);
    };
  }, [lancer]);

  return (
    <button
      onClick={lancer}
      disabled={enLigne === false || enCours}
      title="Enregistre les pages sur cet appareil pour les consulter sans internet"
      className="mx-3 mb-2 flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-left text-[11px] font-bold text-slate-600 disabled:opacity-60 dark:bg-slate-800/60 dark:text-slate-300"
    >
      {enCours ? <RefreshCw size={14} className="animate-spin text-brand" /> : derniere ? <CheckCircle2 size={14} className="text-teal-600" /> : <CloudOff size={14} className="text-slate-400" />}
      <span>
        {enCours ? "Préparation hors ligne…" : derniere ? `Hors ligne prêt · ${heure(derniere)}` : "Préparer le mode hors ligne"}
      </span>
    </button>
  );
}
