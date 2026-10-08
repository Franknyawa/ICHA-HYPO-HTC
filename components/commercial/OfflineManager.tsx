"use client";

import { useCallback, useEffect, useState } from "react";
import { WifiOff, RefreshCw, TriangleAlert, CloudUpload, Trash2 } from "lucide-react";
import {
  listPendingVisites,
  removePendingVisite,
  resetPendingVisite,
  cacheGet,
  cachePut,
  type PendingVisite,
} from "@/lib/offline/db";
import { registerAutoSync, syncPendingVisites } from "@/lib/offline/sync";
import { rafraichirCaches } from "@/lib/offline/referentiels";

const PAGES_A_PRECHARGER = [
  "/dashboard",
  "/visites/new",
  "/visites/rotation",
  "/visites/reassort",
  "/historique",
  "/profil",
];
const INTERVALLE_MAJ_MS = 20 * 60_000;
const INTERVALLE_PRECHARGEMENT_MS = 12 * 60 * 60_000;

function resumePayload(p: PendingVisite): string {
  const d = new Date(p.createdAt);
  const heure = d.toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const payload = p.payload as { nouveauPointVente?: { nom?: string }; vente?: unknown; commande?: unknown };
  const type = payload?.vente ? "Vente" : payload?.commande ? "Commande" : "Visite";
  const nom = payload?.nouveauPointVente?.nom;
  return `${type}${nom ? ` — ${nom}` : ""} · ${heure}`;
}

/**
 * Gère tout le mode hors ligne côté terrain : synchronisation automatique,
 * copies locales des données, préchargement des écrans, et bandeau d'état
 * (affiché seulement quand il y a quelque chose à dire).
 */
export function OfflineManager() {
  const [enLigne, setEnLigne] = useState(true);
  const [attente, setAttente] = useState<PendingVisite[]>([]);
  const [synchro, setSynchro] = useState(false);
  const [sessionExpiree, setSessionExpiree] = useState(false);
  const [autreCompte, setAutreCompte] = useState(0);
  const [detail, setDetail] = useState(false);

  const rafraichirListe = useCallback(async () => {
    try {
      setAttente(await listPendingVisites());
    } catch {
      // IndexedDB indisponible (navigation privée…) : pas de bandeau
    }
  }, []);

  const lancerSynchro = useCallback(
    async (force = false) => {
      setSynchro(true);
      const r = await syncPendingVisites({ force });
      setSessionExpiree(r.sessionExpiree);
      setAutreCompte(r.autreCompte);
      await rafraichirListe();
      setSynchro(false);
    },
    [rafraichirListe]
  );

  useEffect(() => {
    setEnLigne(navigator.onLine);
    rafraichirListe();

    const desinscrire = registerAutoSync();

    const surEnLigne = () => {
      setEnLigne(true);
      rafraichirCaches();
    };
    const surHorsLigne = () => setEnLigne(false);
    const surChangement = () => rafraichirListe();
    window.addEventListener("online", surEnLigne);
    window.addEventListener("offline", surHorsLigne);
    window.addEventListener("siri-sync-changed", surChangement);

    // Copies locales + préchargement des écrans, au démarrage puis régulièrement.
    async function preparerHorsLigne() {
      if (!navigator.onLine) return;
      const derniere = await cacheGet<number>("derniere-maj");
      if (!derniere || Date.now() - derniere.value > INTERVALLE_MAJ_MS) await rafraichirCaches();

      const prech = await cacheGet<number>("precharge-pages");
      if (!prech || Date.now() - prech.value > INTERVALLE_PRECHARGEMENT_MS) {
        const sw = await navigator.serviceWorker?.ready.catch(() => null);
        sw?.active?.postMessage({ type: "PRECHARGER_PAGES", urls: PAGES_A_PRECHARGER });
        await cachePut("precharge-pages", Date.now());
      }

      // Génération de factures hors ligne : le code PDF doit être déjà téléchargé.
      const pdf = await cacheGet<boolean>("precharge-pdf-v1");
      if (!pdf) {
        try {
          await Promise.all([import("jspdf"), import("jspdf-autotable"), import("@/lib/utils/facture-pdf")]);
          await cachePut("precharge-pdf-v1", true);
        } catch {
          // réessayé au prochain démarrage
        }
      }
    }
    const demarrage = setTimeout(preparerHorsLigne, 2500); // après l'affichage de la page
    const intervalleMaj = setInterval(preparerHorsLigne, INTERVALLE_MAJ_MS);

    return () => {
      desinscrire();
      clearTimeout(demarrage);
      clearInterval(intervalleMaj);
      window.removeEventListener("online", surEnLigne);
      window.removeEventListener("offline", surHorsLigne);
      window.removeEventListener("siri-sync-changed", surChangement);
    };
  }, [rafraichirListe]);

  const refusees = attente.filter((p) => p.permanent);
  const enAttente = attente.filter((p) => !p.permanent);

  if (enLigne && attente.length === 0 && !sessionExpiree) return null;

  return (
    <div className="print:hidden">
      {!enLigne && (
        <div className="flex items-center gap-2 bg-slate-800 px-4 py-2 text-sm text-slate-100">
          <WifiOff size={16} className="shrink-0 text-[#e8cd85]" />
          <span>
            Hors ligne — tes visites sont gardées sur le téléphone et partiront dès que le réseau revient.
          </span>
        </div>
      )}

      {sessionExpiree && (
        <div className="flex items-center gap-2 bg-amber-100 px-4 py-2 text-sm text-amber-900">
          <TriangleAlert size={16} className="shrink-0" />
          <span>
            Session expirée : reconnecte-toi pour envoyer tes visites en attente (elles ne sont pas perdues).
          </span>
        </div>
      )}

      {enAttente.length > 0 && (
        <div className="flex items-center justify-between gap-3 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <span className="flex items-center gap-2">
            <CloudUpload size={16} className="shrink-0" />
            {enAttente.length} visite{enAttente.length > 1 ? "s" : ""} en attente d&apos;envoi
            {autreCompte > 0 && ` (+${autreCompte} d'un autre compte)`}
          </span>
          {enLigne && (
            <button
              onClick={() => lancerSynchro(true)}
              disabled={synchro}
              className="flex shrink-0 items-center gap-1.5 font-semibold underline disabled:opacity-50"
            >
              <RefreshCw size={14} className={synchro ? "animate-spin" : ""} />
              {synchro ? "Envoi..." : "Envoyer"}
            </button>
          )}
        </div>
      )}

      {refusees.length > 0 && (
        <div className="bg-red-50 px-4 py-2 text-sm text-red-900 dark:bg-red-950/40 dark:text-red-200">
          <button onClick={() => setDetail((v) => !v)} className="flex w-full items-center gap-2 text-left font-medium">
            <TriangleAlert size={16} className="shrink-0" />
            {refusees.length} visite{refusees.length > 1 ? "s" : ""} refusée{refusees.length > 1 ? "s" : ""} par le
            serveur — {detail ? "masquer" : "voir"}
          </button>
          {detail && (
            <ul className="mt-2 space-y-2">
              {refusees.map((p) => (
                <li key={p.uuidClient} className="rounded-lg bg-white/70 p-2.5 dark:bg-slate-900/60">
                  <p className="font-medium">{resumePayload(p)}</p>
                  <p className="text-xs">{p.lastError}</p>
                  <div className="mt-1.5 flex gap-4 text-xs font-semibold">
                    <button
                      onClick={async () => {
                        await resetPendingVisite(p.uuidClient);
                        lancerSynchro(true);
                      }}
                      className="flex items-center gap-1 underline"
                    >
                      <RefreshCw size={12} /> Réessayer
                    </button>
                    <button
                      onClick={async () => {
                        if (window.confirm("Supprimer définitivement cette visite du téléphone ?")) {
                          await removePendingVisite(p.uuidClient);
                        }
                      }}
                      className="flex items-center gap-1 underline"
                    >
                      <Trash2 size={12} /> Supprimer
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
