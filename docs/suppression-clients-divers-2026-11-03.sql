-- ÉTAPE 1 — APERÇU : les « clients divers » créés comme de faux clients (à vérifier avant l'étape 2).
-- Tout point de vente dont le nom contient « divers », sauf le vrai « CLIENT DIVERS ».
SELECT p.id, p.nom, p.vendeur, p.created_at,
       (SELECT count(*) FROM visites v WHERE v.point_vente_id = p.id)  AS visites,
       (SELECT count(*) FROM ventes v WHERE v.point_vente_id = p.id)   AS ventes,
       (SELECT count(*) FROM commandes c WHERE c.point_vente_id = p.id) AS commandes
FROM points_vente p
WHERE p.nom ILIKE '%divers%' AND p.nom <> 'CLIENT DIVERS' AND p.archived_at IS NULL
ORDER BY p.created_at;

-- ÉTAPE 2 — NETTOYAGE (à lancer seulement si l'aperçu est bon).
-- • Les commandes, ventes et clients restent (stock et caisse intacts) mais sont rattachés au vrai « CLIENT DIVERS ».
-- • Les fausses visites / photos / relances de ces faux clients sont supprimées.
-- • Les faux clients sont archivés (ils disparaissent des listes).
BEGIN;

-- Le vrai CLIENT DIVERS doit exister (créé automatiquement à la 1re vente au détail).
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM points_vente WHERE nom = 'CLIENT DIVERS') THEN
    RAISE EXCEPTION 'Le point de vente CLIENT DIVERS n''existe pas encore : enregistre d''abord une vente au détail, puis relance.';
  END IF;
END $$;

CREATE TEMP TABLE faux_divers ON COMMIT DROP AS
  SELECT id FROM points_vente WHERE nom ILIKE '%divers%' AND nom <> 'CLIENT DIVERS' AND archived_at IS NULL;

CREATE TEMP TABLE vrai_divers ON COMMIT DROP AS
  SELECT id FROM points_vente WHERE nom = 'CLIENT DIVERS' LIMIT 1;

-- Détache les ventes de leurs visites, puis supprime les visites et ce qui en dépend.
UPDATE ventes SET visite_id = NULL WHERE visite_id IN (SELECT id FROM visites WHERE point_vente_id IN (SELECT id FROM faux_divers));
DELETE FROM photos WHERE point_vente_id IN (SELECT id FROM faux_divers) OR visite_id IN (SELECT id FROM visites WHERE point_vente_id IN (SELECT id FROM faux_divers));
DELETE FROM prospects_indecis WHERE point_vente_id IN (SELECT id FROM faux_divers) OR visite_id IN (SELECT id FROM visites WHERE point_vente_id IN (SELECT id FROM faux_divers));
DELETE FROM prospects WHERE point_vente_id IN (SELECT id FROM faux_divers);
DELETE FROM visites WHERE point_vente_id IN (SELECT id FROM faux_divers);

-- Rattache l'argent (commandes, ventes) et les fiches clients au vrai CLIENT DIVERS.
UPDATE commandes SET point_vente_id = (SELECT id FROM vrai_divers) WHERE point_vente_id IN (SELECT id FROM faux_divers);
UPDATE ventes    SET point_vente_id = (SELECT id FROM vrai_divers) WHERE point_vente_id IN (SELECT id FROM faux_divers);
UPDATE clients   SET point_vente_id = (SELECT id FROM vrai_divers) WHERE point_vente_id IN (SELECT id FROM faux_divers);

-- Archive les faux clients.
UPDATE points_vente SET archived_at = now(), repere = 'Client divers supprimé le 03/11/2026'
WHERE id IN (SELECT id FROM faux_divers);

COMMIT;
