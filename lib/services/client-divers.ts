import type { Prisma } from "@prisma/client";
import { debutJour, finJour, jourDouala } from "@/lib/utils/periode";

type Tx = Prisma.TransactionClient;

export const NOM_CLIENT_DIVERS = "CLIENT DIVERS";

export type LigneDetail = {
  produitId: string;
  nbSachets: number;
  nbFilets: number;
  prixSachet: number;
  prixFilet: number;
  prixCarton: number;
  montant: number;
};

/** Le point de vente unique « CLIENT DIVERS » (créé au besoin) : il porte toutes les ventes au détail. */
export async function obtenirClientDivers(tx: Tx, userId: string) {
  const existant = await tx.pointVente.findFirst({
    where: { nom: NOM_CLIENT_DIVERS },
    select: { id: true },
  });
  if (existant) return existant.id;
  const ville = await tx.ville.findFirst({ where: { actif: true }, orderBy: { nom: "asc" }, select: { id: true } });
  if (!ville) throw new Error("Aucune ville configurée : impossible de créer le client divers.");
  const type = await tx.typePointVente.findFirst({ where: { nom: "Personne physique" }, select: { id: true } });
  const cree = await tx.pointVente.create({
    data: {
      nom: NOM_CLIENT_DIVERS,
      villeId: ville.id,
      typeId: type?.id,
      typesIds: type ? [type.id] : [],
      repere: "Ventes au détail — une seule facture par jour",
      createdById: userId,
    },
    select: { id: true },
  });
  return cree.id;
}

/**
 * Ajoute des ventes au détail (sachets / filets) à la commande « client divers » du jour
 * (jour de Douala), créée à la première vente. Tant qu'elle n'est pas validée, toutes les
 * ventes de la journée s'y cumulent : une seule facture récapitulative en fin de journée.
 */
export async function ajouterVentesDetail(
  tx: Tx,
  p: { lignes: LigneDetail[]; commercialId: string; date: Date; userId: string }
) {
  if (p.lignes.length === 0) return null;
  // Verrou : deux synchronisations simultanées ne doivent pas créer deux commandes du jour.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('client-divers'))`;

  const pointVenteId = await obtenirClientDivers(tx, p.userId);
  const jour = jourDouala(p.date);
  let commande = await tx.commande.findFirst({
    where: {
      pointVenteId,
      archivedAt: null,
      statut: "EN_ATTENTE",
      dateCommande: { gte: debutJour(jour), lte: finJour(jour) },
    },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  if (!commande) {
    commande = await tx.commande.create({
      data: {
        uuidClient: `divers:${jour}:${crypto.randomUUID()}`,
        pointVenteId,
        commercialId: p.commercialId,
        dateCommande: p.date,
        dateLivraisonPrevue: p.date,
        montantTotal: 0,
        modePaiement: "ESPECES",
      },
      select: { id: true },
    });
  }

  for (const l of p.lignes) {
    const ligne = await tx.commandeLigne.findFirst({
      where: { commandeId: commande.id, produitId: l.produitId, detail: true },
      select: { id: true },
    });
    if (ligne) {
      await tx.commandeLigne.update({
        where: { id: ligne.id },
        data: {
          nbSachets: { increment: l.nbSachets },
          nbFilets: { increment: l.nbFilets },
          montant: { increment: l.montant },
        },
      });
    } else {
      await tx.commandeLigne.create({
        data: {
          commandeId: commande.id,
          produitId: l.produitId,
          nbSachets: l.nbSachets,
          nbFilets: l.nbFilets,
          nbCartons: 0,
          prixSachet: l.prixSachet,
          prixFilet: l.prixFilet,
          prixCarton: l.prixCarton,
          montant: l.montant,
          detail: true,
        },
      });
    }
  }
  const total = await tx.commandeLigne.aggregate({ where: { commandeId: commande.id }, _sum: { montant: true } });
  await tx.commande.update({ where: { id: commande.id }, data: { montantTotal: total._sum.montant ?? 0 } });
  return commande.id;
}
