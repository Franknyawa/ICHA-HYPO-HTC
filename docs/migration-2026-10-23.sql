INSERT INTO types_point_vente (id, nom, actif, ordre)
SELECT gen_random_uuid()::text, 'Personne physique', true, COALESCE((SELECT MAX(ordre) FROM types_point_vente), 0) + 1
WHERE NOT EXISTS (SELECT 1 FROM types_point_vente WHERE nom = 'Personne physique');
