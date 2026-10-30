-- À passer APRÈS le déploiement (git push terminé) : supprime définitivement les codes clients.
ALTER TABLE points_vente DROP COLUMN IF EXISTS code_client;
DROP SEQUENCE IF EXISTS code_client_seq;
