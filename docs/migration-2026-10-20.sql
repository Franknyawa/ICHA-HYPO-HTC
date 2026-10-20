-- =====================================================================
-- ICHA IMPORT — Migration : bons de commande, factures, caisse, stock,
-- objectifs par région/ville, grille tarifaire
-- À lancer dans Supabase (SQL Editor) AVANT de déployer, UN BLOC À LA FOIS.
-- Tous les blocs sont sans danger si on les relance (IF NOT EXISTS).
-- =====================================================================

-- ===== BLOC 1 (à lancer SEUL) =====
ALTER TYPE "CanalCaisse" ADD VALUE IF NOT EXISTS 'BANQUE';

-- ===== BLOC 2 : colonnes =====
SET lock_timeout = '5s';
ALTER TABLE "villes" ADD COLUMN IF NOT EXISTS "region" TEXT;
ALTER TABLE "produits" ADD COLUMN IF NOT EXISTS "designation" TEXT;
ALTER TABLE "ventes" ADD COLUMN IF NOT EXISTS "mode_paiement" "ModePaiement";
ALTER TABLE "ventes" ADD COLUMN IF NOT EXISTS "montant_annonce" DECIMAL(12,2);
ALTER TABLE "ventes_lignes" ADD COLUMN IF NOT EXISTS "prix_sachet" DECIMAL(10,2);
ALTER TABLE "ventes_lignes" ADD COLUMN IF NOT EXISTS "prix_filet" DECIMAL(10,2);
ALTER TABLE "ventes_lignes" ADD COLUMN IF NOT EXISTS "prix_carton" DECIMAL(10,2);
ALTER TABLE "commandes" ADD COLUMN IF NOT EXISTS "montant_total" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "commandes" ADD COLUMN IF NOT EXISTS "mode_paiement" "ModePaiement";
ALTER TABLE "commandes_lignes" ADD COLUMN IF NOT EXISTS "montant" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "commandes_lignes" ADD COLUMN IF NOT EXISTS "prix_sachet" DECIMAL(10,2);
ALTER TABLE "commandes_lignes" ADD COLUMN IF NOT EXISTS "prix_filet" DECIMAL(10,2);
ALTER TABLE "commandes_lignes" ADD COLUMN IF NOT EXISTS "prix_carton" DECIMAL(10,2);
ALTER TABLE "paiements" ADD COLUMN IF NOT EXISTS "encaisse_par_id" TEXT;
ALTER TABLE "mouvements_stock" ADD COLUMN IF NOT EXISTS "note" TEXT;

-- ===== BLOC 3 : nouvelles tables =====
CREATE TABLE IF NOT EXISTS "paliers_prix" (
  "id" TEXT NOT NULL,
  "produit_id" TEXT NOT NULL,
  "min_cartons" INTEGER NOT NULL,
  "max_cartons" INTEGER,
  "prix_carton" DECIMAL(10,2) NOT NULL,
  CONSTRAINT "paliers_prix_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "paliers_prix_produit_id_fkey" FOREIGN KEY ("produit_id") REFERENCES "produits"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "paliers_prix_produit_id_idx" ON "paliers_prix"("produit_id");

CREATE TABLE IF NOT EXISTS "agents_facturation" (
  "id" TEXT NOT NULL,
  "nom" TEXT NOT NULL,
  "actif" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agents_facturation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "factures" (
  "id" TEXT NOT NULL,
  "numero" SERIAL NOT NULL,
  "vente_id" TEXT,
  "commande_id" TEXT,
  "agent_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "factures_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "factures_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents_facturation"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "factures_numero_key" ON "factures"("numero");
CREATE UNIQUE INDEX IF NOT EXISTS "factures_vente_id_key" ON "factures"("vente_id");
CREATE UNIQUE INDEX IF NOT EXISTS "factures_commande_id_key" ON "factures"("commande_id");

CREATE TABLE IF NOT EXISTS "bons_livraison" (
  "id" TEXT NOT NULL,
  "numero" SERIAL NOT NULL,
  "commande_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bons_livraison_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "bons_livraison_numero_key" ON "bons_livraison"("numero");
CREATE UNIQUE INDEX IF NOT EXISTS "bons_livraison_commande_id_key" ON "bons_livraison"("commande_id");

CREATE TABLE IF NOT EXISTS "objectifs_territoire" (
  "id" TEXT NOT NULL,
  "niveau" TEXT NOT NULL,
  "cle" TEXT NOT NULL,
  "periode" "PeriodeObjectif" NOT NULL,
  "valeur_cartons" INTEGER NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "objectifs_territoire_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "objectifs_territoire_niveau_cle_periode_key"
  ON "objectifs_territoire"("niveau", "cle", "periode");

-- ===== BLOC 4 : données de départ =====
INSERT INTO "agents_facturation" ("id", "nom")
SELECT gen_random_uuid()::text, 'NSINZE SABA'
WHERE NOT EXISTS (SELECT 1 FROM "agents_facturation" WHERE "nom" = 'NSINZE SABA');

UPDATE "produits" SET "designation" = 'HYPO eau de Javel carton de 112 sachets de 75ml'
 WHERE "code" = 'HYPO' AND "designation" IS NULL;
UPDATE "produits" SET "designation" = 'HYPO Toilet Cleanser (HTC) carton de 120 sachets de 60ml'
 WHERE "code" = 'HTC' AND "designation" IS NULL;
