# ICHA IMPORT — HYPO / HTC — Architecture technique

## 1. Stack retenue

| Couche | Choix | Raison |
|---|---|---|
| Frontend + Backend | Next.js 14+ (App Router) + TypeScript | Une seule base de code pour PWA commerciale + dashboard admin (§6 CDC) |
| Base de données | PostgreSQL (Neon ou équivalent serverless) | Compatible Vercel, pooling de connexions serverless |
| ORM | Prisma | Migrations versionnées, types générés |
| Stockage fichiers | S3-compatible (Cloudflare R2 / AWS S3) | Photos jamais en base (§12 scalabilité doc) |
| PWA | Web App Manifest + Service Worker + IndexedDB | Offline-first terrain (§11-12 CDC) |
| Déploiement | Vercel (dev / preview / production) | Cible imposée |

## 2. Principes structurants (issus des 3 documents)

1. **Rien n'est codé en dur** : villes, quartiers, types de point de vente, produits,
   objectifs sont des données en base, modifiables depuis l'admin — pas des enums figés
   dans le code (seuls `Role`, `StatutXxx`, `ModePaiement` sont des enums, car ce sont des
   états métier stables, pas des données de configuration).
2. **Idempotence** : chaque écriture créée côté PWA (visite, vente, commande, paiement,
   photo, mouvement de stock) porte un `uuidClient` généré sur le téléphone *avant*
   synchronisation. La contrainte `@unique` en base empêche tout doublon si la requête
   est rejouée après une coupure réseau.
3. **Transactionnel vs analytique** : les tables `ventes`, `commandes`, `paiements`,
   `visites`, `mouvements_stock` sont la source de vérité. Les tables `agg_*` sont
   recalculées par job (cron Vercel) et ne sont jamais interrogées en écriture directe
   par le parcours commercial.
4. **Pagination systématique** : aucune route API n'expose `SELECT *` sans `LIMIT` /
   curseur. Toutes les listes admin (points de vente, ventes, commandes...) sont paginées
   côté serveur dès le MVP, même avec peu de données au lancement.
5. **Stock transactionnel** : toute vente/commande qui affecte le stock passe par une
   transaction Prisma (`$transaction`) avec verrou optimiste (`version` sur `Stock`) pour
   éviter la double déduction en cas d'écritures concurrentes (§18 doc scalabilité).

## 3. Modules (mappés aux dossiers `app/`)

- `(auth)` — authentification (identifiant + code personnel commercial / email+mdp admin)
- `(commercial)` — PWA terrain : dashboard, nouvelle visite, historique
- `(admin)` — dashboard web : commerciaux, binômes, points de vente, clients, prospects,
  ventes, commandes, stock, objectifs, statistiques, carte, rapports
- `api/` — Route Handlers Next.js (une route par ressource, toutes paginées/filtrées
  côté serveur)

## 4. Ordre de développement proposé (MVP)

1. Setup projet + Prisma + connexion DB + seed (villes, produits HYPO/HTC, binômes)
2. Authentification + rôles + middleware de permissions
3. Module Points de vente / Prospects / Clients (CRUD + recherche serveur)
4. Module Visites (formulaire terrain, GPS, photo, uuid client)
5. Mode offline (IndexedDB + Service Worker + file de synchronisation)
6. Module Ventes / Commandes / Paiements (transactionnel + stock)
7. Dashboard admin (KPI, tableaux paginés, filtres)
8. Objectifs + calcul de progression
9. Statistiques + agrégations + carte de tracking
10. Alertes + rapports/export (Excel/CSV/PDF)
11. PWA finale (manifest, icônes, installation, splash screen)
12. Déploiement Vercel (env vars, domaine, monitoring, backups)

## 5. Ce qui n'est PAS dans ce premier scaffold

Ce livrable pose la fondation (structure de dossiers, schéma de données complet,
config de base). Le développement des écrans/API listés ci-dessus reste à faire
module par module — c'est un projet de plusieurs semaines, pas d'un seul run.
