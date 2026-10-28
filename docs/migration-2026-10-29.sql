-- 1) « Personne physique » devient « Client divers » (formulaire de commande du commercial)
UPDATE types_point_vente SET nom = 'Client divers' WHERE nom = 'Personne physique';

-- 2) Code client : colonne unique + séquence (CLI-0001, CLI-0002...)
ALTER TABLE points_vente ADD COLUMN IF NOT EXISTS code_client TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS points_vente_code_client_key ON points_vente (code_client);
CREATE SEQUENCE IF NOT EXISTS code_client_seq START 1;
