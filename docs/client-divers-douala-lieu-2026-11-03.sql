-- Colonnes « lieu » (ville · quartier) pour les achats client divers.
ALTER TABLE ventes ADD COLUMN IF NOT EXISTS lieu text;
ALTER TABLE commande_detail_origines ADD COLUMN IF NOT EXISTS lieu text;

-- Le vrai CLIENT DIVERS passe en ville Douala.
UPDATE points_vente
SET ville_id = (SELECT id FROM villes WHERE nom ILIKE 'douala' LIMIT 1)
WHERE nom = 'CLIENT DIVERS'
  AND EXISTS (SELECT 1 FROM villes WHERE nom ILIKE 'douala');
