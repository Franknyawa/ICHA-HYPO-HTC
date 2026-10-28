import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { debutJour, finJour } from "@/lib/utils/periode";

export type FiltreClients = {
  search?: string;
  villeId?: string;
  quartier?: string;
  typeId?: string;
  du?: string;
  au?: string;
};

export type ClientAcheteur = {
  id: string;
  codeClient: string | null;
  nom: string;
  contact: string | null;
  telephone: string | null;
  ville: string | null;
  quartier: string | null;
  type: string | null;
  nbAchats: number;
  /** Cartons réellement commandés (filets et sachets convertis en équivalent carton). */
  cartons: number;
  montant: number;
  dernierAchat: string;
};

const JOUR = /^\d{4}-\d{2}-\d{2}$/;
const MAX_CLIENTS = 3000;

/**
 * « Clients » = les points de vente dont au moins une commande a été VALIDÉE par
 * l'admin (en livraison ou livrée). Une commande qui vient d'être saisie (en attente)
 * n'en fait pas encore un client : elle reste visible dans Commandes et Points de vente.
 * Les totaux (commandes, cartons, montant) ne comptent que ces commandes validées,
 * dans la période choisie s'il y en a une.
 */
export async function getClientsAcheteurs(f: FiltreClients): Promise<ClientAcheteur[]> {
  const debut = f.du && JOUR.test(f.du) ? debutJour(f.du) : null;
  const fin = f.au && JOUR.test(f.au) ? finJour(f.au) : null;

  const commandeOk: Prisma.CommandeWhereInput = {
    statut: { in: ["EN_LIVRAISON", "LIVREE"] },
    ...(debut || fin ? { valideeAt: { ...(debut ? { gte: debut } : {}), ...(fin ? { lte: fin } : {}) } } : {}),
  };

  const recherche = f.search?.trim();
  const where: Prisma.PointVenteWhereInput = {
    AND: [
      { commandes: { some: commandeOk } },
      ...(f.villeId ? [{ villeId: f.villeId }] : []),
      ...(f.quartier?.trim() ? [{ quartier: { nom: { contains: f.quartier.trim(), mode: "insensitive" as const } } }] : []),
      ...(f.typeId ? [{ OR: [{ typeId: f.typeId }, { typesIds: { has: f.typeId } }] }] : []),
      ...(recherche
        ? [
            {
              OR: [
                { nom: { contains: recherche, mode: "insensitive" as const } },
                { codeClient: { contains: recherche, mode: "insensitive" as const } },
                { vendeur: { contains: recherche, mode: "insensitive" as const } },
                { telephoneVendeur: { contains: recherche } },
              ],
            },
          ]
        : []),
    ],
  };

  const points = await prisma.pointVente.findMany({
    where,
    take: MAX_CLIENTS,
    select: {
      id: true,
      codeClient: true,
      nom: true,
      vendeur: true,
      telephoneVendeur: true,
      ville: { select: { nom: true } },
      quartier: { select: { nom: true } },
      type: { select: { nom: true } },
    },
  });
  if (points.length === 0) return [];
  const ids = points.map((p) => p.id);

  const commandes = await prisma.commande.findMany({
    where: { pointVenteId: { in: ids }, ...commandeOk },
    select: {
      pointVenteId: true,
      montantTotal: true,
      valideeAt: true,
      dateCommande: true,
      lignes: {
        select: {
          nbCartons: true,
          nbFilets: true,
          nbSachets: true,
          produit: { select: { sachetsParCarton: true, sachetsParFilet: true } },
        },
      },
    },
  });

  const cumul = new Map<string, { nb: number; cartons: number; montant: number; dernier: number }>();
  for (const c of commandes) {
    const cur = cumul.get(c.pointVenteId) ?? { nb: 0, cartons: 0, montant: 0, dernier: 0 };
    cur.nb += 1;
    cur.montant += Number(c.montantTotal);
    for (const l of c.lignes) {
      const parCarton = l.produit.sachetsParCarton > 0 ? l.produit.sachetsParCarton : 1;
      const parFilet = l.produit.sachetsParFilet && l.produit.sachetsParFilet > 0 ? l.produit.sachetsParFilet : 1;
      cur.cartons += l.nbCartons + (l.nbFilets * parFilet) / parCarton + l.nbSachets / parCarton;
    }
    cur.dernier = Math.max(cur.dernier, (c.valideeAt ?? c.dateCommande).getTime());
    cumul.set(c.pointVenteId, cur);
  }

  return points
    .map((p) => {
      const c = cumul.get(p.id);
      return {
        id: p.id,
        codeClient: p.codeClient,
        nom: p.nom,
        contact: p.vendeur,
        telephone: p.telephoneVendeur,
        ville: p.ville?.nom ?? null,
        quartier: p.quartier?.nom ?? null,
        type: p.type?.nom ?? null,
        nbAchats: c?.nb ?? 0,
        cartons: Math.round((c?.cartons ?? 0) * 100) / 100,
        montant: c?.montant ?? 0,
        dernierAchat: new Date(c?.dernier ?? 0).toISOString(),
      };
    })
    .sort((a, b) => b.dernierAchat.localeCompare(a.dernierAchat));
}
