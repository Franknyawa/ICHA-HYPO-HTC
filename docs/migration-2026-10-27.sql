-- Commandes saisies au bureau : qui a rempli le formulaire (admin / superviseur).
ALTER TABLE commandes ADD COLUMN IF NOT EXISTS saisie_par text;
