-- ICHA IMPORT — remise à zéro des données de TEST
-- À lancer dans Supabase > SQL Editor. IRRÉVERSIBLE : fais d'abord une sauvegarde si doute.
-- CONSERVE : utilisateurs, binômes, produits/prix/paliers, villes/quartiers, types de PV,
--            agents de facturation, paramètres système, objectifs définis, structure du stock (lignes).
-- SUPPRIME : points de vente, clients, prospects, visites, photos, ventes, commandes, paiements,
--            bons/factures/avoirs/retours, caisse, mouvements de stock, alertes, notifications, stats.
-- Les numéros (FVICHA, BLICHA, BCICHA, FA, FR) repartent à 00001.

BEGIN;

TRUNCATE TABLE
  prospects_indecis,
  factures_avoir,
  factures_retour,
  factures,
  bons_livraison,
  bons_commande,
  paiements,
  operations_caisse,
  commandes_lignes,
  commandes,
  ventes_lignes,
  ventes,
  photos,
  visites,
  prospects,
  clients,
  points_vente,
  mouvements_stock,
  alertes,
  notifications,
  sync_logs,
  agg_ventes_journalieres,
  agg_performance_binome
RESTART IDENTITY CASCADE;

-- Stock remis à 0 (on garde les seuils d'alerte)
UPDATE stock SET quantite_sachets = 0, version = 0;

COMMIT;

-- Vérification rapide (doit tout renvoyer 0)
SELECT
  (SELECT count(*) FROM points_vente) AS points_vente,
  (SELECT count(*) FROM commandes)    AS commandes,
  (SELECT count(*) FROM paiements)    AS paiements,
  (SELECT count(*) FROM users)        AS utilisateurs_conserves;
