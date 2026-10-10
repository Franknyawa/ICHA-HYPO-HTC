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
  cartons vendus, visites, nouveaux clients par binôme et par mois).
  **Convention à connaître** : les colonnes optionnelles de la clé
  composite (`binomeId`, `produitId`) utilisent `""` plutôt que `null`
  pour représenter "aucun/tous" — Prisma exige des valeurs non-null dans
  le type généré pour une recherche par contrainte unique composite, même
  quand les colonnes elles-mêmes sont nullable en base.
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

### ✅ Module Commandes (suivi admin)
- `lib/queries/commandes.ts` — liste paginée, filtrable par statut, ville,
  commercial, période
- `GET /api/commandes` — liste
- `PATCH /api/commandes/[id]` (admin uniquement) — change le statut
  (En attente / Livrée / Annulée), réversible
- Page `/admin/commandes` — chaque commande affiche le client/point de
  vente, les lignes produit (HYPO/HTC avec quantités), les dates commande
  et livraison prévue, un lien WhatsApp direct, et les boutons d'action
  (Marquer livrée / Annuler / Réactiver)
- Ajoutée à la navigation (sidebar desktop + barre mobile)

Aucun changement de schéma — pas de migration nécessaire.

### ✅ Correctif installation PWA (icônes manquantes)
Le `manifest.json` référençait `/icons/icon-192.png` et
`/icons/icon-512.png` depuis le tout début, mais ces fichiers n'avaient
jamais été créés — un navigateur refuse d'installer une PWA sans ses
icônes déclarées, c'est un critère bloquant. Corrigé :
- `public/icons/icon-192.png` et `icon-512.png` — icône goutte d'eau sur
  fond dégradé bleu marque, générée pour coller à l'identité déjà en place
- `public/apple-touch-icon.png` — Safari iOS ne lit pas les icônes du
  manifest de la même façon qu'Android, il lui faut ce fichier séparé
- `app/layout.tsx` — métadonnées `icons` et `appleWebApp` ajoutées

Aucun changement de schéma — pas de migration nécessaire.

### ✅ Module Back Office — Paramètres (`/admin/parametres`)
Rend modifiables, sans passer par du SQL manuel, les données qui
structurent le formulaire terrain :
- **Villes** et **Types de boutique** — ajout, renommage, activation/
  désactivation (nouveau champ `actif` ajouté aux deux modèles — **cette
  fois il y a bien un changement de schéma**, migration nécessaire)
- **Produits** — modification des prix (sachet/filet/carton) uniquement ;
  le champ `code` (HYPO/HTC) reste verrouillé côté API car il sert
  d'identifiant dans toute la logique métier (calcul de prix, conversions)
- **Binômes** — ajout, renommage, activation/désactivation
- **Objectifs** — modification directe du nombre de cartons/jour et
  cartons/semaine en vigueur pour chaque binôme (crée l'objectif de la
  période en cours s'il n'existe pas encore)
- `/api/referentiels` filtre désormais villes/types par `actif: true` —
  désactiver une ville ou un type la retire immédiatement des listes du
  formulaire terrain, sans supprimer l'historique qui y fait référence
- Ajouté à la navigation (sidebar + barre mobile)

**Limitations volontaires** : pas de suppression physique nulle part (une
ville/un type/un binôme déjà utilisé ne peut être que désactivé, jamais
supprimé — cohérent avec le reste de l'app). Les modes de paiement et la
structure même du formulaire (ordre des sections, champs) restent codés en
dur — les rendre configurables demanderait un vrai "form builder", hors
scope pour l'instant.

**⚠️ Cette fois il y a un changement de schéma** (`actif` sur `Ville` et
`TypePointVente`) — migration à faire avant de tester :
```sql
ALTER TABLE villes ADD COLUMN IF NOT EXISTS actif BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE types_point_vente ADD COLUMN IF NOT EXISTS actif BOOLEAN NOT NULL DEFAULT true;
```

### ✅ Grosse mise à jour — Back office, sessions, dashboard commercial, formulaire terrain

**Sessions serveur (au lieu de JWT sans état)**
- Nouveau modèle `Session` — chaque connexion crée une ligne en base ; le
  JWT référence son id. `getSession()` vérifie maintenant aussi que la
  session n'est pas révoquée/expirée côté serveur, ce qui rend une
  déconnexion à distance immédiatement effective (impossible avec un JWT
  seul, qui resterait valide jusqu'à expiration naturelle).
- Durée configurable en back office (`ParametreSysteme`, clé
  `duree_session_heures`) — `/admin/parametres`
- `/admin/utilisateurs` — bouton "Sessions actives" par utilisateur :
  liste (appareil, dernière activité), déconnexion individuelle ou globale

**Objectifs individuels + dashboard commercial refait**
- Nouveau modèle `ObjectifIndividuel` — cartons/jour, /semaine, /mois,
  appliqués à tous les commerciaux (distinct des objectifs par binôme déjà
  en place), modifiable en back office (42/192/768 par défaut)
- `lib/queries/commercial-stats.ts` — stats perso (jour/semaine/mois) et
  binôme (jour/semaine), avec code couleur rouge (<50%) / orange (50-79%) /
  vert (≥80%) — seuils choisis faute d'indication précise, ajustables dans
  ce fichier si besoin
- Dashboard commercial reconstruit : "Nouveau recensement" (renommé),
  2 boutons "Visite de rotation et d'achalandage" / "Visite de réassort"
  (visuellement présents, intentionnellement inertes — pas encore de page
  dédiée), barres de progression colorées, rappels des commandes en
  attente, **changement de mot de passe retiré**

**Formulaire terrain**
- Bouton retour vers l'accueil
- Binôme affiché en lecture seule (vient du profil assigné par l'admin,
  plus de sélection manuelle)
- Quartier : liste déroulante des quartiers connus pour la ville
  sélectionnée, avec repli "+ Autre / nouveau quartier" en texte libre.
  **Limitation assumée** : ce n'est pas une détection GPS automatique —
  sans coordonnées par quartier (qu'on n'a pas), une vraie auto-détection
  ne serait pas fiable. C'est une liste contrainte, pas une automatisation.
- Nouveau champ "Numéro WhatsApp du patron (si différent)"
- **Deux photos de devanture** au lieu d'une (types `DEVANTURE_1`/`DEVANTURE_2`)
- Présentoir déplacé après "Achat du jour", **suggéré automatiquement**
  ("Oui") si sachets > 30 ET cartons > 1 pour HYPO ou HTC — reste modifiable
- Types de boutique désormais triés par un champ `ordre` géré en back
  office (au lieu de l'ordre alphabétique) — ordre initial du seed :
  Boutique du quartier, Vendeur ambulant, Table Call Box/Kiosque,
  Mini supermarché/Supérette, Grossiste
- **Génération de facture PDF** après une vente — bouton "Télécharger la
  facture" sur l'écran de confirmation (jsPDF, généré côté téléphone,
  partageable/imprimable pour le client)

**⚠️ Changement de schéma important — migration nécessaire avant de tester :**
```sql
ALTER TABLE villes ADD COLUMN IF NOT EXISTS actif BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE types_point_vente ADD COLUMN IF NOT EXISTS actif BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE types_point_vente ADD COLUMN IF NOT EXISTS ordre INTEGER NOT NULL DEFAULT 0;
ALTER TABLE points_vente ADD COLUMN IF NOT EXISTS telephone_patron TEXT;

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  user_agent TEXT,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP(3) NOT NULL,
  last_seen_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions (user_id);

CREATE TABLE IF NOT EXISTS parametres_systeme (
  cle TEXT PRIMARY KEY,
  valeur TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS objectifs_individuels (
  periode TEXT PRIMARY KEY,
  valeur_cartons INTEGER NOT NULL,
  updated_at TIMESTAMP(3) NOT NULL
);
```
Puis relance le seed pour appliquer le nouvel ordre des types de boutique :
```bash
npm run prisma:seed
```

**Reste à faire dans ce lot** (pas encore fait, à reprendre) :
- Les boutons "Visite de rotation et d'achalandage" / "Visite de réassort"
  n'ont aucune page derrière — en attente de la structure que Victor doit
  fournir
- Pas d'interface pour lister/gérer manuellement les quartiers en back
  office (ils se créent à la volée depuis le terrain, mais ne peuvent pas
  encore être renommés/fusionnés depuis `/admin/parametres`)

### ✅ Factures admin, produits dynamiques, recherche, rotation & réassort
- **`/admin/factures`** — liste paginée de toutes les ventes (filtrable par
  commercial/ville/période), bouton "Facture" par ligne générant le PDF à
  partir des données déjà en base
- **Produits dynamiques** — `produitCode` n'est plus limité à
  `"HYPO"|"HTC"` côté validation/API ; l'admin peut créer de nouveaux
  produits depuis `/admin/parametres` (code, nom, volume, conversions
  sachets/filets/cartons, prix). **Limitation assumée** : le formulaire
  "Nouveau recensement" garde son affichage figé à deux colonnes HYPO/HTC —
  un produit ajouté apparaît dans la nouvelle Visite de réassort (rendu
  dynamique), pas encore dans ce formulaire-là. Généraliser aussi
  "Nouveau recensement" est la suite logique si plus de 2 produits arrivent.
- **Recherche de point de vente** (`lib/queries/points-vente-recherche.ts`,
  `/api/points-vente/recherche`, composant `PointVenteSearch`) — par nom de
  boutique, nom de vendeur, ou proximité GPS (distance calculée
  côté serveur). Réutilisée dans les deux nouvelles pages ci-dessous.
- **Visite de rotation et d'achalandage** (`/visites/rotation`) — recherche
  du point de vente existant, photo avec le boutiquier, rapport de visite
  horodaté, bouton "{nom} passe une nouvelle commande" qui embarque le
  point de vente déjà identifié vers la Visite de réassort
- **Visite de réassort** (`/visites/reassort`) — recherche ou point de
  vente pré-rempli (arrivée depuis la rotation), formulaire de commande
  avec **tous les produits actifs rendus dynamiquement** (pas figé à
  HYPO/HTC), calcul automatique du montant, les 4 modes de paiement,
  génération de facture PDF, puis un champ rapport après la commande
- **Dashboard commercial redessiné** — section "Alertes" unifiée
  (crédits en cours + commandes en attente), boutons d'action reliés aux
  nouvelles pages, mise en page resserrée

Aucun changement de schéma dans ce module — pas de migration nécessaire.

**Limite à surveiller** : la barre de navigation mobile compte maintenant
8 onglets (Tableau de bord, Points de vente, Commandes, Factures, Clients,
Rapports, Paramètres, Utilisateurs) — ça commence à être serré sur petit
écran. À condenser (ex: un menu "Plus" regroupant les moins utilisés) si
ça devient gênant en usage réel.

### ✅ Facture PDF redessinée et centralisée
- `lib/utils/facture-pdf.ts` — nouveau générateur unique, utilisé par les
  3 endroits qui produisaient chacun leur propre PDF auparavant (formulaire
  terrain, visite de réassort, liste admin des factures) — plus de code
  dupliqué, un seul design à maintenir désormais.
- Design : en-tête bleu marque avec bande d'accent, bloc "Point de vente" /
  "Vendu par" sur fond gris clair, tableau produits avec lignes alternées
  et en-tête coloré, bloc total aligné à droite avec le "Reste à payer"
  mis en évidence sur fond rouge clair quand il y en a un, pied de page
  avec message de remerciement.

Aucun changement de schéma — pas de migration nécessaire.

### ✅ Tracking des commerciaux (carte)
- `lib/queries/tracking.ts` — positions GPS des visites du jour (déjà
  enregistrées à chaque visite), filtrables par commercial/binôme/date
- `/admin/tracking` — carte interactive (Leaflet + OpenStreetMap, gratuit,
  aucune clé API nécessaire), un marqueur coloré par commercial, popup avec
  point de vente + heure de passage au clic
- **Barre de navigation mobile condensée** — 9 onglets ne tenaient plus sur
  petit écran ; désormais 4 principaux + un menu "Plus" qui remonte du bas
  pour le reste (limite notée précédemment, corrigée ici)

Aucun changement de schéma — les coordonnées étaient déjà enregistrées.
Nouvelles dépendances : `leaflet`, `react-leaflet`, `@types/leaflet`.

**Reste à faire** : uniquement les visites géolocalisées apparaissent (le
commercial doit avoir activé le GPS pendant sa visite) — pas de suivi en
temps réel continu, juste les points où une visite a été enregistrée.

### ✅ Tracking terrain (carte)
- `/admin/tracking` — carte interactive (Leaflet + OpenStreetMap, gratuit,
  aucune clé API requise) des visites géolocalisées, filtrable par
  commercial, binôme et date (aujourd'hui par défaut)
- Un point par visite, couleur stable par commercial (même commercial =
  même couleur sur toute la carte), popup avec point de vente + heure
- Légende sous la carte avec le nombre de visites par commercial du jour
- `lib/queries/tracking.ts` — récupère les visites du jour avec position
  GPS non nulle
- `CircleMarker` plutôt que des marqueurs images classiques — évite le bug
  classique des icônes Leaflet cassées avec Next.js/webpack
- Ajoutée à la navigation (déjà présente dans le menu "Plus" mobile)

Aucun changement de schéma — les coordonnées étaient déjà enregistrées à
chaque visite. Nouvelles dépendances : `leaflet`, `react-leaflet`,
`@types/leaflet`.

### ✅ Corrections diverses + tracking en direct
- **Bug objectifs individuels** — la sauvegarde échouait silencieusement
  (aucune vérification `res.ok`, aucune erreur affichée). Corrigé avec
  gestion d'erreur visible + resynchronisation de l'affichage après
  rechargement. Si le problème persiste après ce correctif, le message
  d'erreur affiché dira enfin pourquoi.
- **Durée de session en minutes** — `duree_session_minutes` remplace
  `duree_session_heures` (permet des réglages fins comme 30 min), champ
  back office avec saisie heures + minutes séparées, converties
  automatiquement.
- **Date des crédits sur le dashboard commercial** — chaque crédit affiche
  maintenant boutique, montant ET date de vente (comme les commandes en
  attente).
- **Tracking en direct** — nouveau bouton bascule sur `/admin/tracking`
  entre "Visites du jour" (historique, déjà existant) et "Position
  actuelle" (nouveau). Un léger battement de position est envoyé par la
  PWA du commercial toutes les 3 minutes tant que le dashboard reste
  ouvert (`components/commercial/LocationHeartbeat.tsx` →
  `POST /api/me/position`). **Limitation assumée et annoncée dans
  l'interface** : ce n'est pas un suivi permanent en arrière-plan — sans
  l'app ouverte (surtout sur iOS, très restrictif), la position ne se met
  plus à jour. La carte affiche l'heure du dernier battement reçu.

**⚠️ Changement de schéma — migration nécessaire :**
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS derniere_position_lat DECIMAL(10,7);
ALTER TABLE users ADD COLUMN IF NOT EXISTS derniere_position_lng DECIMAL(10,7);
ALTER TABLE users ADD COLUMN IF NOT EXISTS derniere_position_at TIMESTAMP(3);
```
Si tu avais déjà réglé une durée de session avant ce correctif, elle est
ignorée (ancienne clé `duree_session_heures`) — reconfigure-la depuis
`/admin/parametres` après la mise à jour.

### ✅ Cartes KPI cliquables sur le dashboard admin
8 des 10 cartes du dashboard admin renvoient maintenant vers la page la
plus pertinente, filtrée sur la journée en cours quand c'est pertinent :
Visites → Tracking (visites du jour), Clients → liste clients, Ventes →
Factures du jour, Commandes en attente → Commandes filtrées, Cartons
HYPO/HTC → Rapports filtrés par produit, CA du jour → Rapports du jour,
Encaissements → Factures du jour, Stock HYPO/HTC → Paramètres (pas encore
de vraie page de gestion du stock, voir plan restant).

**Non cliquables, faute de destination existante** : Prospects (pas de
page admin dédiée) et Crédits en cours (pas de vue globale des crédits
côté admin — seule la vue par commercial existe sur son profil).

Aucun changement de schéma — pas de migration nécessaire.

### ✅ Alertes automatiques
Le modèle `Alerte` existait déjà en base (jamais utilisé jusqu'ici) — la
logique de génération et l'interface manquaient, c'est fait :
- `lib/jobs/alertes.ts` — 6 générateurs, un par type déjà prévu dans le
  schéma : stock faible (sous le seuil défini sur chaque produit),
  commande à livrer bientôt / en retard, crédit en retard (>7 jours),
  prospect à relancer, client inactif (>30 jours sans vente/commande),
  objectif journalier de binôme non atteint. Anti-doublon intégré : une
  alerte déjà active pour la même entité n'est jamais recréée.
- Génération automatique via le **cron nocturne existant**
  (`/api/cron/aggregate`) — tourne juste après l'agrégation
- **Génération manuelle** à la demande, bouton "Générer maintenant" sur la
  page admin (tout sauf le contrôle d'objectifs, qui a besoin des données
  agrégées de la veille)
- `/admin/alertes` — liste filtrable par type, bouton "Résolue" par alerte
- **Badge rouge** avec le nombre d'alertes actives, sur l'onglet Alertes
  (sidebar desktop + barre mobile), rafraîchi à chaque navigation

**Limitations assumées** : les seuils (7 jours crédit, 5 jours prospect,
30 jours client inactif, 2 jours avant livraison) sont des constantes dans
le code, pas encore réglables en back office — à ajouter si besoin de les
ajuster. Le contrôle d'objectifs ne couvre que le niveau JOURNALIER par
binôme (pas encore les objectifs individuels ni hebdo/mensuel).

Aucun changement de schéma — pas de migration nécessaire.

### ✅ Gestion du stock
- **`/admin/stock`** — une carte par produit, cartons et sachets en un
  coup d'œil, bordure rouge et badge "Faible" si sous le seuil d'alerte
- **Réassort** (entrée) et **Retirer** (sortie — casse, produit périmé...),
  au choix en cartons ou en sachets, avec motif optionnel — réutilise le
  même service de mouvement de stock que la déduction automatique lors
  d'une vente (même verrou optimiste anti-incohérence)
- **Seuil d'alerte modifiable** par produit, directement lié aux alertes
  "Stock faible" déjà en place
- **Historique des mouvements** consultable par produit (entrées, sorties,
  ventes)
- Ajoutée à la navigation ; les cartes "Stock HYPO/HTC" du dashboard admin
  pointent maintenant ici plutôt que vers Paramètres

Aucun changement de schéma — pas de migration nécessaire (`Stock` et
`MouvementStock` existaient déjà).

### ✅ Historique des visites (commercial) + Objectifs & progression (admin)
Les deux derniers points de la liste de départ.

- **`/historique`** (commercial) — liste paginée de ses propres visites,
  type déduit automatiquement (Nouveau recensement / Rotation et
  achalandage / Réassort, selon les photos et la vente rattachées),
  montant de vente et rapport affichés quand ils existent. Lien "Voir
  l'historique de mes visites" ajouté sous les boutons d'action du
  dashboard commercial.
- **`/admin/objectifs`** — vue d'ensemble Réalisé/Objectif × 100, par
  binôme (jour/semaine) et par commercial (jour/semaine/mois), même code
  couleur rouge/orange/vert que le dashboard commercial. Réutilise
  directement `getStatsBinome`/`getStatsPersonnelles` déjà construits pour
  le dashboard commercial — aucune nouvelle logique de calcul.
- `components/StatBar.tsx` — la barre de progression colorée était
  dupliquée dans le dashboard commercial ; extraite en composant partagé,
  utilisée maintenant aux deux endroits.

Aucun changement de schéma — pas de migration nécessaire.

### ✅ Prix par type de boutique
Permet de vendre un même produit à un prix différent selon le type de
boutique (ex : plus cher au détail en boutique de quartier, moins cher en
gros chez un grossiste), sans complexifier le modèle produit lui-même.
- Nouveau modèle `PrixParType` — une ligne optionnelle par combinaison
  (produit, type de boutique) ; son absence = le prix de base du produit
  s'applique tel quel
- `/admin/parametres` → section "Prix par type de boutique" — une ligne
  par type sous chaque produit, "Personnaliser" révèle les champs de prix,
  "Réinitialiser au prix de base" supprime la surcharge
- **Formulaire terrain** (`/visites/new`) — dès qu'un type de boutique est
  choisi, le prix spécifique s'applique automatiquement au calcul du
  montant (section Achat du jour et Commande future), avec repli
  silencieux sur le prix de base si rien n'est personnalisé pour ce type
- **Visite de réassort** — le type de boutique du point de vente est déjà
  connu (renseigné à sa création), donc le bon prix s'applique
  automatiquement sans redemander le type
- `/api/referentiels` renvoie désormais aussi ces surcharges, chargées une
  seule fois avec le reste des référentiels

**⚠️ Changement de schéma — migration nécessaire :**
```sql
CREATE TABLE IF NOT EXISTS prix_par_type (
  id TEXT PRIMARY KEY,
  produit_id TEXT NOT NULL REFERENCES produits(id),
  type_id TEXT NOT NULL REFERENCES types_point_vente(id),
  prix_sachet DECIMAL(10,2) NOT NULL,
  prix_filet DECIMAL(10,2),
  prix_carton DECIMAL(10,2) NOT NULL,
  updated_at TIMESTAMP(3) NOT NULL,
  UNIQUE (produit_id, type_id)
);
```

### ✅ Suppression / désactivation de produit
- **Suppression réelle** possible seulement si le produit n'a **jamais**
  été vendu ni commandé (aucune ligne historique associée) — sinon refus
  clair avec message suggérant la désactivation, cohérent avec le
  traitement des villes/types/binômes ailleurs dans l'app
- Si suppression autorisée : ses éventuelles surcharges de prix par type
  et sa fiche stock sont supprimées avec lui (transaction)
- **Toggle Actif/Inactif** ajouté sur chaque produit (existait déjà côté
  API mais pas dans l'interface) — un produit désactivé disparaît
  immédiatement des formulaires terrain (`/api/referentiels` filtre déjà
  par `actif: true`)

Aucun changement de schéma — pas de migration nécessaire.

### ✅ "Nouveau recensement" généralisé aux produits dynamiques
Dernière limitation connue du module produits dynamiques, désormais
traitée. Le formulaire terrain principal (`/visites/new`) — le plus
utilisé, et jusqu'ici le seul encore figé à deux colonnes HYPO/HTC codées
en dur — affiche maintenant **dynamiquement tous les produits actifs**,
aussi bien dans la section "Achat du jour" que dans la commande future
intégrée :
- États remplacés par des maps génériques `{ [code]: {sachets, filets,
  cartons} }`, un seul helper `updateQuantite()` partagé
- Le champ "Filets" n'apparaît que si le produit a un `prixFilet` défini
  (comme HTC) — s'adapte automatiquement à la structure de chaque produit
- Calcul du montant, présentoir auto-détecté, et lignes envoyées au
  serveur : tout généralisé à N produits, plus seulement 2
- Petite palette de couleurs/icônes cyclique pour les cartes produit — un
  3e produit ajouté en back office n'hérite plus par défaut du style HTC,
  il obtient sa propre couleur distincte

Concrètement : un produit créé depuis `/admin/parametres` apparaît
maintenant **partout** — Visite de réassort (déjà fait) et Nouveau
recensement (fait maintenant) — sans aucune modification de code
supplémentaire nécessaire.

Aucun changement de schéma — pas de migration nécessaire (le backend
était déjà générique depuis l'ajout du module produits dynamiques).

### ✅ Identité visuelle — logo, spinner, page de connexion redessinée
Premier lot d'une refonte visuelle demandée par Victor ("revisiter toutes
les pages") — celui-ci couvre le logo et la page de connexion ; le reste
de l'app sera repris page par page dans les prochains échanges.
- **Logo** — `public/brand/logo-hypo.png`. Le fichier fourni était un
  JPEG avec un damier de transparence "cuit" dans l'image (pas une vraie
  transparence) ; traitement par script Python (détection par saturation
  colorimétrique + lissage des bords) pour en extraire un vrai PNG
  transparent, recadré, couleur uniformisée.
- **Icônes PWA regénérées** avec le vrai logo à la place de la goutte
  d'eau générique précédente (`public/icons/icon-192.png`,
  `icon-512.png`, `public/apple-touch-icon.png`)
- **`components/Spinner.tsx`** — spinner SVG réutilisable (`<Spinner
  size={18} />`) + `<FullPageSpinner label="..." />` pour les transitions
  pleine page. Utilisé sur le bouton de connexion pour l'instant ; à
  généraliser aux autres boutons "..." de l'app dans un prochain passage.
- **`components/illustrations/BrandPatternIcons.tsx`** — deux icônes
  SVG dessinées à la main (sachet, bouteille de javel), pensées pour un
  motif de fond décoratif, pas des photos
- **Page de connexion entièrement redessinée** — panneau de marque bleu
  dégradé à gauche (desktop) avec motif de sachets/bouteilles dispersés en
  transparence et le logo mis en valeur sur carte blanche, formulaire
  épuré à droite avec icônes dans les champs, focus ring, et spinner sur
  le bouton de connexion. S'empile verticalement sur mobile.

**Ce qui n'est PAS encore fait** (honnête sur le "revisiter toutes les
pages") : le reste de l'app garde son design actuel — dashboard commercial
et admin, formulaires terrain, toutes les pages `/admin/*`. Je vais les
reprendre systématiquement dans les prochains échanges plutôt que de tout
promettre fait en un seul lot.

Aucun changement de schéma — pas de migration nécessaire.

### ✅ Gestion des quartiers en back office
Dernier point de la liste de fonctionnalités d'origine, désormais traité.
- Champ `actif` ajouté au modèle `Quartier` (cohérent avec villes/types/
  binômes/produits) — un quartier désactivé disparaît immédiatement du
  formulaire terrain (`/api/referentiels` filtre déjà dessus)
- **`/admin/parametres`** — nouvelle section "Quartiers", groupés par
  ville, avec le nombre de points de vente rattachés affiché sur chaque
  ligne
- **Renommer**, **activer/désactiver** — mêmes patterns que le reste
- **Fusionner** — bouton dédié (icône fusion) sur les quartiers ayant au
  moins un point de vente : tous ses points de vente sont réassignés au
  quartier choisi, puis le quartier d'origine est désactivé (jamais
  supprimé — cohérent avec le principe général de l'app : ne jamais
  perdre de données historiques)

**⚠️ Changement de schéma — migration nécessaire :**
```sql
ALTER TABLE quartiers ADD COLUMN IF NOT EXISTS actif BOOLEAN NOT NULL DEFAULT true;
```

**🎉 Avec ce module, tous les points de la liste de fonctionnalités
d'origine — fonctionnelle ET visuelle (premier lot) — sont traités.** Le
reste de la refonte visuelle (dashboard, formulaires terrain, autres pages
admin) reste à faire, à la demande.

### ✅ Mode clair / sombre (infrastructure + premier lot de pages)
- **Infrastructure complète** : `darkMode: "class"` activé dans Tailwind,
  `components/ThemeProvider.tsx` (contexte + persistance `localStorage`),
  script anti-flash injecté dans `<head>` (`app/layout.tsx`) qui applique
  la classe `dark` avant l'hydratation React — sans lui, on verrait un
  flash de thème clair au chargement même si l'utilisateur a choisi sombre
- **`components/ThemeToggle.tsx`** — bouton soleil/lune réutilisable
- **Bouton de bascule ajouté** : sidebar admin (desktop) + barre flottante
  mobile, dashboard commercial, page de connexion
- **Variantes sombres appliquées** : layout admin (sidebar, navigation),
  `AdminPageHeader` (donc l'en-tête de toutes les pages admin d'un coup),
  `AdminLoadingSkeleton`, dashboard commercial, `StatBar` (partagé
  commercial + admin objectifs), page de connexion

### ✅ Correctif — cartes et contenu blancs sur fond sombre
Victor a signalé (avec capture d'écran) que le dashboard admin gardait des
cartes KPI et blocs graphiques entièrement blancs même en mode sombre —
la classe `dark:` n'avait été posée que sur le layout/l'en-tête, pas sur
le **contenu** de chaque page. Corrigé par un passage systématique
(script de remplacement ciblé, pas page par page à la main) sur :
- **Toutes les pages admin** : dashboard (cartes KPI, graphiques, bouton
  Imprimer), alertes, clients, commandes, factures, objectifs, paramètres
  (y compris toutes les modales de création/édition), points de vente,
  rapports, stock, tracking (carte), utilisateurs
- **Toutes les pages commerciales** : dashboard, historique, profil,
  formulaire terrain (nouveau recensement), rotation, réassort
- **Composants partagés** : recherche de point de vente, actions
  commande/facture, carte de tracking

Couleurs couvertes : fonds blancs/gris clairs, textes slate (toutes les
nuances), bordures et contours, badges "Inactif", couleurs de
placeholder — donc les champs de formulaire dans les modales aussi, pas
seulement l'affichage.

**Reste malgré tout à vérifier** : ce passage automatisé couvre les
classes Tailwind répétitives, mais pas les couleurs codées en dur en CSS
inline (dégradés `style={{ background: "..." }}` des en-têtes, qui restent
volontairement bleus dans les deux thèmes — c'est un choix de marque, pas
un oubli) ni les graphiques recharts (axes, tooltips) qui gardent leurs
couleurs par défaut. Si un endroit précis reste moche en sombre, montre-le
moi et je le corrige ciblé.

Aucun changement de schéma — pas de migration nécessaire.

### ✅ Optimisations de lenteur (sans changer de région)
Diagnostic confirmé : lenteur uniforme sur toutes les pages = latence
réseau fixe (Vercel USA ↔ Supabase Europe), pas un problème de code — le
vrai correctif reste de rapprocher les deux (Vercel Pro + région Europe).
Victor a choisi d'essayer d'abord les optimisations gratuites ; voici ce
qui a été fait, avec les limites honnêtes de cette approche :
- **Page Objectifs réécrite** (`lib/queries/objectifs-admin.ts`) — elle
  refaisait 4 requêtes **par binôme** et 4 **par commercial** (boucle sur
  `getStatsBinome`/`getStatsPersonnelles`), soit 30-40+ requêtes selon la
  taille de l'équipe. Remplacé par des requêtes groupées à nombre fixe (9
  au total, peu importe le nombre de binômes/commerciaux) — le
  regroupement par entité se fait en JS après coup, plus en base.
- **Index manquants ajoutés** — `Vente.createdAt`, `Visite.dateVisite`,
  `Commande.dateLivraisonPrevue` n'avaient aucun index alors qu'ils sont
  filtrés par date sur quasiment toutes les requêtes dashboard/rapports/
  objectifs/agrégation. Sans index, Postgres relit toute la table à
  chaque appel — l'impact grandit avec le volume de données au fil du
  temps, donc c'était en train de s'aggraver mois après mois même sans y
  toucher.

**⚠️ Changement de schéma — migration nécessaire :**
```sql
CREATE INDEX IF NOT EXISTS ventes_created_at_idx ON ventes (created_at);
CREATE INDEX IF NOT EXISTS visites_date_visite_idx ON visites (date_visite);
CREATE INDEX IF NOT EXISTS commandes_date_livraison_prevue_idx ON commandes (date_livraison_prevue);
```

**Honnêteté sur ce que ça change réellement** : ces deux correctifs
réduisent le *nombre* et le *coût* des requêtes, mais ne suppriment pas
la latence réseau elle-même — chaque requête individuelle continue de
traverser l'Atlantique. La page Objectifs devrait être nettement plus
rapide (bien moins de requêtes), mais la lenteur de fond, uniforme sur
toutes les pages, ne disparaîtra pas tant que la région ne sera pas
alignée. C'est le plafond réel des optimisations gratuites.

### ✅ Itinéraire des commerciaux + seuils d'alertes dynamiques
- **Tracé d'itinéraire sur `/admin/tracking`** (mode "Visites du jour") —
  une ligne pointillée relie désormais les visites de chaque commercial
  dans l'ordre chronologique (un tracé par commercial, jamais mélangé
  entre plusieurs personnes), et chaque point affiche son "Étape X / Y"
  au clic. Ça répond directement au besoin "savoir où chacun est passé,
  dans quel ordre" — pas juste des points isolés sur la carte.
- **Seuils des alertes automatiques rendus configurables** — les 4
  constantes codées en dur (crédit en retard après 7 jours, prospect à
  relancer après 5 jours, client inactif après 30 jours, livraison à
  venir dans les 2 jours) sont maintenant réglables depuis
  `/admin/parametres`, section "Seuils des alertes". Réutilise le même
  mécanisme clé/valeur que la durée de session (`ParametreSysteme`).

**Sur "rendre tout dynamique" — ce qui reste volontairement figé, et
pourquoi :**
- **Modes de paiement** (Espèces/Mobile Money/Crédit partiel/Crédit
  total) — chacun a un comportement de calcul complètement différent câblé
  dans le code (l'un demande une confirmation, l'autre un montant partiel,
  etc.). Les rendre ajoutables depuis le back office demanderait de
  définir pour chaque nouveau mode COMMENT il se comporte (a-t-il besoin
  d'un montant ? compte-t-il comme crédit ?) — un vrai système de règles
  configurables, pas juste une liste éditable. Hors scope pour l'instant,
  à envisager si un vrai besoin métier apparaît (ex: un 5e mode de
  paiement précis à ajouter).
- **Types de visite** (recensement/rotation/réassort) — chacun a sa propre
  page avec ses propres champs. En ajouter un 4e depuis le back office
  demanderait un vrai "constructeur de formulaire", pas juste une entrée
  de configuration. Ajouter un nouveau type reste possible, mais ça
  demande de construire sa page comme on l'a fait pour les 3 existants.

Aucun changement de schéma — pas de migration nécessaire (`ParametreSysteme`
existait déjà).

### ✅ Sections repliables + correctif "Prix par type" invisible
- **Correctif** — la section "Prix par type de boutique" pouvait
  disparaître silencieusement si les prix de base n'étaient pas encore
  synchronisés au moment du rendu (accès à une valeur `undefined`).
  Sécurisé, avec un message clair maintenant si la liste est vraiment
  vide ("Aucun produit" / "Aucun type de boutique actif") au lieu d'un
  vide silencieux sans explication.
- **Chaque section de `/admin/parametres` est maintenant repliable** —
  clique sur le titre (chevron qui pivote) pour la réduire une fois
  configurée, et gagner de la place à l'écran : Villes, Types de
  boutique, Binômes, Produits & prix, Prix par type de boutique,
  Objectifs par binôme, Objectifs individuels, Seuils des alertes, Durée
  de session. Les boutons d'action ("Ajouter", "Nouveau") restent
  accessibles même section repliée.
- Nettoyage au passage de quelques classes de couleur dupliquées
  (cosmétique, sans impact fonctionnel) laissées par un script de
  conversion en mode sombre précédent.

Aucun changement de schéma — pas de migration nécessaire.

### ✅ Correctif page Stock + audit sécurité/production + scripts de reset avant lancement

**1. Pages admin qui "ne s'affichaient pas tout le temps" (Stock, et par
extension Utilisateurs / Paramètres)**
- Cause racine : ces pages sont des composants client qui chargent leurs
  données via `fetch(...).then(r => r.json())`, **sans jamais gérer les
  échecs** (session expirée → 401, erreur réseau, timeout Vercel/pooler
  Supabase renvoyant une réponse non-JSON). Le résultat : la page restait
  silencieusement vide, ou — cas de "Prix par type de boutique" dans
  Paramètres — bloquée indéfiniment sur "Chargement..." (le `finally`
  qui coupe le spinner était absent de cette branche précise).
- Correctif : nouveau petit utilitaire `lib/client/apiFetch.ts`, utilisé
  maintenant par Stock, Utilisateurs et les 8 sections de Paramètres :
  - **401 (session expirée)** → redirection automatique vers `/login`
    au lieu d'un écran vide sans explication.
  - **Autre erreur** (réseau, JSON invalide, 4xx/5xx) → message d'erreur
    affiché avec un bouton "Réessayer" (page Stock et Utilisateurs), ou au
    minimum trace dans la console navigateur plutôt qu'un échec muet
    (sections de Paramètres).
  - Le bug du spinner bloqué indéfiniment sur "Prix par type de boutique"
    (absence de `.finally`) est corrigé.
- Corrigé aussi au passage : le formulaire "Seuil d'alerte" de la page
  Stock n'informait pas l'utilisateur en cas d'échec d'enregistrement
  (fermait la modale silencieusement) — affiche maintenant une alerte.

**2. Audit sécurité / prêt-pour-la-production**
- **Build cassé en production** — `lib/jobs/aggregate.ts` : `villeId`
  pouvait être `null` et cassait le build Vercel (`Type 'string | null'
  is not assignable to type 'string'`). Même correctif que celui déjà
  appliqué à `binomeId`/`produitId` (substitut `""`).
- **Faille réelle corrigée** — `app/api/cron/aggregate/route.ts` : si
  `CRON_SECRET` n'était pas défini en production, la comparaison devenait
  `authHeader !== "Bearer undefined"`, contournable en envoyant
  littéralement `Authorization: Bearer undefined`. Le job refuse
  maintenant systématiquement si `CRON_SECRET` est absent.
- **Identifiants de démo faibles et documentés publiquement** —
  `prisma/seed.ts` créait un compte `admin` / `changeme123` (et
  `commercial1/2/3` avec le même mot de passe). Si ce seed avait jamais
  tourné contre la base de production, ces identifiants devenus
  "publics" (présents dans ce dépôt) auraient donné un accès admin
  complet. Le script refuse maintenant de créer ces comptes sans
  `SEED_DEMO_USERS=1` explicite, et jamais si `NODE_ENV=production`. **Le
  script de reset ci-dessous supprime ces comptes s'ils existent déjà.**
- **Upload photo** — aucune limite de taille ni de type MIME sur les
  photos envoyées (`app/api/upload/route.ts`) : ajout d'une limite
  (~8 Mo) et d'un allowlist strict (`image/png`, `image/jpeg`) — évite
  un abus de stockage et empêche l'upload d'un type de fichier non prévu.
- **En-têtes de sécurité HTTP** — absents jusqu'ici. Ajoutés dans
  `next.config.js` : `X-Frame-Options: DENY`, `X-Content-Type-Options:
  nosniff`, `Referrer-Policy`, `Permissions-Policy` (géolocalisation
  limitée à l'app elle-même), `Strict-Transport-Security`. Pas de CSP
  stricte pour l'instant (risque de casser le script anti-flash du mode
  sombre et les tuiles OpenStreetMap sans tests approfondis) — à
  envisager plus tard si besoin.
- **Durcissement mineur** — validation `.url()` ajoutée sur `avatarUrl`
  (au lieu d'une chaîne libre non vérifiée) ; nettoyage de dépendances
  dupliquées dans `package.json`.
- **Vérifié sans problème trouvé** : toutes les routes API sensibles sont
  protégées par `requireAuth`/`requireAdmin` ; mots de passe hashés en
  bcrypt ; sessions JWT + révocation côté serveur (table `Session`) ;
  cookie `httpOnly`/`secure`/`sameSite=lax` ; limitation des tentatives
  de connexion (5 échecs / 15 min) ; validation Zod sur (quasi) toutes
  les entrées ; aucune requête SQL brute (`$queryRaw`/`$executeRaw`) —
  tout passe par Prisma, donc pas d'injection SQL ; aucun secret exposé
  côté client (`NEXT_PUBLIC_*`) ; `.env` correctement ignoré par Git ;
  pagination bornée à 100 lignes max (pas de DoS par requête géante) ;
  aucun code de contournement/`backdoor` trouvé.
- **Point à surveiller, non bloquant** : un commercial authentifié peut
  aujourd'hui modifier le statut de n'importe quel prospect en connaissant
  son id (`app/api/prospects/[id]/route.ts` n'est pas restreint au
  créateur/binôme) — risque faible (ids UUID non énumérables, petite
  équipe de confiance) mais à garder en tête si l'équipe grandit.

**3. Scripts pour vider l'application avant les vraies données**
- `prisma/reset-for-launch.ts` (`npm run reset:launch`) — supprime
  **toute** l'activité de test (visites, ventes, commandes, points de
  vente, clients, prospects, photos, alertes, stock history, sessions,
  logs de sync, données agrégées) et **tous les comptes utilisateurs** (y
  compris l'admin de démo). **Conserve** le référentiel réel : villes,
  quartiers, types de boutique, produits HYPO/HTC et leurs prix,
  paramètres système. Remet le stock de chaque produit à 0 plutôt que de
  supprimer la ligne (pour que HYPO/HTC restent visibles, prêts pour le
  premier réassort réel). Protégé par une confirmation explicite :
  `CONFIRM_RESET=OUI-JE-VEUX-TOUT-EFFACER npm run reset:launch`. Affiche
  d'abord un état des lieux (nombre de lignes par table) avant de
  supprimer quoi que ce soit.
- `prisma/create-first-admin.ts` (`npm run create:first-admin`) — comme
  le reset supprime tous les comptes (y compris l'admin), ce script crée
  le tout premier admin réel (identifiant/mot de passe/nom/prénom
  demandés de façon interactive, ou via variables d'environnement) ; les
  comptes suivants se créent ensuite normalement depuis Paramètres >
  Utilisateurs. Refuse de s'exécuter si un admin existe déjà.

⚠️ Ces deux scripts sont fournis prêts à l'emploi mais n'ont pas pu être
exécutés depuis cet environnement (pas d'accès à la base de production
Supabase). À lancer par Victor, en local, avec le `DATABASE_URL` de
production dans `.env`, dans cet ordre : `reset:launch` puis
`create:first-admin`.

Aucun changement de schéma — pas de migration nécessaire.

### ✅ Vérification admin des crédits déclarés réglés + fiche client détaillée

**1. Alertes crédit — déclaration terrain + vérification admin**
- Nouveau cycle de vie pour les alertes (`Alerte.statut`, remplace l'ancien
  booléen `resolue`) : `ACTIVE` → `EN_ATTENTE_VERIFICATION` → `RESOLUE`.
  Le palier intermédiaire n'est utilisé que par `CREDIT_RETARD` pour
  l'instant.
- **Côté commercial** (dashboard) : chaque crédit en cours affiche
  maintenant un bouton **"Marquer réglé"**. Un clic déclare le crédit
  réglé sur le terrain — **aucun paiement n'est enregistré
  automatiquement** (choix assumé : c'est une déclaration administrative,
  pas une saisie de paiement détaillée). Le bouton devient "En attente de
  vérification" tant que l'admin n'a pas tranché.
- **Côté admin** (`/admin/alertes`) : une alerte en attente affiche qui a
  déclaré, quand, et un commentaire éventuel, avec deux boutons
  **Confirmer** (le crédit sort définitivement du suivi commercial) ou
  **Rejeter** (la déclaration est écartée, l'alerte redevient active,
  le crédit reste dû).
- Un admin garde la possibilité de résoudre n'importe quelle alerte
  directement (bouton "Résolue" existant), sans attendre de déclaration
  du commercial.

**2. Page Clients refaite — recherche, filtres, fiche détaillée**
- L'ancien classement "top clients par ville" (lecture seule, sans
  recherche) est remplacé par une liste paginée avec recherche
  (nom/téléphone) et filtre par statut (actif/inactif) — l'API
  `/api/clients` le supportait déjà, seule l'interface manquait.
- Cliquer sur un client ouvre une fiche détaillée : coordonnées, point de
  vente (ville/quartier/type), **crédit en cours total**, historique des
  ventes (avec reste dû par vente) et des commandes.
- Édition du nom/téléphone et bascule actif/inactif directement depuis la
  fiche (admin uniquement).

**Migration SQL à exécuter manuellement (Supabase → SQL Editor), avant de
redéployer le code qui l'utilise :**

```sql
-- Nouveau statut d'alerte (remplace le booléen resolue)
DO $$ BEGIN
  CREATE TYPE "StatutAlerte" AS ENUM ('ACTIVE', 'EN_ATTENTE_VERIFICATION', 'RESOLUE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE alertes ADD COLUMN IF NOT EXISTS statut "StatutAlerte" NOT NULL DEFAULT 'ACTIVE';
UPDATE alertes SET statut = 'RESOLUE' WHERE resolue = true;
ALTER TABLE alertes DROP COLUMN IF EXISTS resolue;

ALTER TABLE alertes ADD COLUMN IF NOT EXISTS declaree_par_id TEXT REFERENCES users(id);
ALTER TABLE alertes ADD COLUMN IF NOT EXISTS declaree_at TIMESTAMP(3);
ALTER TABLE alertes ADD COLUMN IF NOT EXISTS commentaire_declaration TEXT;
ALTER TABLE alertes ADD COLUMN IF NOT EXISTS verifiee_par_id TEXT REFERENCES users(id);
ALTER TABLE alertes ADD COLUMN IF NOT EXISTS verifiee_at TIMESTAMP(3);

DROP INDEX IF EXISTS alertes_type_resolue_idx;
CREATE INDEX IF NOT EXISTS alertes_type_statut_idx ON alertes(type, statut);
```

Aucun changement de schéma côté Client/PointVente — la fiche détaillée et
la recherche s'appuient sur les colonnes déjà existantes.

### ✅ Notification du commercial + classement des commandes par statut

**1. Nouveau statut intermédiaire "En livraison"**
- `Commande.statut` passe de 3 à 4 valeurs :
  `EN_ATTENTE` → `EN_LIVRAISON` → `LIVREE`, avec `ANNULEE` toujours
  possible depuis `EN_ATTENTE` ou `EN_LIVRAISON`.
- Côté admin (`/admin/commandes`), le bouton **"Valider"** remplace
  l'ancien passage direct à "Livrée" : valider une commande la fait
  passer en `EN_LIVRAISON` et **notifie le commercial** qui l'a
  enregistrée (voir point 2). Une fois la marchandise réellement livrée,
  un second bouton **"Livrée"** clôt la commande.

**2. Notifications commercial**
- Le modèle `Notification` existait déjà dans le schéma (prévu mais
  jamais branché) — il est maintenant utilisé : quand l'admin valide une
  commande, une notification est créée pour le commercial concerné, avec
  un message du type *"Commande de {nom du vendeur} ({quartier}) : en
  cours de livraison."*
- Nouvelles routes `GET /api/notifications` (mes notifications + nombre
  non lues), `PATCH /api/notifications/:id` (marquer une notification
  lue) et `POST /api/notifications/mark-all-read`.
- Cloche de notifications dans l'en-tête du dashboard commercial
  (`components/commercial/NotificationsBell.tsx`) : badge avec le nombre
  de notifications non lues, panneau déroulant, rafraîchi automatiquement
  toutes les 45s pendant que le dashboard est ouvert.

**3. Classement des commandes par statut (admin)**
- La page `/admin/commandes` affiche maintenant des pastilles de filtre
  rapide (comme la page Alertes) : **Toutes / En attente / En livraison /
  Livrées / Annulées**, chacune avec son compteur, en plus du filtre
  déroulant existant (ville, commercial, dates).

**Migration SQL à exécuter manuellement (Supabase → SQL Editor), avant de
redéployer le code qui l'utilise :**

```sql
-- Nouvelle valeur d'enum : ne peut pas être utilisée dans la même
-- transaction que sa création — exécuter ce bloc seul, valider, puis
-- continuer (l'éditeur SQL Supabase exécute déjà chaque requête ainsi).
ALTER TYPE "StatutCommande" ADD VALUE IF NOT EXISTS 'EN_LIVRAISON';
```

Aucune autre migration nécessaire : la table `notifications` existe déjà
depuis la mise en place initiale du schéma.

### ✅ Bon de livraison PDF

- Une fois une commande validée (`EN_LIVRAISON`) ou livrée (`LIVREE`),
  un bouton **"Bon de livraison"** apparaît à côté des actions de statut
  sur `/admin/commandes` (`components/admin/BonLivraisonButton.tsx`).
- Génère un PDF (`lib/utils/bon-livraison-pdf.ts`) avec la même identité
  visuelle que la facture (logo, bandeau bleu) mais **sans aucun
  montant** : n° de commande, date de livraison, bloc "LIVRÉ À" / "LIVRÉ
  PAR", tableau des produits (sachets/filets/cartons, pas de prix), case
  "Marchandise reçue conforme...", zone de signatures, mention "Document
  de livraison — sans valeur fiscale".
- Aucune migration SQL nécessaire (aucun changement de schéma).

### ✅ Refonte de la page Stock (`/admin/stock`)

- La page passe d'un affichage en cartes avec 3 modales séparées
  (ajuster / seuil / historique) à un **tableau pleine largeur**
  (Produit | Stock disponible | Seuil d'alerte | Statut), dans les
  couleurs bleu/teal habituelles d'ICHA (le style crème/or d'une
  maquette de référence n'a volontairement pas été repris — seule la
  structure l'a été).
- Le seuil d'alerte s'édite désormais **en ligne** (icône crayon à côté
  de la valeur), sans modale.
- Les 2 boutons "Réassort"/"Retirer" sont remplacés par un **formulaire
  unique "Enregistrer un mouvement manuel"**, avec un type à 2 options :
  - **Entrée** : ajoute la quantité saisie au stock existant.
  - **Ajustement** : la quantité saisie est le **nouveau total** ; le
    delta par rapport au stock actuel est calculé côté client puis
    envoyé au même endpoint existant (`POST
    /api/stock/[produitId]/ajuster`, type `ENTREE` si le delta est
    positif, `SORTIE` s'il est négatif) — **aucun changement de
    schéma ni de service** : le verrou optimiste déjà en place dans
    `applyStockMovement()` (`lib/services/stock.ts`) empêche déjà tout
    passage sous zéro, pour ce nouveau type comme pour les mouvements
    existants (réassort manuel, vente).
- Les 2 anciennes modales "Historique" (une par produit) sont remplacées
  par un **tableau d'historique combiné**, tous produits confondus, en
  bas de page, alimenté par une nouvelle fonction
  `getMouvementsRecentsTous()` (`lib/queries/stock.ts`) et une nouvelle
  route `GET /api/stock/mouvements`.
- L'ancienne route `GET /api/stock/[produitId]/mouvements` (historique
  par produit) est conservée telle quelle — elle ne gêne pas et pourrait
  resservir plus tard.
- Aucune migration SQL nécessaire (aucun changement de schéma) — le
  stock négatif était déjà structurellement impossible avant cette
  refonte, elle réutilise simplement ce mécanisme existant.

### ✅ Rapports par catégorie + export PDF / impression

- La page `/admin/rapports` propose maintenant **5 catégories** de
  rapport, sélectionnables via des pastilles (comme Commandes/Alertes) :
  **Par commercial** (existant), **Par point de vente**, **Par ville**,
  **Par quartier**, et **Par vente** (détail ligne par ligne, paginé,
  30 ventes/page).
- Les **filtres restent communs aux 5 catégories** (commercial, binôme,
  ville, quartier, type de point de vente, produit, période) et sont
  conservés en changeant de catégorie ou de page.
- Les 4 tuiles de totaux (Ventes / CA / Cartons HYPO / Cartons HTC) en
  haut de page portent toujours sur l'ensemble du filtre, quelle que
  soit la catégorie affichée.
- `lib/queries/rapports.ts` : une seule fonction `getRapport(filters,
  vue, page)` — une seule requête `Vente` par appel, puis regroupement
  (ou pagination pour "Par vente") fait en mémoire.
- **Export PDF** (`components/admin/PdfExportButton.tsx`, généralisé)
  génère désormais le PDF pour n'importe laquelle des 5 catégories,
  avec les mêmes colonnes que le tableau affiché à l'écran.
- **Impression** (`components/admin/ImprimerButton.tsx`) : nouveau
  bouton "Imprimer" qui déclenche l'impression navigateur ; la
  sidebar/nav admin et les filtres portent la classe Tailwind
  `print:hidden` pour ne laisser que le tableau à l'impression.
- Aucune migration SQL nécessaire (aucun changement de schéma).

### ✅ Correctif — montants FCFA illisibles dans les PDF

- Bug signalé par Victor (capture d'écran) : dans le PDF exporté des
  rapports, un montant comme `1 153 350` s'affichait `1 / 1 5 3 / 3 5
  0`. Cause : `toLocaleString("fr-FR")` insère un espace fine
  insécable (U+202F) comme séparateur de milliers, correct à l'écran
  mais indessinable par la police Helvetica intégrée à jsPDF.
- Correctif centralisé dans un nouvel utilitaire partagé
  `lib/utils/format.ts` (`formatMontant` / `formatFcfa`), qui construit
  le séparateur de milliers avec un espace normal. `lib/utils/facture-
  pdf.ts` (facture + bon de livraison) et `app/(admin)/admin/rapports/
  page.tsx` utilisent désormais tous les deux cette même fonction —
  plus aucune duplication de la logique de formatage.
- Aucune migration SQL nécessaire.

### ✅ Fiche détaillée point de vente + filtres/export sur la liste

- En cliquant sur le nom d'un point de vente dans `/admin/points-vente`
  (tableau desktop ou cartes mobile), on accède maintenant à une fiche
  détaillée `/admin/points-vente/[id]` — même principe de structure que
  l'exemple montré par Victor, mais avec l'identité visuelle ICHA
  (bleu/teal), pas le style crème/doré de l'autre projet de référence.
- La fiche affiche : bouton retour, carte d'en-tête (nom · type · ville
  · quartier), bloc **Interlocuteur** (vendeur + téléphones vendeur/
  patron, lien WhatsApp), bloc **Localisation** (repère + lien "Voir sur
  la carte"), la mention "Recensé par {prénom nom} le {date}", 3 tuiles
  statistiques (**Visite(s)**, **Total vendu (FCFA)**, **Reste à payer
  (FCFA)**), puis les listes **Ventes**, **Commandes** et **Historique
  des visites**.
  - ⚠️ Différence assumée avec l'exemple de référence : dans le schéma
    ICHA, le modèle `Commande` (bon de commande à livrer) ne porte
    aucun montant — seul `Vente` en porte. "Total vendu" / "Reste à
    payer" sont donc calculés à partir des **ventes** du point de vente
    (montant total moins paiements reçus), pas des commandes. Les
    commandes sont affichées avec leur statut (`EN_ATTENTE` /
    `EN_LIVRAISON` / `LIVREE` / `ANNULEE`) et le résumé des produits,
    sans montant.
  - ICHA n'ayant pas de notion de "potentiel" / "veut commander" sur les
    visites (seulement un champ `observation` libre), ces indicateurs
    de l'exemple de référence n'ont pas d'équivalent ici et ne sont pas
    repris.
  - Nouvelle fonction `getPointVenteDetail(id)` dans
    `lib/queries/points-vente.ts`, construite sur le même principe de
    calcul crédit que `getClientDetail` (`lib/queries/clients.ts`).
- La **liste** `/admin/points-vente` avait déjà tous ses filtres
  (recherche, ville, quartier, type, tri par nombre de commandes) — il
  manquait seulement l'export. Ajout de **Export PDF** et
  **Imprimer** en haut de page (mêmes composants génériques que
  `/admin/rapports` : `PdfExportButton` / `ImprimerButton`), qui
  respectent les filtres actifs.
- Aucune migration SQL nécessaire (aucun changement de schéma — cette
  fiche ne fait qu'ajouter une nouvelle requête de lecture sur des
  tables/relations existantes).

### ✅ Durcissement sécurité (étape 1 de l'audit)

Audit complet du code (auth, 56 routes API, requêtes, jobs, pages admin,
service worker, `npm audit`). Cette étape corrige les failles qui ne
demandent **aucun changement de modèle de données**.

**Sessions et comptes**
- `getSession()` lit désormais l'utilisateur en base avec la session
  (même requête) : un compte **désactivé** est refusé immédiatement, et
  le **rôle / binôme** viennent de la base, plus du jeton (un admin
  rétrogradé perd ses droits tout de suite).
- `lastSeenAt` n'est plus réécrit à chaque requête, seulement si la
  valeur a plus de 5 minutes (une écriture en moins par appel d'API).
- Les sessions sont **révoquées** à la désactivation d'un compte, au
  changement de rôle, à la réinitialisation du mot de passe par un admin,
  et (hors appareil courant) au changement de mot de passe par
  l'utilisateur. Un admin ne peut plus se désactiver / se rétrograder
  lui-même.
- Nouvelle garde `requireAdminPage()` (`lib/auth/rbac.ts`) appelée en
  tête de **toutes** les pages admin rendues côté serveur (8 pages) : le
  middleware ne vérifiait que la signature du jeton, pas la révocation.
- Algorithme JWT épinglé à HS256.

**Cloisonnement des données**
- Réservées à l'admin (le terrain ne les appelait jamais) : `GET
  /api/ventes`, `/api/commandes`, `/api/visites`, `/api/clients` (+
  `[id]`), `/api/prospects` (GET/POST/PATCH), `/api/stock` et les 2
  routes de mouvements, `GET` liste et `POST` des points de vente, et
  `PATCH /api/points-vente/[id]`.
- `GET /api/points-vente/[id]` reste ouvert au commercial (préremplissage
  de la visite de réassort) mais sans prospects ni clients.

**Entrées**
- `POST /api/visites` : quantités ≤ 100 000, montants ≤ 1 milliard,
  paiement ≤ montant de la vente, date de visite entre −60 jours et +10
  minutes, binôme **toujours** pris sur la session.
- Photos : URL https sous le domaine de stockage configuré, ou data URL
  png/jpeg que le **serveur envoie lui-même** au stockage avant
  l'enregistrement (plus de base64 stocké en base ; repli sur le data URL
  si le stockage est indisponible).
- `avatarUrl` : https + domaine de stockage uniquement.
- Connexion : plafond de 30 échecs / 15 min **par IP** en plus du plafond
  par identifiant, comparaison de hash factice quand l'identifiant
  n'existe pas (plus de devinette d'identifiants au chronomètre).
- Cron quotidien : purge des tentatives de connexion et sessions de plus
  de 30 jours.

**SQL optionnel** (index pour le plafond par IP, à passer dans le SQL
Editor Supabase — l'app fonctionne sans, c'est juste plus rapide) :

```sql
CREATE INDEX IF NOT EXISTS "login_attempts_ip_created_at_idx"
  ON "login_attempts" ("ip", "created_at");
```

**Pas encore traité** (décisions ou tests nécessaires) : recalcul des
montants côté serveur (dépend de la règle "le commercial peut-il
négocier le prix ?"), mises à jour de dépendances signalées par `npm
audit` (Next, jsPDF, basic-ftp — à tester avec les PDF), politique de
mot de passe (min. 6 caractères, compte de démo `changeme123` à
supprimer en production), journal d'audit, CSP, verrouillage d'un compte
par un tiers (5 échecs).

### ✅ Identité SIRI IMPORT, connexion repensée et gains de vitesse

- **Nouvelle identité** : écu sombre cerclé d'or avec monogramme « S » (`components/brand/SiriMark.tsx`, aussi `public/brand/siri-mark.svg`), pensé pour toutes les familles de produits (céréales, hygiène, entretien, épicerie). Le logo HYPO et le motif de bouteilles/sachets sont supprimés.
- **Page de connexion** : panneau nuit + or, wordmark en serif, icônes de familles de produits, formulaire à accents or, mode sombre conservé. 100 % CSS/SVG : aucune image à télécharger, aucun JS d'animation.
- **Textes de marque** : tout passe à « SIRI IMPORT » (titre, manifest PWA, sidebar admin, en-têtes commerciaux et d'impression, PDF rapports/factures/bons de livraison — l'écu est dessiné en vectoriel dans les PDF, `lib/utils/pdf-marque.ts`). Constantes dans `lib/brand.ts`.
- **Icônes PWA** (192, 512, apple-touch) régénérées ; cache du service worker passé à `siri-shell-v2`. Si l'ancienne icône « hypo » reste sur l'écran d'accueil d'un téléphone, supprimer puis réinstaller l'app.
- **Vitesse** : compteur d'alertes de la sidebar admin rafraîchi au plus 1 fois/minute (au lieu de chaque clic) ; rapports bornés à 90 jours par défaut (dates modifiables) ; `optimizePackageImports` (lucide, recharts) ; cache 7 jours sur logo/icônes.
- **SQL optionnel (Supabase SQL Editor)** — index manquant :

```sql
CREATE INDEX IF NOT EXISTS "alertes_entite_type_entite_id_idx" ON "alertes" ("entite_type", "entite_id");
```

- Les libellés « HYPO / HTC » restent dans rapports/dashboard/stock : ils seront remplacés par des catégories dynamiques à l'étape multi-catégories.

### ✅ Mode hors ligne et synchronisation automatique (espace terrain)

- **Ouverture sans réseau** : le service worker (`public/sw.js`, v3) met réellement en cache les fichiers JS/CSS (avant, ils n'étaient jamais gardés, donc l'app ne s'ouvrait pas sans réseau) et les écrans terrain (dashboard, nouvelle visite, rotation, réassort, historique, profil). Réseau d'abord, dernière version connue si le réseau est absent ou met plus de 4 s. L'admin n'est jamais mis en cache.
- **Préchargement** : au démarrage (en ligne), `OfflineManager` demande au service worker de télécharger tous les écrans terrain et le code de génération de factures PDF ; les écrans fonctionnent donc hors ligne même s'ils n'ont jamais été ouverts.
- **Données en local (IndexedDB, `lib/offline/referentiels.ts`)** : produits, prix, villes, quartiers, types de boutique, profil et liste des points de vente (`/api/points-vente/hors-ligne`, 5 000 max). Rafraîchies au démarrage, au retour réseau et toutes les 20 min. Le choix du quartier se fait en local.
- **Recherche de point de vente hors ligne** (rotation/réassort) : repli automatique sur la liste locale (nom, vendeur, « près de moi » par GPS). Un point de vente créé hors ligne est retrouvable avant même d'être synchronisé.
- **Synchronisation robuste (`lib/offline/sync.ts`)** : envoi dans l'ordre de saisie, sans doublon (`uuidClient`). Erreur réseau/serveur : nouvel essai avec attente croissante (15 s à 15 min). Refus définitif (données invalides, stock insuffisant, date de plus de 60 jours…) : la visite reste visible avec son motif, boutons « Réessayer » / « Supprimer ». Session expirée : rien n'est perdu, l'envoi reprend après reconnexion. Une visite n'est envoyée que par le compte qui l'a saisie.
- **Bandeau d'état** sur tous les écrans terrain (`components/commercial/OfflineManager.tsx`, monté dans `app/(commercial)/layout.tsx`) : hors ligne, visites en attente, visites refusées, session expirée. L'ancien bandeau du dashboard est supprimé.
- **Déconnexion** : efface les pages et données de référence du téléphone (jamais les visites en attente). Impossible hors ligne (message explicite).
- **Limites connues** : les chiffres du dashboard, de l'historique et du profil affichent la dernière version vue (ils ne se mettent à jour qu'en ligne) ; les photos prises hors ligne restent dans la visite (data URL) jusqu'à l'envoi, puis sont stockées côté serveur ; une première utilisation exige une ouverture avec du réseau.
- Aucun SQL à lancer pour cette étape.

### ✅ Rapports : nouveau modèle (calqué sur BELGRAVIA) et prêt pour les nouvelles gammes

- **7 onglets** : par commercial, par point de vente, par ville, par quartier, détail des ventes, par produit, historique 12 mois. **Filtres** : Du / Au, commercial, binôme, ville, type de boutique, **gamme**, produit, quartier (« contient »). **Exports** : PDF, Excel (CSV avec montants en nombres bruts, ouvrable directement dans Excel français), impression.
- **Colonnes** : points de vente recensés, visites, commandes, cartons vendus, chiffre d'affaires, % du CA, reste à payer, avec ligne Total. Tuiles du haut : points de vente recensés, visites, commandes, CA.
- **Aperçu imprimable** : un clic sur une ligne ouvre sa fiche (indicateurs, détail par produit, liste des ventes avec payé / reste) ; « Imprimer » n'imprime que cette fiche (`ApercuRapport.tsx`, règles `apercu-actif` dans `globals.css`).
- **Indépendant des produits** : plus aucune colonne HYPO/HTC en dur. Les produits et leur gamme viennent de la base ; une nouvelle gamme apparaît seule dans le filtre Gamme, l'onglet Produit et les aperçus. Tout le calcul propre au modèle actuel (cartons, répartition du CA) est isolé dans `lib/queries/rapports.ts` (`cartonsEquivalents`, `repartirVente`) : la refonte multi-catégories n'aura qu'à adapter ces deux fonctions.
- **Règles de calcul** : « Cartons vendus » = cartons + filets et sachets convertis en cartons (ex. 6 sachets d'un carton de 12 = 0,5). Le CA n'étant enregistré que par vente, le CA par produit répartit le montant de la vente au prorata de la valeur de chaque ligne (total toujours exact). Reste à payer = montant de la vente − paiements enregistrés. Avec un filtre produit/gamme, seules les lignes concernées sont comptées.
- **Période par défaut** : 90 derniers jours (modifiable) ; l'historique couvre toujours les 12 derniers mois.
- **Correction de fond** : une vente ou commande saisie hors ligne est désormais datée du jour de la visite (et non du jour de l'envoi).
- **Gamme** : nouveau champ sur les produits (Paramètres > Produits & prix, à la création et à la modification).
- **SQL à lancer AVANT de déployer** (Supabase SQL Editor) :

```sql
ALTER TABLE "produits" ADD COLUMN IF NOT EXISTS "gamme" TEXT;
UPDATE "produits" SET "gamme" = 'Entretien' WHERE "gamme" IS NULL AND "code" IN ('HYPO', 'HTC');
```

### 📋 Limitations restantes
- **Boutons placeholder du dashboard commercial sans page dédiée propre**
  — "Visite de rotation et d'achalandage" et "Visite de réassort" ont
  bien leurs pages maintenant, mais si Victor prévoit d'autres types de
  visite à l'avenir, il faudra les ajouter au même modèle
- Pas de suivi de version pour les migrations Prisma (`prisma/migrations`
  reste vide, tout est passé par SQL manuel) — pas bloquant, juste moins
  traçable qu'un historique de migrations en bonne et due forme

## Documents sources

Ce projet est basé sur 3 documents fournis par Victor :
1. Cahier des charges fonctionnel v1.1
2. Exigences de scalabilité et gestion de grande base de données
3. Infrastructure et déploiement (Vercel)
