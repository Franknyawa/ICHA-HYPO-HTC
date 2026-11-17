import { z } from "zod";
import type { Prisma, PrismaClient } from "@prisma/client";
import { validerGrille } from "@/lib/utils/tarifs";

type Db = PrismaClient | Prisma.TransactionClient;

/** Prix négociés avec un client (grossiste) : prix du carton fixe et/ou grille par quantité, par produit. */
export async function chargerPrixClient(db: Db, pointVenteId: string | null | undefined) {
  if (!pointVenteId) return { prixClient: [], paliersClient: [] };
  const [prixClient, paliersClient] = await Promise.all([
    db.prixClient.findMany({ where: { pointVenteId } }),
    db.palierPrixClient.findMany({ where: { pointVenteId }, orderBy: [{ produitId: "asc" }, { minCartons: "asc" }] }),
  ]);
  return { prixClient, paliersClient };
}

/** Tous les clients qui ont des prix négociés : pour l'appli terrain (hors ligne). */
export async function chargerPrixTousClients(db: Db) {
  const [prix, paliers] = await Promise.all([db.prixClient.findMany(), db.palierPrixClient.findMany({ orderBy: { minCartons: "asc" } })]);
  const parClient: Record<string, { prixClient: { produitId: string; prixCarton: number }[]; paliersClient: { produitId: string; minCartons: number; maxCartons: number | null; prixCarton: number }[] }> = {};
  const get = (id: string) => (parClient[id] ??= { prixClient: [], paliersClient: [] });
  for (const p of prix) get(p.pointVenteId).prixClient.push({ produitId: p.produitId, prixCarton: Number(p.prixCarton) });
  for (const p of paliers) get(p.pointVenteId).paliersClient.push({ produitId: p.produitId, minCartons: p.minCartons, maxCartons: p.maxCartons, prixCarton: Number(p.prixCarton) });
  return parClient;
}

export const prixClientSchema = z.object({
  produits: z
    .array(
      z.object({
        produitId: z.string().uuid(),
        /** null / absent = pas de prix fixe négocié (prix du type de boutique). */
        prixCarton: z.number().positive().max(100_000_000).nullable().optional(),
        paliers: z
          .array(
            z.object({
              minCartons: z.number().int().min(0).max(100_000),
              maxCartons: z.number().int().min(1).max(100_000).nullable(),
              prixCarton: z.number().positive().max(100_000_000),
            })
          )
          .max(20)
          .default([]),
      })
    )
    .max(50),
});

export type PrixClientInput = z.infer<typeof prixClientSchema>;

/** Message d'erreur si une grille est incohérente, sinon null. */
export function verifierPrixClient(input: PrixClientInput): string | null {
  for (const p of input.produits) {
    const err = validerGrille(p.paliers);
    if (err) return err;
  }
  return null;
}

/** Remplace d'un coup les prix négociés du client (une seule transaction). */
export async function enregistrerPrixClient(tx: Prisma.TransactionClient, pointVenteId: string, input: PrixClientInput, userId: string) {
  await tx.prixClient.deleteMany({ where: { pointVenteId } });
  await tx.palierPrixClient.deleteMany({ where: { pointVenteId } });
  for (const p of input.produits) {
    if (p.prixCarton != null) {
      await tx.prixClient.create({ data: { pointVenteId, produitId: p.produitId, prixCarton: p.prixCarton, updatedById: userId } });
    }
    for (const palier of p.paliers) {
      await tx.palierPrixClient.create({
        data: { pointVenteId, produitId: p.produitId, minCartons: palier.minCartons, maxCartons: palier.maxCartons, prixCarton: palier.prixCarton },
      });
    }
  }
}

type LigneTerrain = {
  produitCode: string;
  nbSachets: number;
  nbFilets: number;
  nbCartons: number;
  prixSachet?: number;
  prixFilet?: number;
  prixCarton?: number;
  montant?: number;
  detail?: boolean;
};

/**
 * Le serveur a le dernier mot sur les prix d'un client qui a des prix négociés : une appli terrain dont les
 * prix en cache sont périmés ne peut donc ni sous-facturer ni sur-facturer. Renvoie null si le client n'a
 * aucun prix négocié (les lignes envoyées par le terrain sont alors conservées telles quelles).
 */
export async function appliquerPrixNegocies<L extends LigneTerrain>(db: PrismaClient, pointVenteId: string | null | undefined, lignes: L[]) {
  if (!pointVenteId || lignes.every((l) => l.detail)) return null;
  const negocie = await chargerPrixClient(db, pointVenteId);
  if (negocie.prixClient.length + negocie.paliersClient.length === 0) return null;
  const [produits, prixParType, paliers, pv] = await Promise.all([
    db.produit.findMany({ where: { actif: true } }),
    db.prixParType.findMany(),
    db.palierPrix.findMany(),
    db.pointVente.findUnique({ where: { id: pointVenteId }, select: { typeId: true } }),
  ]);
  const { calculerLignesCommande } = await import("@/lib/services/commande-calcul");
  const codeParId = new Map(produits.map((p) => [p.id, p.code]));
  return lignes.map((l) => {
    if (l.detail) return l;
    const [calc] = calculerLignesCommande([{ produitCode: l.produitCode, nbSachets: l.nbSachets, nbFilets: l.nbFilets, nbCartons: l.nbCartons }], {
      produits,
      prixParType,
      paliers,
      typeId: pv?.typeId ?? null,
      ...negocie,
    });
    if (!calc || codeParId.get(calc.produitId) !== l.produitCode) return l;
    return { ...l, prixSachet: calc.prixSachet, prixFilet: calc.prixFilet, prixCarton: calc.prixCarton, montant: calc.montant };
  });
}
