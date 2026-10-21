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


-- =====================================================================
-- COMPLÉMENT (20 oct., 2e livraison) — à lancer APRÈS les blocs ci-dessus
-- =====================================================================

-- ===== BLOC 5 (à lancer SEUL) : option Banque dans les paiements =====
ALTER TYPE "ModePaiement" ADD VALUE IF NOT EXISTS 'BANQUE';

-- ===== BLOC 6 : lien commande ↔ vente terrain + bons de commande numérotés =====
ALTER TABLE "commandes" ADD COLUMN IF NOT EXISTS "vente_id" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "commandes_vente_id_key" ON "commandes"("vente_id");

CREATE TABLE IF NOT EXISTS "bons_commande" (
  "id" TEXT NOT NULL,
  "numero" SERIAL NOT NULL,
  "commande_id" TEXT,
  "vente_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bons_commande_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "bons_commande_numero_key" ON "bons_commande"("numero");
CREATE UNIQUE INDEX IF NOT EXISTS "bons_commande_commande_id_key" ON "bons_commande"("commande_id");
CREATE UNIQUE INDEX IF NOT EXISTS "bons_commande_vente_id_key" ON "bons_commande"("vente_id");

-- ===== BLOC 7 : index pour accélérer les pages =====
CREATE INDEX IF NOT EXISTS "paiements_commande_id_idx" ON "paiements"("commande_id");
CREATE INDEX IF NOT EXISTS "commandes_statut_date_idx" ON "commandes"("statut", "date_commande");


-- ============================================================
-- BLOC 8 (lot 3) : factures d'avoir (FA) et factures retour (FR)
-- ============================================================
CREATE TABLE IF NOT EXISTS "factures_avoir" (
  "id" TEXT PRIMARY KEY,
  "numero" SERIAL NOT NULL,
  "commande_id" TEXT NOT NULL,
  "retour_id" TEXT,
  "motif" TEXT NOT NULL,
  "montant" DECIMAL(12,2) NOT NULL,
  "lignes" JSONB NOT NULL DEFAULT '[]',
  "created_by_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "factures_avoir_numero_key" ON "factures_avoir"("numero");
CREATE UNIQUE INDEX IF NOT EXISTS "factures_avoir_retour_id_key" ON "factures_avoir"("retour_id");
CREATE INDEX IF NOT EXISTS "factures_avoir_commande_id_idx" ON "factures_avoir"("commande_id");
CREATE INDEX IF NOT EXISTS "factures_avoir_created_at_idx" ON "factures_avoir"("created_at");

CREATE TABLE IF NOT EXISTS "factures_retour" (
  "id" TEXT PRIMARY KEY,
  "numero" SERIAL NOT NULL,
  "commande_id" TEXT NOT NULL,
  "motif" TEXT NOT NULL,
  "destination" TEXT NOT NULL DEFAULT 'STOCK',
  "montant" DECIMAL(12,2) NOT NULL,
  "lignes" JSONB NOT NULL DEFAULT '[]',
  "created_by_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "factures_retour_numero_key" ON "factures_retour"("numero");
CREATE INDEX IF NOT EXISTS "factures_retour_commande_id_idx" ON "factures_retour"("commande_id");
CREATE INDEX IF NOT EXISTS "factures_retour_created_at_idx" ON "factures_retour"("created_at");

-- Index de performance (pages Commandes et Points de vente)
CREATE INDEX IF NOT EXISTS "commandes_date_commande_idx" ON "commandes"("date_commande");
CREATE INDEX IF NOT EXISTS "commandes_point_vente_id_idx" ON "commandes"("point_vente_id");


-- ============================================================
-- BLOC 9 (lot 4) : date de validation des commandes + prospects indécis
-- ============================================================
ALTER TABLE "commandes" ADD COLUMN IF NOT EXISTS "validee_at" TIMESTAMP(3);
-- Les commandes déjà validées reçoivent leur date de commande comme date de validation.
UPDATE "commandes" SET "validee_at" = "date_commande"
 WHERE "validee_at" IS NULL AND "statut" IN ('EN_LIVRAISON', 'LIVREE');

CREATE TABLE IF NOT EXISTS "prospects_indecis" (
  "id" TEXT PRIMARY KEY,
  "uuid_client" TEXT NOT NULL,
  "point_vente_id" TEXT NOT NULL,
  "commercial_id" TEXT NOT NULL,
  "visite_id" TEXT,
  "cartons_estimes" INTEGER,
  "note" TEXT,
  "date_relance" TIMESTAMP(3) NOT NULL,
  "statut" TEXT NOT NULL DEFAULT 'A_RELANCER',
  "nb_relances" INTEGER NOT NULL DEFAULT 0,
  "derniere_relance_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "prospects_indecis_uuid_client_key" ON "prospects_indecis"("uuid_client");
CREATE INDEX IF NOT EXISTS "prospects_indecis_statut_date_relance_idx" ON "prospects_indecis"("statut", "date_relance");
CREATE INDEX IF NOT EXISTS "prospects_indecis_point_vente_id_idx" ON "prospects_indecis"("point_vente_id");
CREATE INDEX IF NOT EXISTS "prospects_indecis_commercial_id_idx" ON "prospects_indecis"("commercial_id");
