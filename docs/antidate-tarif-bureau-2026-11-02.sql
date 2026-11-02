-- Commandes antidatées : drapeau sur la commande (à lancer AVANT de déployer).
ALTER TABLE commandes ADD COLUMN IF NOT EXISTS antidatee boolean NOT NULL DEFAULT false;
