# ICHA IMPORT — HYPO / HTC

Plateforme de recensement, prospection, vente et suivi commercial terrain.
PWA commerciale + Dashboard admin, sur une seule base de code Next.js.

## Démarrage

```bash
npm install
cp .env.example .env      # renseigner DATABASE_URL / DIRECT_URL
npx prisma migrate dev --name init
npm run prisma:seed
npm run dev
```

Compte admin de démo créé par le seed : `admin` / `changeme123` (à changer immédiatement).

## Structure

```
app/
  (auth)/login          → connexion (commercial + admin)
  (commercial)/         → PWA terrain (dashboard, nouvelle visite, historique)
  (admin)/               → dashboard web (17 sous-modules, cf. §30 du cahier des charges)
  api/                   → Route Handlers Next.js
lib/                     → prisma client, auth, helpers offline/sync
prisma/schema.prisma     → schéma complet (voir docs/architecture.md pour le détail)
docs/architecture.md     → décisions techniques et ordre de développement du MVP
public/manifest.json     → configuration PWA
```

## État actuel

### ✅ Fondation
Structure de dossiers, schéma de données complet (toutes les entités du cahier des
charges avec index et idempotence), configuration Prisma/Vercel de base, seed de
démarrage.

### ✅ Module Authentification (§28 CDC)
- Connexion par identifiant + mot de passe/code personnel (`app/(auth)/login`)
- Session JWT en cookie httpOnly (`lib/auth/session.ts`, `lib/auth/edge.ts`)
- Middleware de protection des routes `/admin/*` (ADMIN uniquement) et
  `/dashboard`, `/visites`, `/historique` (COMMERCIAL uniquement) — `middleware.ts`
- Limitation des tentatives de connexion : 5 échecs / 15 min par identifiant,
  journalisées dans `LoginAttempt`
- Helpers `requireAdmin()` / `requireCommercial()` pour protéger les futures
  routes API (`lib/auth/rbac.ts`)
- Redirection automatique selon le rôle après connexion

**Reste à faire sur ce module** : page de gestion des comptes commerciaux côté
admin (création/désactivation), déconnexion depuis l'UI (route déjà prête :
`POST /api/auth/logout`), et éventuellement une expiration de session plus courte
avec renouvellement automatique si besoin terrain.

### ✅ Module Points de vente / Prospects / Clients
- `GET/POST /api/points-vente` — liste paginée + recherche/filtres **côté serveur**
  (ville, quartier, type, texte libre sur nom/vendeur/repère) ; création avec
  idempotence (id = uuid généré côté PWA si fourni)
- `GET/PATCH /api/points-vente/[id]` — détail (avec prospects/clients associés) et
  mise à jour
- `GET/POST /api/prospects`, `PATCH /api/prospects/[id]` — liste filtrée par point
  de vente/statut, création, et conversion prospect → client (crée automatiquement
  le client quand le statut passe à `CONVERTI`)
- `GET/POST /api/clients` — liste paginée avec recherche
- `GET /api/referentiels` — villes/quartiers/types de point de vente, mis en cache
  côté navigateur 5 min (§19 doc scalabilité)
- Page admin `app/(admin)/admin/points-vente` — tableau paginé (desktop) / cartes
  empilées (mobile), recherche par formulaire GET

**Reste à faire** : pages admin pour prospects/clients (listes + fiches), UI de
sélection ville/quartier/type basée sur `/api/referentiels`.

Mise à jour : la liste admin des points de vente affiche maintenant une
**miniature de la dernière photo** prise sur place et un **lien "Voir sur la
carte"** (Google Maps) basé sur les coordonnées GPS enregistrées à la
création du point de vente.

### ✅ Module Visites (formulaire terrain)
- `POST /api/visites` — soumission complète en **une seule transaction** :
  visite + point de vente (existant ou créé à la volée) + vente/lignes +
  déduction de stock (verrou optimiste, `lib/services/stock.ts`) + paiement +
  photos. Idempotent via `uuidClient` : un renvoi accidentel (coupure réseau)
  renvoie l'enregistrement existant sans doublon.
- `GET /api/visites` — liste paginée, filtrable par commercial/binôme/ville/date
  (base du futur module Tracking/Carte)
- Page PWA `app/(commercial)/visites/new` — formulaire complet : sélection ou
  création de point de vente, capture GPS (`navigator.geolocation`), lignes de
  vente HYPO/HTC avec conversion sachets/filets/cartons, paiement
- Comptes de démo : `admin` / `changeme123` (ADMIN) et `commercial1` /
  `changeme123` (COMMERCIAL, rattaché au Binôme 1)

**Reste à faire** : cette version fonctionne **en ligne uniquement** — le mode
hors-ligne (IndexedDB + Service Worker + file de synchronisation, §11/§12 CDC)
est un module à part entière, pas encore développé. La capture photo (caméra)
n'est pas non plus câblée : il manque un service de stockage objet (S3/R2)
configuré dans `.env` (`STORAGE_*`) avant de pouvoir uploader de vraies photos.

### ✅ Module Offline (IndexedDB + Service Worker)
- `lib/offline/db.ts` — file d'attente locale (IndexedDB via `idb`) pour les
  visites créées hors connexion, indexée par `uuidClient` (garantit l'absence
  de doublon à la synchronisation, même en cas de rejeu)
- `lib/offline/sync.ts` — rejoue automatiquement la file dès que
  l'événement `online` se déclenche, plus une vérification de secours toutes
  les 60s tant que l'onglet reste ouvert
- `components/SyncStatusBanner.tsx` — bandeau visible sur le dashboard
  commercial : nombre de visites en attente, statut connecté/hors ligne,
  bouton de synchro manuelle
- Formulaire `visites/new` mis à jour : détecte l'absence de connexion
  *avant* d'essayer (pas de tentative vouée à l'échec), et bascule aussi en
  file locale si le `fetch` échoue en cours de route malgré
  `navigator.onLine`. Message affiché : « Données en attente de
  synchronisation » (texte exact du §11 CDC)
- `public/sw.js` + `components/PwaSetup.tsx` — Service Worker (cache l'app
  shell pour permettre l'ouverture hors connexion) et gestion de l'invite
  d'installation PWA (bouton flottant « Installer l'application »)

### ✅ Module Visites — formulaire terrain (v2, aligné sur la liste de champs de Victor)
- Grand titre **HYPO/HTC/ICHA IMPORT**, date/heure automatiques affichées
- **Équipe** : choix du binôme (boutons façon radio, liste chargée depuis
  `/api/referentiels`), nom de l'agent affiché depuis la session (`/api/me`)
- **Point de vente** : nom, vendeur, ville (7 villes fixes, boutons radio),
  quartier en **texte libre** (créé automatiquement sous la ville choisie
  s'il n'existe pas déjà — pas de liste fermée à préremplir), repère exact,
  type de boutique (5 types fixes, radio), présentoir OUI/NON, photo de la
  devanture (accès direct à la caméra du téléphone via
  `capture="environment"`, compression côté client avant envoi), position GPS
- **Achat/commande du jour** : blocs HYPO (sachets + cartons, sous-titre
  75ml/112 sachets par carton) et HTC (sachets + filets + cartons, sous-titre
  60ml/12 filets de 10/120 sachets par carton) ; bloc **Commande** séparé
  (produit, quantité en cartons, date de livraison prévue) pour les commandes
  à livrer plus tard, distinctes de la vente immédiate ; montant total
  encaissé ; mode de paiement (Espèces / Mobile Money / Crédit partiel /
  Crédit total — le crédit est directement un mode, pas une case à part)
- Comptes de démo étendus : `commercial1`/`commercial2` (Binôme 1),
  `commercial3` (Binôme 2), tous `changeme123`
- Objectifs pré-remplis par le seed : 42 cartons/jour et 2500 cartons/semaine
  par binôme (à régénérer périodiquement — voir limitation ci-dessous)

**Limitations connues, à corriger avant la production :**
- La photo est envoyée en base64 directement dans la colonne `Photo.url` —
  ça **contredit le principe posé dans le doc scalabilité** ("jamais stocker
  les photos en base"). C'est un compromis temporaire tant qu'aucun service
  de stockage objet (S3/R2) n'est configuré. À corriger en priorité avant
  d'avoir un vrai volume de photos, sous peine de faire exploser la taille de
  la base.
- Les lignes de vente n'ont pas de prix unitaire saisi sur le terrain (seul
  un montant total global est déclaré) — donc les statistiques de CA par
  produit ne seront pas fiables tant qu'un prix n'est pas rattaché aux
  produits (`Produit.prixUnitaire`, actuellement à 0 dans le seed).
- Les objectifs (42/jour, 2500/semaine) sont insérés une fois pour la
  journée/semaine du seed — il faudra un job périodique (cron) qui les
  régénère automatiquement, sans quoi ils expirent silencieusement.

### ✅ Module Dashboard admin (KPI)
- `lib/queries/dashboard.ts` — agrégats calculés côté serveur pour la
  journée en cours (visites, ventes, commandes en attente, cartons HYPO/HTC
  vendus, CA, encaissements vs crédits) + stock courant par produit
  (converti automatiquement en cartons via `Produit.sachetsParCarton`)
- Page `/admin/dashboard` — 12 cartes KPI avec la même identité visuelle que
  la PWA terrain (icônes lucide-react, couleurs par catégorie), en-tête
  dégradé, lien rapide vers la liste des points de vente

**Reste à faire** : ces chiffres sont recalculés à chaque chargement de page
— acceptable au volume actuel (6 commerciaux), mais à surveiller si le
volume grossit (voir §7/§9 doc scalabilité : vues matérialisées / tables
d'agrégation à prévoir plus tard, les modèles `VentesJournalieres` et
`PerformanceBinome` existent déjà dans le schéma pour ça).

### ✅ Module Stockage photos — LWS (FTP), avec repli R2 possible
- `lib/services/storage/index.ts` — routeur qui choisit le fournisseur de
  stockage via `STORAGE_PROVIDER` (`lws` par défaut, `r2` en option)
- `lib/services/storage/lws-ftp.ts` — upload vers l'espace mutualisé LWS de
  Victor par FTP (`basic-ftp`), sous un dossier public du site (ex:
  `public_html/photos`)
- `lib/services/storage/r2.ts` — implémentation Cloudflare R2 gardée en
  option (au cas où le FTP montre ses limites en bande passante/fiabilité)
- `POST /api/upload` — reçoit une photo compressée (data URL) depuis la PWA,
  l'envoie vers le provider actif, renvoie `{ url }`
- Formulaire terrain : la photo est uploadée **immédiatement** après capture
  (si réseau disponible), badge "Envoi en cours..." puis "✓ Envoyée". Repli
  automatique sur l'ancien comportement (data URL en base) si l'upload
  échoue — la visite reste utilisable dans tous les cas.
- Variables à renseigner dans `.env` : `LWS_FTP_HOST`, `LWS_FTP_USER`,
  `LWS_FTP_PASSWORD`, `LWS_FTP_BASE_PATH`, `LWS_PUBLIC_URL` (récupérables
  dans cPanel LWS → FTP Accounts)

**Reste à faire** : le cas "photo prise hors ligne puis synchronisée plus
tard" utilise encore le repli data URL (pas de ré-upload différé au moment
de la synchro) — acceptable en usage occasionnel hors ligne, à améliorer si
le hors-ligne devient fréquent. À surveiller aussi : le FTP est plus lent et
moins robuste qu'un stockage objet dédié — si les uploads deviennent lents
ou peu fiables en usage réel, basculer sur R2 (déjà codé) via
`STORAGE_PROVIDER=r2`.

### ✅ Module Gestion des mots de passe et des comptes
- `GET /api/users` (admin) — liste des comptes
- `POST /api/users` (admin) — **crée un nouveau compte** (commercial ou
  admin), identifiant + mot de passe initial définis directement par
  l'admin, pas d'email ni de SMS (conforme à la demande : authentification
  simple, comptes prédéfinis)
- `PATCH /api/users/[id]/password` (admin) — réinitialise le mot de passe de
  n'importe quel utilisateur, sans avoir besoin de l'ancien
- `POST /api/auth/change-password` (tout utilisateur connecté) — change son
  propre mot de passe, avec vérification de l'ancien
- Page admin `/admin/utilisateurs` — liste des comptes, bouton "Nouveau
  compte" (formulaire : prénom, nom, identifiant, mot de passe, rôle, binôme
  si commercial) et bouton "Réinitialiser" par utilisateur
- Page `/profil` (commercial) — changer son propre mot de passe, lien
  accessible depuis le dashboard commercial
- **Modification** (`PATCH /api/users/[id]`, admin) — nom/prénom/rôle/binôme
- **Désactivation** (`DELETE /api/users/[id]`, admin) — désactive le compte
  plutôt qu'une suppression physique (un commercial ayant déjà des
  visites/ventes est lié à cet historique ; le supprimer casserait ces
  données). Réactivable depuis la même page.
- Page `/admin/utilisateurs` mise à jour : boutons Modifier / Réinitialiser
  mot de passe / Désactiver-Réactiver par utilisateur

### ✅ Module Prix produits & calcul automatique
- Schéma : `Produit.prixSachet`, `prixFilet` (HTC uniquement), `prixCarton`
  remplacent l'ancien `prixUnitaire` unique — un même produit se vend à
  l'unité, au demi-gros (filet) ou en gros (carton), donc trois prix
  distincts. Seedés avec les tarifs de Victor : HYPO 75 FCFA/sachet,
  8400 FCFA/carton ; HTC 75 FCFA/sachet, 750 FCFA/filet, 9000 FCFA/carton.
- `/api/referentiels` renvoie désormais aussi les produits actifs avec leurs
  prix
- Formulaire terrain : le **montant total encaissé se calcule
  automatiquement** dès que les quantités HYPO/HTC sont saisies (badge
  "Calculé automatiquement"), tout en restant modifiable pour les cas de
  remise négociée ou de crédit partiel. Un **sous-total par ligne** s'affiche
  aussi directement sur chaque carte produit (HYPO en bleu, HTC en teal).
  **Mise à jour** : le comportement du montant dépend maintenant du mode de
  paiement choisi — Espèces (montant calculé affiché, encaissé
  intégralement), Mobile Money (case à cocher confirmant la réception),
  Crédit partiel (le commercial saisit ce qu'il a reçu, le reste dû est
  calculé et affiché), Crédit total (rien à saisir, tout est dû). La
  soumission n'est **jamais bloquée** par ces champs. Le bloc "Le client
  passe une commande" est repositionné en fin de formulaire, avec les mêmes
  champs détaillés sachets/filets/cartons que l'achat du jour et son propre
  calcul automatique du montant à percevoir à la livraison.

**Reste à faire** : le "reste à payer" (crédit partiel/total) est calculé et
affiché dans le formulaire au moment de la saisie, mais pas encore visible
en relecture sur le profil du commercial après coup — ce sera à ajouter au
dashboard commercial (une carte "Crédits en cours", calculable à partir des
`Paiement.estCredit` déjà enregistrés vs `Vente.montantTotal`).

### ✅ Module Photo de profil
- Schéma : `User.avatarUrl` (nullable)
- `PATCH /api/me/avatar` — un utilisateur connecté met à jour sa propre
  photo (upload via le stockage actif — LWS ou R2 selon `STORAGE_PROVIDER`)
- `PATCH /api/users/[id]` (admin) — accepte aussi `avatarUrl`, donc l'admin
  peut définir/changer la photo de n'importe quel compte
- Page `/profil` (commercial) — bouton photo en haut, upload + compression
  identiques au mécanisme déjà utilisé pour les photos de point de vente
- Page admin `/admin/utilisateurs` — miniature (ou initiales si pas de
  photo) dans la liste, upload de photo directement dans la modale
  "Modifier"

### ✅ Module Téléphone vendeur, Observations, CA par binôme/vendeur
- Schéma : `PointVente.telephoneVendeur`, `Visite.observation`
- Formulaire terrain : champ "Téléphone du vendeur (WhatsApp)" juste après
  le nom du vendeur ; nouvelle **section 4 "Observations"** en toute fin de
  formulaire (zone de texte libre, optionnelle)
- Page admin `/admin/points-vente` : téléphone affiché sous le nom du
  vendeur, avec lien direct `wa.me` pour ouvrir WhatsApp
- Dashboard admin : nouvelles sections **"CA du jour par binôme"** et **"CA
  du jour par vendeur"** (barres comparatives), et **"Observations
  récentes"** (8 dernières visites commentées, avec commercial/point de
  vente/date)
- `lib/queries/dashboard.ts` : `getCaParBinomeEtVendeur()`,
  `getObservationsRecentes()`

**Reste à faire** : le CA par binôme/vendeur est calculé sur la journée en
cours (comme le reste du dashboard) — pas encore de filtre par période
personnalisée (semaine, mois). Les observations affichées sont globales, pas
encore filtrables par commercial ou par période non plus.

### ✅ Module Navigation, filtres, classement clients, rapports & export PDF
- **Navigation par onglets** — `app/(admin)/admin/layout.tsx`, sidebar sur
  desktop (Tableau de bord, Points de vente, Clients, Rapports,
  Utilisateurs), barre d'onglets en bas sur mobile. Toutes les pages admin
  utilisent désormais un en-tête léger commun (`AdminPageHeader`) au lieu de
  répéter chacune leur propre bandeau.
- **Loader** — `loading.tsx` sur chaque route admin (mécanisme natif
  Next.js), squelette animé pendant le chargement des données serveur.
- **Filtres points de vente** — ville, quartier (dépendant de la ville),
  type de boutique, et **tri par nombre de commandes** (croissant/décroissant),
  en plus de la recherche texte déjà existante. Bouton Précédent/Suivant
  redessiné avec icônes.
- **Classement clients par ville** (`/admin/clients`) — clients groupés par
  ville, triés par nombre de commandes décroissant au sein de chaque
  groupe, top 3 avec médaille visuelle, lien WhatsApp direct.
- **Rapports détaillés filtrables** (`/admin/rapports`) — filtrable par
  commercial, binôme, ville, quartier, type de boutique, produit et période
  (date début/fin). Cartes de totaux (ventes, CA, cartons HYPO/HTC) +
  tableau détaillé par commercial.
- **Export PDF** — bouton "Télécharger PDF" sur la page Rapports
  (`jspdf` + `jspdf-autotable`, génération entièrement côté navigateur,
  aucune donnée sensible transite par un serveur tiers).

**Limitation connue** : quand un filtre "Produit" est appliqué, le CA
affiché reste celui de la vente entière (tous produits confondus) — seuls
les cartons sont filtrés par produit précisément. Corriger ça demanderait de
faire remonter un prix par ligne de vente, ce qui n'est pas encore le cas
(voir limitation notée dans le module Visites).

Aucun changement de schéma dans ce module — pas de migration nécessaire.

### ✅ Module Graphiques, impression, crédits sur profil
- **Graphiques dashboard** (`recharts`, rendu SVG) — CA du jour par binôme,
  CA du jour par vendeur, cartons HYPO vs HTC. Remplacent les anciennes
  barres en CSS pur.
- **Impression** — bouton "Imprimer" sur le dashboard (`window.print()`),
  CSS dédié qui masque la sidebar/barre de navigation à l'impression pour
  n'imprimer que le contenu utile (graphiques inclus, ce sont du SVG qui
  s'imprime nettement).
- **Indicateur de chargement sur l'export PDF** — le bouton "Télécharger
  PDF" affiche désormais un spinner pendant la génération (c'était le vrai
  manque de loader signalé).
- **Reste à payer sur le profil du commercial** — `/api/me/credits` calcule,
  pour chaque vente à crédit du commercial connecté, la différence entre la
  valeur catalogue et ce qui a été effectivement payé ; le total et le
  détail par point de vente s'affichent en haut de `/profil`.

### ✅ Module Agrégation (préparation grande échelle)
Première brique du plan de montée en charge (20 000+ clients) : au lieu de
tout recalculer en direct à chaque chargement de page, les données
historiques sont désormais pré-agrégées chaque nuit.
- `lib/jobs/aggregate.ts` — deux fonctions idempotentes :
  `aggregateVentesDuJour(date)` (remplit `VentesJournalieres`, groupé par
  ville/commercial/binôme — pas par produit, car le montant n'est pas
  ventilé par produit sur les lignes de vente) et
  `aggregerPerformanceBinome(anneeMois)` (remplit `PerformanceBinome` :
  cartons vendus, visites, nouveaux clients par binôme et par mois)
- `GET /api/cron/aggregate` — protégée par `CRON_SECRET`, agrège la
  journée d'hier (aujourd'hui reste calculé en direct, il n'est pas
  terminé) et le mois en cours
- `vercel.json` — déclenche cette route chaque nuit à 1h (Vercel Cron,
  inclus dans tous les plans Vercel)
- Variable à ajouter dans `.env` **et** dans Vercel (Environment Variables) :
  `CRON_SECRET` — génère une valeur aléatoire, identique aux deux endroits

**Reste à faire** : ces tables sont maintenant remplies, mais le dashboard
et les rapports continuent de calculer en direct depuis les tables
transactionnelles (`Vente`, `Visite`...) même pour les dates passées — la
prochaine étape est de faire lire `dashboard.ts`/`rapports.ts` depuis
`VentesJournalieres`/`PerformanceBinome` quand la période demandée est
entièrement dans le passé, pour profiter du gain de performance.

**Pour tester le job manuellement** avant d'attendre la prochaine
exécution nocturne :
```bash
curl https://ton-domaine.vercel.app/api/cron/aggregate \
  -H "Authorization: Bearer TA_VALEUR_CRON_SECRET"
```

### 📋 Plan pour les fonctionnalités admin restantes
Dans l'ordre où elles seront abordées :
1. **Objectifs & progression** — Réalisé/Objectif × 100 par binôme, jour et
   semaine, avec les seuils 42/2500 déjà en base
2. **Alertes** — stock faible, commande en attente, crédit en retard,
   prospect à relancer, client inactif, objectif non atteint (le modèle
   `Alerte` existe déjà, il manque la logique de génération + l'UI admin)
3. **Gestion du stock** — vue et ajustement manuel par produit
4. **Tracking par binôme** — carte des positions GPS des visites (les
   coordonnées sont déjà enregistrées à chaque visite)
5. **Page admin Commandes** — liste/suivi des commandes créées depuis le
   terrain (marquer comme livrée, etc.)
6. **Historique des visites** côté commercial — actuellement un texte
   "à venir" sur son dashboard

### ⏳ À suivre
Stockage photos (upload cloud réel), puis le plan admin ci-dessus —
voir `docs/architecture.md` §4.

## Documents sources

Ce projet est basé sur 3 documents fournis par Victor :
1. Cahier des charges fonctionnel v1.1
2. Exigences de scalabilité et gestion de grande base de données
3. Infrastructure et déploiement (Vercel)
