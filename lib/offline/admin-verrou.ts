// Verrou du mode hors ligne de l'admin : code PIN local + expiration. Tout reste sur l'appareil (localStorage).
// Ce n'est PAS une connexion : le PIN ne protège que les pages déjà enregistrées, il disparaît à la déconnexion.

export const DUREE_MAX_HORS_LIGNE_MS = 24 * 60 * 60 * 1000; // au-delà, reconnexion avec internet obligatoire
export const DUREE_DEVERROUILLAGE_MS = 30 * 60 * 1000; // inactivité avant de redemander le PIN
const ESSAIS_AVANT_PAUSE = 5;
const ESSAIS_AVANT_EFFACEMENT = 10;
const PAUSE_MS = 5 * 60 * 1000;

const K = {
  pin: "icha_admin_pin", // { sel, hash }
  derniereConnexion: "icha_admin_derniere_connexion",
  echecs: "icha_admin_pin_echecs", // { n, jusqua }
  deverrouille: "icha_admin_deverrouille", // sessionStorage : horodatage
};

const lire = (k: string, s: Storage = localStorage) => {
  try {
    return s.getItem(k);
  } catch {
    return null;
  }
};
const ecrire = (k: string, v: string, s: Storage = localStorage) => {
  try {
    s.setItem(k, v);
  } catch {}
};
const retirer = (k: string, s: Storage = localStorage) => {
  try {
    s.removeItem(k);
  } catch {}
};

const b64 = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf instanceof Uint8Array ? buf : new Uint8Array(buf))));
const deB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function empreinte(pin: string, sel: Uint8Array) {
  const cle = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: sel as unknown as BufferSource, iterations: 150_000, hash: "SHA-256" }, cle, 256);
  return b64(bits);
}

export const pinDefini = () => lire(K.pin) !== null;

export async function definirPin(pin: string) {
  const sel = crypto.getRandomValues(new Uint8Array(16));
  ecrire(K.pin, JSON.stringify({ sel: b64(sel), hash: await empreinte(pin, sel) }));
  retirer(K.echecs);
  marquerDeverrouille();
}

export function supprimerPin() {
  retirer(K.pin);
  retirer(K.echecs);
}

export type ResultatPin = { ok: true } | { ok: false; restant?: number; pauseJusqua?: number; efface?: boolean };

export async function verifierPin(pin: string): Promise<ResultatPin> {
  const brut = lire(K.pin);
  if (!brut) return { ok: true };
  const e = JSON.parse(lire(K.echecs) ?? '{"n":0,"jusqua":0}') as { n: number; jusqua: number };
  if (e.jusqua > Date.now()) return { ok: false, pauseJusqua: e.jusqua };

  const { sel, hash } = JSON.parse(brut) as { sel: string; hash: string };
  if ((await empreinte(pin, deB64(sel))) === hash) {
    retirer(K.echecs);
    marquerDeverrouille();
    return { ok: true };
  }
  const n = e.n + 1;
  if (n >= ESSAIS_AVANT_EFFACEMENT) {
    // Trop d'essais : le PIN et les pages enregistrées sont effacés (reconnexion avec internet nécessaire).
    supprimerPin();
    retirer(K.derniereConnexion);
    return { ok: false, efface: true };
  }
  const jusqua = n % ESSAIS_AVANT_PAUSE === 0 ? Date.now() + PAUSE_MS : 0;
  ecrire(K.echecs, JSON.stringify({ n, jusqua }));
  return { ok: false, restant: ESSAIS_AVANT_EFFACEMENT - n, pauseJusqua: jusqua || undefined };
}

export function marquerDeverrouille() {
  ecrire(K.deverrouille, String(Date.now()), sessionStorage);
}
export function estDeverrouille() {
  const t = Number(lire(K.deverrouille, sessionStorage) ?? 0);
  return t > 0 && Date.now() - t < DUREE_DEVERROUILLAGE_MS;
}

export const noterConnexion = () => ecrire(K.derniereConnexion, String(Date.now()));
export const derniereConnexion = () => Number(lire(K.derniereConnexion) ?? 0) || 0;
export const horsLigneExpire = () => Date.now() - derniereConnexion() > DUREE_MAX_HORS_LIGNE_MS;

/** À la déconnexion : plus aucun PIN ni repère de connexion sur l'appareil. */
export function effacerVerrou() {
  [K.pin, K.derniereConnexion, K.echecs].forEach((k) => retirer(k));
  retirer(K.deverrouille, sessionStorage);
}
