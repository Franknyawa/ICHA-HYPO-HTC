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

export async function listCommandes(params: ListCommandesParams) {
  await assurerMontantsConformes();
  const sp = new URLSearchParams();
  if (params.page) sp.set("page", String(params.page));
  if (params.pageSize) sp.set("pageSize", String(params.pageSize));
  const { page, pageSize, skip, take } = getPaginationParams(sp);

  // Livraison prévue un autre jour que le jour même, pour une commande pas encore partie.
  // Dans la liste principale, une commande prise AUJOURD'HUI reste toujours visible (même avec une livraison future).
  const aVenir: Prisma.CommandeWhereInput = {
    dateLivraisonPrevue: { gt: finJour(jourDouala()) },
    statut: { in: ["EN_ATTENTE", "EN_LIVRAISON"] },
  };
  const where: Prisma.CommandeWhereInput = {
    archivedAt: null,
    AND: [...filtresRecherche(params), ...(params.livraison === "avenir" ? [aVenir] : [])],
    ...(params.livraison === "courantes" ? { NOT: { AND: [aVenir, { dateCommande: { lt: debutJour(jourDouala()) } }] } } : {}),
    ...(params.statut ? { statut: params.statut } : params.statuts ? { statut: { in: params.statuts } } : {}),
    ...(params.villeId ? { pointVente: { villeId: params.villeId } } : {}),
    ...(params.commercialId ? { commercialId: params.commercialId } : {}),
    ...(params.binomeId ? { commercial: { binomeId: params.binomeId } } : {}),
    ...(params.dateFrom || params.dateTo
      ? {
          dateCommande: {
            ...(params.dateFrom ? { gte: new Date(params.dateFrom) } : {}),
            ...(params.dateTo ? { lte: new Date(`${params.dateTo}T23:59:59`) } : {}),
          },
        }
      : {}),
  };

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
            telephoneVendeur: true,
            ville: { select: { nom: true } },
            quartier: { select: { nom: true } },
          },
        },
        client: { select: { nom: true } },
        commercial: { select: { nom: true, prenom: true } },
        origines: { select: { commercialNom: true, pointVenteNom: true, source: true, produitCode: true, nbSachets: true, nbFilets: true, montant: true, createdAt: true }, orderBy: { createdAt: "asc" } },
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
    AND: filtresRecherche(params),
    ...(params.villeId ? { pointVente: { villeId: params.villeId } } : {}),
    ...(params.commercialId ? { commercialId: params.commercialId } : {}),
    ...(params.binomeId ? { commercial: { binomeId: params.binomeId } } : {}),
    ...(params.dateFrom || params.dateTo
      ? {
          dateCommande: {
            ...(params.dateFrom ? { gte: new Date(params.dateFrom) } : {}),
            ...(params.dateTo ? { lte: new Date(`${params.dateTo}T23:59:59`) } : {}),
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
