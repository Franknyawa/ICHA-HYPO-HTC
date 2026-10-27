-- 1) Les annulations de doublons reprennent la date de l'encaissement annulé
UPDATE operations_caisse o
SET date_operation = (SELECT MIN(p.date_paiement) FROM paiements p WHERE p.commande_id = o.reference_id)
WHERE o.reference_type = 'DOUBLON'
  AND EXISTS (SELECT 1 FROM paiements p WHERE p.commande_id = o.reference_id);

-- 2) La régularisation est datée d'hier (26/10), pas d'aujourd'hui
UPDATE operations_caisse
SET date_operation = TIMESTAMPTZ '2026-10-26 18:00:00+01'
WHERE type = 'RECETTE' AND note ILIKE 'Régularisation%';
