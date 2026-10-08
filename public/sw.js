// Service Worker SIRI IMPORT — permet d'OUVRIR l'application sans réseau.
// (Les DONNÉES hors ligne — référentiels, points de vente, visites en attente —
// sont gérées par IndexedDB, voir lib/offline/.)
//
// - /_next/static/* (fichiers JS/CSS à nom unique) : cache d'abord, définitif.
// - Icônes / logo / manifest : cache puis mise à jour en arrière-plan.
// - Pages de l'app terrain (dashboard, visites, historique, profil) : réseau
//   d'abord ; si le réseau est absent ou lent (> 4 s) on affiche la dernière
//   version connue. Jamais de cache pour l'admin ni pour les appels /api/.
// - Une réponse redirigée (ex. session expirée -> /login) n'est JAMAIS mise
//   en cache : le navigateur refuse de servir une redirection à une navigation.

const VERSION = "v3";
const STATIC_CACHE = `siri-static-${VERSION}`;
const PAGES_CACHE = `siri-pages-${VERSION}`;
const PAGES_TERRAIN = ["/dashboard", "/visites/new", "/visites/rotation", "/visites/reassort", "/historique", "/profil"];
const PAGE_DE_SECOURS = "/visites/new";
const DELAI_RESEAU_MS = 4000;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((c) => c.addAll(["/manifest.json", "/icons/icon-192.png", "/brand/siri-mark.svg"]))
      .catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== STATIC_CACHE && k !== PAGES_CACHE).map((k) => caches.delete(k)))
      )
  );
  self.clients.claim();
});

function cleDePage(pathname) {
  return new Request(self.location.origin + pathname);
}

function estPageTerrain(pathname) {
  return PAGES_TERRAIN.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

async function mettreEnCache(cacheName, request, response) {
  if (!response || !response.ok || response.redirected) return;
  const cache = await caches.open(cacheName);
  await cache.put(request, response.clone());
}

function reponseHorsLigne() {
  return new Response(
    "<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'>" +
      "<title>Hors ligne</title><body style='font-family:system-ui;background:#0a1630;color:#f3dc9b;display:flex;min-height:100vh;align-items:center;justify-content:center;text-align:center;padding:24px'>" +
      "<div><h1 style='font-size:20px'>Hors ligne</h1><p style='color:#cbd5e1'>Cette page n'a pas encore été enregistrée sur le téléphone. Reconnecte-toi à internet puis rouvre l'application.</p></div>",
    { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

async function pageReseauDAbord(event) {
  const request = event.request;
  const url = new URL(request.url);
  const cle = cleDePage(url.pathname);
  const cache = await caches.open(PAGES_CACHE);
  const enCache = await cache.match(cle);

  const reseau = fetch(request).then(async (res) => {
    await mettreEnCache(PAGES_CACHE, cle, res);
    return res;
  });

  if (!enCache) {
    try {
      return await reseau;
    } catch {
      const secours = await cache.match(cleDePage(PAGE_DE_SECOURS));
      return secours || reponseHorsLigne();
    }
  }

  // Une version locale existe : on laisse le réseau répondre, mais pas plus de 4 s.
  const delai = new Promise((resolve) => setTimeout(() => resolve(enCache), DELAI_RESEAU_MS));
  event.waitUntil(reseau.catch(() => {}));
  try {
    return await Promise.race([reseau, delai]);
  } catch {
    return enCache;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // Fichiers de build : le nom change à chaque version, donc cache définitif.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then(async (res) => {
            await mettreEnCache(STATIC_CACHE, request, res);
            return res;
          })
      )
    );
    return;
  }

  if (
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/brand/") ||
    url.pathname === "/manifest.json" ||
    url.pathname === "/apple-touch-icon.png"
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const maj = fetch(request)
          .then(async (res) => {
            await mettreEnCache(STATIC_CACHE, request, res);
            return res;
          })
          .catch(() => cached);
        return cached || maj;
      })
    );
    return;
  }

  if (request.mode === "navigate") {
    if (estPageTerrain(url.pathname)) {
      event.respondWith(pageReseauDAbord(event));
    } else if (url.pathname === "/login") {
      event.respondWith(
        fetch(request).catch(() => caches.match(cleDePage(PAGE_DE_SECOURS)).then((r) => r || reponseHorsLigne()))
      );
    }
    // Admin et le reste : comportement normal du navigateur (réseau).
  }
});

// Télécharge à l'avance les pages terrain ET leurs fichiers JS/CSS, pour que
// toute l'app s'ouvre sans réseau même si on n'a pas encore visité chaque écran.
async function prechargerPages(urls) {
  const pages = await caches.open(PAGES_CACHE);
  const statics = await caches.open(STATIC_CACHE);

  for (const path of urls) {
    try {
      const res = await fetch(path, { credentials: "same-origin" });
      if (!res.ok || res.redirected) continue; // pas connecté : rien à garder
      const html = await res.clone().text();
      await pages.put(cleDePage(path), res);

      const chemins = new Set();
      for (const m of html.matchAll(/\/_next\/static\/[A-Za-z0-9_\-./%\[\]()~]+\.(?:js|css)/g)) chemins.add(m[0]);
      for (const m of html.matchAll(/static\/(?:chunks|css)\/[A-Za-z0-9_\-./%\[\]()~]+\.(?:js|css)/g)) {
        chemins.add("/_next/" + m[0]);
      }
      for (const chemin of chemins) {
        const req = new Request(self.location.origin + chemin);
        if (await statics.match(req)) continue;
        try {
          const r = await fetch(req);
          if (r.ok) await statics.put(req, r);
        } catch {
          // un fichier raté sera retéléchargé à l'usage
        }
      }
    } catch {
      // hors ligne pendant le préchargement : on réessaiera au prochain démarrage
    }
  }
}

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "PRECHARGER_PAGES") {
    event.waitUntil(prechargerPages(Array.isArray(data.urls) ? data.urls : PAGES_TERRAIN));
  } else if (data.type === "VIDER_PAGES") {
    // Déconnexion : on ne laisse pas les pages d'un utilisateur sur le téléphone.
    event.waitUntil(caches.delete(PAGES_CACHE));
  }
});
