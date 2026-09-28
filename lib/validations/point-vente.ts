import { z } from "zod";

// uuidClient : généré côté PWA avant tout envoi (idempotence offline, §15/16
// doc infra). Optionnel ici pour les créations faites depuis l'admin web,
// obligatoire dans le module Visites où il vient du client hors-ligne.
export const createPointVenteSchema = z.object({
  uuidClient: z.string().uuid().optional(),
  nom: z.string().min(2, "Nom trop court"),
  vendeur: z.string().optional(),
  telephoneVendeur: z.string().optional(),
  villeId: z.string().uuid("Ville invalide"),
  quartierId: z.string().uuid().optional().nullable(),
  repere: z.string().optional(),
  typeId: z.string().uuid().optional().nullable(),
  presentoir: z.boolean().default(false),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  precisionGps: z.number().min(0).optional().nullable(),
});

export const updatePointVenteSchema = createPointVenteSchema
  .omit({ uuidClient: true })
  .partial();

export const listPointVenteQuerySchema = z.object({
  search: z.string().optional(),
  villeId: z.string().uuid().optional(),
  quartierId: z.string().uuid().optional(),
  typeId: z.string().uuid().optional(),
});

export const createProspectSchema = z.object({
  pointVenteId: z.string().uuid(),
  nom: z.string().min(2),
  telephone: z.string().optional(),
  statut: z
    .enum(["NOUVEAU", "A_RELANCER", "CONVERTI", "ABANDONNE"])
    .default("NOUVEAU"),
});

export const createClientSchema = z.object({
  pointVenteId: z.string().uuid(),
  nom: z.string().min(2),
  telephone: z.string().optional(),
  statut: z.enum(["ACTIF", "INACTIF"]).default("ACTIF"),
});
