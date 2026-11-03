-- ÉTAPE 1 — APERÇU : factures CLIENT DIVERS 100 % tarif bureau dont le total ne correspond plus au détail.
SELECT c.id, c.date_commande, c.montant_total,
       (SELECT sum(o.montant) FROM commande_detail_origines o WHERE o.commande_id = c.id) AS total_attendu
FROM commandes c
WHERE c.statut = 'EN_ATTENTE'
  AND EXISTS (SELECT 1 FROM commande_detail_origines o WHERE o.commande_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM commande_detail_origines o WHERE o.commande_id = c.id AND o.source NOT LIKE 'Personnel bureau%')
  AND c.montant_total <> (SELECT sum(o.montant) FROM commande_detail_origines o WHERE o.commande_id = c.id);

-- ÉTAPE 2 — CORRECTION : remet prix et montants des lignes d'après le détail enregistré, puis recalcule le total.
BEGIN;
UPDATE commandes_lignes l
SET prix_sachet = CASE WHEN l.montant > 0 THEN ROUND(l.prix_sachet * x.attendu / l.montant) ELSE l.prix_sachet END,
    prix_filet  = CASE WHEN l.montant > 0 THEN ROUND(l.prix_filet  * x.attendu / l.montant) ELSE l.prix_filet END,
    montant = x.attendu
FROM (
  SELECT o.commande_id, o.produit_id, sum(o.montant) AS attendu
  FROM commande_detail_origines o
  JOIN commandes c ON c.id = o.commande_id
  WHERE c.statut = 'EN_ATTENTE'
    AND NOT EXISTS (SELECT 1 FROM commande_detail_origines o2 WHERE o2.commande_id = c.id AND o2.source NOT LIKE 'Personnel bureau%')
  GROUP BY o.commande_id, o.produit_id
) x
WHERE l.commande_id = x.commande_id AND l.produit_id = x.produit_id AND l.detail = true AND l.montant <> x.attendu;

UPDATE commandes c
SET montant_total = (SELECT sum(l.montant) FROM commandes_lignes l WHERE l.commande_id = c.id)
WHERE c.statut = 'EN_ATTENTE'
  AND EXISTS (SELECT 1 FROM commande_detail_origines o WHERE o.commande_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM commande_detail_origines o WHERE o.commande_id = c.id AND o.source NOT LIKE 'Personnel bureau%');
COMMIT;
