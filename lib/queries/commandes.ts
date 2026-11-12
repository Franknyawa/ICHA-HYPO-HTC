import { prisma } from "@/lib/prisma";
import { assurerMontantsConformes } from "@/lib/services/recalcul-prix";
import { getPaginationParams, buildPaginatedResponse } from "@/lib/pagination";
import type { Prisma } from "@prisma/client";
import { debutJour, finJour, jourDouala } from "@/lib/utils/periode";

export type StatutCommandeFiltre = "EN_ATTENTE" | "EN_LIVRAISON" | "LIVREE" | "ANNULEE";

export type ListCommandesParams = {
  page?: number;
  pageSize?: number;
  statut?: StatutCommandeFiltre;
  /** Plusieurs statuts à la fois (ex. commandes validées pour la page Factures). */
  statuts?: StatutCommandeFiltre[];
  villeId?: string;
  commercialId?: string;
  binomeId?: string;
  dateFrom?: string;
  dateTo?: string;
  /** « avenir » : livraisons prévues après aujourd'hui (à traiter ou en livraison) ; « courantes » : tout le reste. */
  livraison?: "avenir" | "courantes";
  /** Recherche : point de vente, interlocuteur, téléphone, commercial. */
  search?: string;
  /** Type de boutique du point de vente. */
  typeId?: string;
};

function filtresRecherche(params: { search?: string; typeId?: string }): Prisma.CommandeWhereInput[] {
  const out: Prisma.CommandeWhereInput[] = [];
  const q = params.search?.trim();
  if (q) {
    out.push({
      OR: [
        { pointVente: { nom: { contains: q, mode: "insensitive" } } },
        { pointVente: { vendeur: { contains: q, mode: "insensitive" } } },
        { pointVente: { telephoneVendeur: { contains: q } } },
        { pointVente: { quartier: { nom: { contains: q, mode: "insensitive" } } } },
        { commercial: { nom: { contains: q, mode: "insensitive" } } },
        { commercial: { prenom: { contains: q, mode: "insensitive" } } },
      ],
    });
  }
  if (params.typeId) out.push({ pointVente: { OR: [{ typeId: params.typeId }, { typesIds: { has: params.typeId } }] } });
  return out;
}

/**
 * Commerciaux visés par le filtre « commercial » ou « binôme ». Une commande CLIENT DIVERS regroupe le détail de
 * plusieurs commerciales sur une seule facture du jour : elle appartient à celle qui l'a ouverte, mais elle doit
 * aussi sortir quand on filtre sur n'importe laquelle des commerciales qui y ont une ligne.
 */
async function porteeCommerciaux(params: { commercialId?: string; binomeId?: string }): Promise<string[] | undefined> {
  if (params.commercialId) return [params.commercialId];
  if (params.binomeId) return (await prisma.user.findMany({ where: { binomeId: params.binomeId }, select: { id: true } })).map((u) => u.id);
  return undefined;
}

function filtreCommerciaux(ids?: string[]): Prisma.CommandeWhereInput[] {
  if (!ids) return [];
  return [{ OR: [{ commercialId: { in: ids } }, { origines: { some: { commercialId: { in: ids } } } }] }];
}

function construireWhere(params: ListCommandesParams, ids?: string[]): Prisma.CommandeWhereInput {
  // Livraison prévue un autre jour que le jour même, pour une commande pas encore partie.
  // Dans la liste principale, une commande prise AUJOURD'HUI reste toujours visible (même avec une livraison future).
  const aVenir: Prisma.CommandeWhereInput = {
    dateLivraisonPrevue: { gt: finJour(jourDouala()) },
    statut: { in: ["EN_ATTENTE", "EN_LIVRAISON"] },
  };
  return {
    archivedAt: null,
    AND: [...filtresRecherche(params), ...filtreCommerciaux(ids), ...(params.livraison === "avenir" ? [aVenir] : [])],
    // Écrit en positif (un NOT(...) renvoie NULL, donc masque la ligne, quand dateLivraisonPrevue est vide).
    ...(params.livraison === "courantes"
      ? {
          OR: [
            { dateCommande: { gte: debutJour(jourDouala()) } },
            { dateLivraisonPrevue: null },
            { dateLivraisonPrevue: { lte: finJour(jourDouala()) } },
            { statut: { notIn: ["EN_ATTENTE", "EN_LIVRAISON"] } },
          ],
        }
      : {}),
    ...(params.statut ? { statut: params.statut } : params.statuts ? { statut: { in: params.statuts } } : {}),
    ...(params.villeId ? { pointVente: { villeId: params.villeId } } : {}),
    ...(params.dateFrom || params.dateTo
      ? {
          dateCommande: {
            ...(params.dateFrom ? { gte: debutJour(params.dateFrom.slice(0, 10)) } : {}),
            ...(params.dateTo ? { lte: finJour(params.dateTo.slice(0, 10)) } : {}),
          },
        }
      : {}),
  };
}

export async function listCommandes(params: ListCommandesParams) {
  await assurerMontantsConformes();
  const sp = new URLSearchParams();
  if (params.page) sp.set("page", String(params.page));
  if (params.pageSize) sp.set("pageSize", String(params.pageSize));
  const { page, pageSize, skip, take } = getPaginationParams(sp);

  const where = construireWhere(params, await porteeCommerciaux(params));

  const [data, total] = await Promise.all([
    prisma.commande.findMany({
      relationLoadStrategy: "join",
      where,
      skip,
      take,
      orderBy: params.livraison === "avenir" ? [{ dateLivraisonPrevue: "asc" }, { dateCommande: "asc" }] : { dateCommande: "desc" },
      include: {
        pointVente: {
          select: {
            nom: true,
            vendeur: true,
            patronNom: true,
            telephoneVendeur: true,
            ville: { select: { nom: true } },
            quartier: { select: { nom: true } },
          },
        },
        client: { select: { nom: true } },
        commercial: { select: { nom: true, prenom: true } },
        origines: { select: { id: true, lieu: true, commercialNom: true, pointVenteNom: true, source: true, produitCode: true, nbSachets: true, nbFilets: true, montant: true, createdAt: true }, orderBy: { createdAt: "asc" } },
        lignes: { select: { nbSachets: true, nbFilets: true, nbCartons: true, detail: true, produit: { select: { code: true, sachetsParCarton: true, sachetsParFilet: true, filetsParCarton: true } } } },
      },
    }),
    prisma.commande.count({ where }),
  ]);

  return buildPaginatedResponse(data, total, page, pageSize);
}

/**
 * Compte les commandes par statut, pour les pastilles de filtre rapide de
 * la page admin (mêmes filtres ville/commercial/date que la liste, mais
 * sans filtrer par statut — sinon les autres pastilles retomberaient à 0).
 */
export async function countCommandesParStatut(
  params: Omit<ListCommandesParams, "page" | "pageSize" | "statut">
) {
  await assurerMontantsConformes();
  const where: Prisma.CommandeWhereInput = {
    archivedAt: null,
    AND: [...filtresRecherche(params), ...filtreCommerciaux(await porteeCommerciaux(params))],
    ...(params.villeId ? { pointVente: { villeId: params.villeId } } : {}),
    ...(params.dateFrom || params.dateTo
      ? {
          dateCommande: {
            ...(params.dateFrom ? { gte: debutJour(params.dateFrom.slice(0, 10)) } : {}),
            ...(params.dateTo ? { lte: finJour(params.dateTo.slice(0, 10)) } : {}),
          },
        }
      : {}),
  };

  const groupes = await prisma.commande.groupBy({
    by: ["statut"],
    where,
    _count: true,
  });

  const parStatut: Record<StatutCommandeFiltre, number> = {
    EN_ATTENTE: 0,
    EN_LIVRAISON: 0,
    LIVREE: 0,
    ANNULEE: 0,
  };
  for (const g of groupes) parStatut[g.statut as StatutCommandeFiltre] = g._count;

  const total = Object.values(parStatut).reduce((a, b) => a + b, 0);
  return { parStatut, total };
}

/** Nombre de commandes correspondant aux filtres, sans charger les lignes (pastille « Livraisons à venir »). */
export async function compterCommandes(params: ListCommandesParams) {
  await assurerMontantsConformes();
  return prisma.commande.count({ where: construireWhere(params, await porteeCommerciaux(params)) });
}
