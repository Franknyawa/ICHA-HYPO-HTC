import { z } from "zod";

const gpsSchema = z.object({
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  precisionGps: z.number().min(0).optional().nullable(),
});

const venteLigneSchema = z.object({
  produitCode: z.enum(["HYPO", "HTC"]),
  nbSachets: z.number().int().min(0).default(0),
  nbFilets: z.number().int().min(0).default(0),
  nbCartons: z.number().int().min(0).default(0),
});

// Modes de paiement réels du terrain (Victor) : le crédit fait directement
// partie du mode plutôt que d'être une case séparée — "est-ce un crédit ?"
// et "combien reste-t-il dû ?" sont dérivés côté serveur à partir du mode.
const paiementSchema = z.object({
  uuidClient: z.string().uuid(),
  montant: z.number().min(0),
  modePaiement: z.enum(["ESPECES", "MOBILE_MONEY", "CREDIT_PARTIEL", "CREDIT_TOTAL"]),
});

const venteSchema = z.object({
  uuidClient: z.string().uuid(),
  clientId: z.string().uuid().optional().nullable(),
  lignes: z.array(venteLigneSchema).min(1),
  // Un seul montant global déclaré par le commercial (pas de prix par
  // produit saisi sur le terrain) — simplification volontaire du MVP.
  montantTotal: z.number().min(0),
  paiement: paiementSchema.optional(),
});

// Commande à livrer plus tard (distincte de la vente immédiate) — §22 CDC.
const commandeLigneSchema = z.object({
  produitCode: z.enum(["HYPO", "HTC"]),
  nbSachets: z.number().int().min(0).default(0),
  nbFilets: z.number().int().min(0).default(0),
  nbCartons: z.number().int().min(0).default(0),
});

const commandeSchema = z.object({
  uuidClient: z.string().uuid(),
  clientId: z.string().uuid().optional().nullable(),
  lignes: z.array(commandeLigneSchema).min(1),
  dateLivraisonPrevue: z.string().datetime().optional(),
});

const photoSchema = z.object({
  uuidClient: z.string().uuid(),
  url: z.string(), // data URL acceptée en attendant le stockage cloud (voir README)
  type: z.string().default("POINT_VENTE"),
});

// Le point de vente peut être existant (pointVenteId) ou créé dans la
// foulée depuis le terrain (nouveauPointVente) — un commercial "recense"
// souvent un point de vente au moment même de la première visite (§2 CDC).
// Le quartier est saisi en texte libre : créé à la volée sous la ville
// choisie s'il n'existe pas déjà (find-or-create côté API), plutôt qu'une
// liste fermée qui obligerait à tout prévoir à l'avance.
const nouveauPointVenteSchema = z.object({
  uuidClient: z.string().uuid().optional(),
  nom: z.string().min(2),
  vendeur: z.string().optional(),
  telephoneVendeur: z.string().optional(),
  villeId: z.string().uuid(),
  quartierNom: z.string().optional(),
  repere: z.string().optional(),
  typeId: z.string().uuid().optional().nullable(),
  presentoir: z.boolean().default(false),
});

export const createVisiteSchema = z
  .object({
    uuidClient: z.string().uuid(),
    // Pas de contrainte .uuid() stricte ici : les binômes créés par le seed
    // utilisent des identifiants lisibles ("seed-binome-1") plutôt que des
    // UUID générés, pour rester stables entre deux exécutions du seed.
    binomeId: z.string().optional().nullable(),
    dateVisite: z.string().datetime(), // ISO — généré côté PWA au moment de la saisie
    pointVenteId: z.string().uuid().optional(),
    nouveauPointVente: nouveauPointVenteSchema.optional(),
    vente: venteSchema.optional(),
    commande: commandeSchema.optional(),
    photos: z.array(photoSchema).default([]),
    observation: z.string().optional(),
  })
  .merge(gpsSchema)
  .refine((data) => data.pointVenteId || data.nouveauPointVente, {
    message: "Un point de vente (existant ou nouveau) est requis.",
    path: ["pointVenteId"],
  });

export type CreateVisiteInput = z.infer<typeof createVisiteSchema>;
