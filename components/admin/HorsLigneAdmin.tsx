"use client";

import { useCallback, useEffect, useState } from "react";
import { CloudOff, RefreshCw, CheckCircle2, Lock, KeyRound, X } from "lucide-react";
import {
  definirPin,
  derniereConnexion,
  estDeverrouille,
  horsLigneExpire,
  marquerDeverrouille,
  noterConnexion,
  pinDefini,
  supprimerPin,
  verifierPin,
} from "@/lib/offline/admin-verrou";

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
  const [verrou, setVerrou] = useState<"aucun" | "pin" | "expire">("aucun");

  // En ligne : on note le dernier contact réel avec le serveur (session valide) — point de départ des 24 h.
  useEffect(() => {
    if (!enLigne) return;
    let stop = false;
    const battement = async () => {
      try {
        const r = await fetch("/api/me", { cache: "no-store" });
        if (r.ok && !stop) noterConnexion();
      } catch {}
    };
    battement();
    const t = setInterval(battement, 3 * 60 * 1000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [enLigne]);

  // Hors ligne : expiration au-delà de 24 h, sinon verrou PIN (redemandé après 30 min d'inactivité).
  useEffect(() => {
    if (enLigne) return setVerrou("aucun");
    const evaluer = () => {
      if (horsLigneExpire()) setVerrou("expire");
      else if (pinDefini() && !estDeverrouille()) setVerrou("pin");
      else setVerrou("aucun");
    };
    evaluer();
    const t = setInterval(evaluer, 30 * 1000);
    let dernier = 0;
    const activite = () => {
      const n = Date.now();
      if (n - dernier > 10_000 && estDeverrouille()) {
        dernier = n;
        marquerDeverrouille();
      }
    };
    window.addEventListener("pointerdown", activite);
    window.addEventListener("keydown", activite);
    return () => {
      clearInterval(t);
      window.removeEventListener("pointerdown", activite);
      window.removeEventListener("keydown", activite);
    };
  }, [enLigne]);

  // Expiré : on vide les pages enregistrées (elles ne servent plus à rien sans reconnexion).
  useEffect(() => {
    if (verrou !== "expire") return;
    navigator.serviceWorker?.getRegistration().then((r) => r?.active?.postMessage({ type: "VIDER_PAGES" }));
  }, [verrou]);

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

  if (verrou === "expire") return <EcranExpire />;
  if (verrou === "pin") return <EcranPin onOk={() => setVerrou("aucun")} onEfface={() => setVerrou("expire")} />;

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

function Plein({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-100 p-6 dark:bg-slate-950 print:hidden">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl dark:bg-slate-900">{children}</div>
    </div>
  );
}

function EcranExpire() {
  const d = derniereConnexion();
  return (
    <Plein>
      <CloudOff className="mx-auto mb-3 text-amber-500" size={36} />
      <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">Mode hors ligne expiré</h2>
      <p className="mt-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
        Le mode hors ligne est limité à 24 heures{d ? ` (dernière connexion : ${heure(d)})` : ""}. Les données enregistrées sur cet appareil ont été effacées.
        Reconnecte-toi à internet pour continuer.
      </p>
      <button onClick={() => location.reload()} className="mt-4 w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white">
        Réessayer
      </button>
    </Plein>
  );
}

function EcranPin({ onOk, onEfface }: { onOk: () => void; onEfface: () => void }) {
  const [pin, setPin] = useState("");
  const [msg, setMsg] = useState("");
  const [occupe, setOccupe] = useState(false);

  async function valider(e: React.FormEvent) {
    e.preventDefault();
    if (occupe || !pin) return;
    setOccupe(true);
    const r = await verifierPin(pin);
    setOccupe(false);
    setPin("");
    if (r.ok) return onOk();
    if (r.efface) return onEfface();
    if (r.pauseJusqua) {
      const min = Math.max(1, Math.ceil((r.pauseJusqua - Date.now()) / 60000));
      return setMsg(`Trop d'essais. Réessaie dans ${min} min.`);
    }
    setMsg(`Code incorrect. ${r.restant ?? 0} essai(s) avant effacement des données hors ligne.`);
  }

  return (
    <Plein>
      <Lock className="mx-auto mb-3 text-brand" size={34} />
      <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">Mode hors ligne verrouillé</h2>
      <p className="mt-1 text-sm font-semibold text-slate-500">Entre ton code PIN pour consulter les données.</p>
      <form onSubmit={valider} className="mt-4 space-y-3">
        <input
          type="password"
          inputMode="numeric"
          autoFocus
          maxLength={6}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-center text-2xl font-bold tracking-[0.5em] dark:border-slate-700 dark:bg-slate-800"
        />
        {msg && <p className="text-xs font-bold text-red-600">{msg}</p>}
        <button disabled={occupe || pin.length < 4} className="w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
          Déverrouiller
        </button>
      </form>
    </Plein>
  );
}

/** Définir / changer / retirer le PIN hors ligne (uniquement avec internet). */
function ModalPin({ onClose }: { onClose: () => void }) {
  const actuel = pinDefini();
  const [pin, setPin] = useState("");
  const [conf, setConf] = useState("");
  const [msg, setMsg] = useState("");

  async function enregistrer(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{4,6}$/.test(pin)) return setMsg("Le code doit contenir 4 à 6 chiffres.");
    if (pin !== conf) return setMsg("Les deux codes ne sont pas identiques.");
    await definirPin(pin);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl dark:bg-slate-900">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Code PIN hors ligne</h3>
          <button onClick={onClose} aria-label="Fermer"><X size={18} /></button>
        </div>
        <p className="mb-3 text-xs font-semibold text-slate-500">
          Protège la consultation sans internet sur cet appareil. Ce n'est pas une connexion : le code est effacé à la déconnexion.
        </p>
        <form onSubmit={enregistrer} className="space-y-2">
          {(["Nouveau code (4 à 6 chiffres)", "Confirmer le code"] as const).map((l, i) => (
            <input
              key={l}
              type="password"
              inputMode="numeric"
              maxLength={6}
              placeholder={l}
              value={i ? conf : pin}
              onChange={(e) => (i ? setConf : setPin)(e.target.value.replace(/\D/g, ""))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-bold dark:border-slate-700 dark:bg-slate-800"
            />
          ))}
          {msg && <p className="text-xs font-bold text-red-600">{msg}</p>}
          <button className="w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white">{actuel ? "Changer le code" : "Activer le code"}</button>
          {actuel && (
            <button
              type="button"
              onClick={() => {
                supprimerPin();
                onClose();
              }}
              className="w-full rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              Retirer le code
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

/** Pastille du bas de la barre latérale : état de la préparation hors ligne + mise à jour manuelle. */
export function StatutHorsLigne({ hrefs }: { hrefs: string[] }) {
  const enLigne = useEnLigne();
  const [derniere, setDerniere] = useState(0);
  const [enCours, setEnCours] = useState(false);
  const [modalPin, setModalPin] = useState(false);
  const [aPin, setAPin] = useState(false);
  useEffect(() => setAPin(pinDefini()), [modalPin]);

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
    <>
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
    {enLigne && (
      <button
        onClick={() => setModalPin(true)}
        className="mx-3 mb-2 flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-left text-[11px] font-bold text-slate-600 dark:bg-slate-800/60 dark:text-slate-300"
      >
        <KeyRound size={14} className={aPin ? "text-teal-600" : "text-slate-400"} />
        <span>{aPin ? "Code PIN hors ligne actif" : "Définir un code PIN hors ligne"}</span>
      </button>
    )}
    {modalPin && <ModalPin onClose={() => setModalPin(false)} />}
    </>
  );
}
