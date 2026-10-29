-- Le « CLIENT DIVERS » n'est plus un client : on efface ses données de profil (contact, code, repère).
-- Ses commandes/factures du jour NE SONT PAS touchées : elles portent les ventes au détail réelles (stock et caisse).
UPDATE points_vente
SET vendeur = NULL, telephone_vendeur = NULL, telephone_patron = NULL, patron_nom = NULL,
    repondant_role = NULL, repondant_fonction = NULL, code_client = NULL
WHERE nom = 'CLIENT DIVERS';
