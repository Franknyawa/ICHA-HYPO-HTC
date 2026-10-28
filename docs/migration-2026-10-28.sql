-- Facture « CLIENT DIVERS » : origine de chaque vente au détail (commerciale, point visité, source).
CREATE TABLE IF NOT EXISTS commande_detail_origines (
  id             text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  commande_id    text NOT NULL REFERENCES commandes(id) ON DELETE CASCADE,
  commercial_id  text NOT NULL,
  commercial_nom text NOT NULL,
  point_vente_nom text,
  vente_id       text,
  source         text NOT NULL DEFAULT 'Terrain',
  produit_id     text NOT NULL,
  produit_code   text NOT NULL,
  nb_sachets     integer NOT NULL DEFAULT 0,
  nb_filets      integer NOT NULL DEFAULT 0,
  montant        numeric(12,2) NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS commande_detail_origines_commande_idx ON commande_detail_origines (commande_id);
CREATE INDEX IF NOT EXISTS commande_detail_origines_commercial_idx ON commande_detail_origines (commercial_id);

-- Reprise de l'existant : retrouve les ventes au détail des commerciales, jour par jour,
-- et les rattache à la commande « CLIENT DIVERS » de ce jour (Douala, UTC+1).
INSERT INTO commande_detail_origines
  (commande_id, commercial_id, commercial_nom, point_vente_nom, vente_id, source, produit_id, produit_code, nb_sachets, nb_filets, montant, created_at)
SELECT c.id, v.commercial_id, u.prenom || ' ' || u.nom, pv2.nom, v.id, 'Terrain',
       vl.produit_id, p.code, vl.nb_sachets, vl.nb_filets, vl.montant, v.date_vente
FROM commandes c
JOIN points_vente pv ON pv.id = c.point_vente_id AND upper(trim(pv.nom)) = 'CLIENT DIVERS'
JOIN ventes v ON (v.date_vente AT TIME ZONE 'Africa/Douala')::date = (c.date_commande AT TIME ZONE 'Africa/Douala')::date
JOIN ventes_lignes vl ON vl.vente_id = v.id AND vl.detail = true
JOIN users u ON u.id = v.commercial_id
JOIN produits p ON p.id = vl.produit_id
JOIN points_vente pv2 ON pv2.id = v.point_vente_id
WHERE NOT EXISTS (SELECT 1 FROM commande_detail_origines o WHERE o.commande_id = c.id);
