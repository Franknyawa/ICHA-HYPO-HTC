import type { Prisma } from "@prisma/client";

/** « Douala · Akwa » : ville (id) + quartier saisi, pour un achat sans fiche client. */
export async function texteLieu(tx: Prisma.TransactionClient, l?: { villeId: string; quartierNom?: string }) {
  if (!l) return null;
  const ville = await tx.ville.findUnique({ where: { id: l.villeId }, select: { nom: true } });
  return [ville?.nom, l.quartierNom?.replace(/\s+/g, " ").trim()].filter(Boolean).join(" · ") || null;
}
