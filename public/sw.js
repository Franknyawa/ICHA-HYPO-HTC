// Service Worker minimal — §10 CDC : "mettre en cache les ressources
// essentielles, permettre l'ouverture de l'application avec une connexion
// faible, faciliter la synchronisation des données."
//
// Stratégie volontairement simple pour ce MVP :
// - App shell (login, dashboard, nouvelle visite) en cache-first après
//   première visite, pour pouvoir rouvrir l'app hors ligne.
// - Tout le reste (API, données) : réseau uniquement — le mode offline des
//   DONNÉES est géré par IndexedDB (lib/offline/), pas par le Service
//   Worker, qui ne fait que permettre à l'app de s'OUVRIR sans réseau.

const CACHE_NAME = "icha-shell-v1";
const APP_SHELL = ["/login", "/dashboard", "/visites/new", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
        )
      )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Jamais mettre en cache les appels API — ils doivent toujours refléter
  // l'état réel du serveur (ou échouer explicitement pour que la file
  // offline IndexedDB prenne le relais).
  if (request.url.includes("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match(request).then((r) => r || caches.match("/dashboard")))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request))
  );
});
