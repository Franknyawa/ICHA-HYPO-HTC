-- =====================================================================
-- ICHA IMPORT — Nettoyage des données de test avant le lancement
-- =====================================================================
-- CONSERVE : utilisateurs, binômes, villes, quartiers, types de boutique,
--            produits, prix par type, paramètres, objectifs, stock (quantités).
-- SUPPRIME : points de vente, visites, ventes, paiements, commandes,
--            prospects, clients, photos (références), alertes, notifications,
--            mouvements de stock, opérations de caisse, journaux de synchro.
-- IRRÉVERSIBLE. Fais d'abord l'ÉTAPE 1 (aperçu), puis l'ÉTAPE 2.
-- =====================================================================

-- ÉTAPE 1 — APERÇU (lecture seule) : ce qui sera supprimé
SELECT 'points_vente' AS table_, count(*) FROM points_vente
UNION ALL SELECT 'visites', count(*) FROM visites
UNION ALL SELECT 'ventes', count(*) FROM ventes
UNION ALL SELECT 'paiements', count(*) FROM paiements
UNION ALL SELECT 'commandes', count(*) FROM commandes
UNION ALL SELECT 'prospects', count(*) FROM prospects
UNION ALL SELECT 'clients', count(*) FROM clients
UNION ALL SELECT 'photos', count(*) FROM photos
UNION ALL SELECT 'alertes', count(*) FROM alertes
UNION ALL SELECT 'notifications', count(*) FROM notifications
UNION ALL SELECT 'mouvements_stock', count(*) FROM mouvements_stock
UNION ALL SELECT 'operations_caisse', count(*) FROM operations_caisse;

-- ÉTAPE 2 — NETTOYAGE (à lancer seulement après avoir vérifié l'aperçu)
BEGIN;

TRUNCATE TABLE
  paiements,
  ventes_lignes,
  ventes,
  commandes_lignes,
  commandes,
  photos,
  prospects,
  clients,
  visites,
  points_vente,
  alertes,
  notifications,
  mouvements_stock,
  operations_caisse,
  sync_logs,
  agg_ventes_journalieres,
  agg_performance_binome,
  login_attempts
RESTART IDENTITY;

COMMIT;

-- ÉTAPE 3 — FACULTATIF (une requête à la fois, selon ton besoin)

-- a) Remettre le stock à zéro pour ressaisir le vrai stock de départ
--    (Admin → Stock → « Enregistrer un mouvement manuel »)
-- UPDATE stock SET quantite_sachets = 0, version = version + 1;

-- b) Retirer le coût moyen des produits (recalculé aux vraies entrées de stock)
-- UPDATE produits SET cout_carton = NULL;

-- c) Supprimer les quartiers créés pendant les tests
-- DELETE FROM quartiers;

-- d) Voir les comptes pour repérer ceux de test (puis les supprimer
--    depuis Admin → Utilisateurs → bouton rouge « Supprimer »)
-- SELECT username, role, nom, prenom, actif FROM users ORDER BY role, username;
