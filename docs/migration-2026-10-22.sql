-- À exécuter SEUL (une seule instruction) dans le SQL Editor de Supabase :
ALTER TYPE "TypeAlerte" ADD VALUE IF NOT EXISTS 'ENCAISSEMENT_A_FAIRE';

-- Vente au détail (sachets 100 F / filets 1 000 F) : à exécuter ensuite (peut l'être d'un coup).
ALTER TABLE "commandes_lignes" ADD COLUMN IF NOT EXISTS "detail" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ventes_lignes" ADD COLUMN IF NOT EXISTS "detail" BOOLEAN NOT NULL DEFAULT false;
