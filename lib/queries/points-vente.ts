import { prisma } from "@/lib/prisma";
import { getPaginationParams, buildPaginatedResponse } from "@/lib/pagination";
import type { Prisma } from "@prisma/client";

export type ListPointsVenteParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  villeId?: string;
  quartierId?: string;
  typeId?: string;
  // Tri par nombre de commandes plutôt que par date de création — utile
  // pour repérer les points de vente les plus/moins actifs (demande de
  // Victor : filtre "par nombre de commandes").
  triCommandes?: "asc" | "desc";
};

export async function listPointsVente(params: ListPointsVenteParams) {
  const sp = new URLSearchParams();
  if (params.page) sp.set("page", String(params.page));
  if (params.pageSize) sp.set("pageSize", String(params.pageSize));
  const { page, pageSize, skip, take } = getPaginationParams(sp);

  const where: Prisma.PointVenteWhereInput = {
    ...(params.villeId ? { villeId: params.villeId } : {}),
    ...(params.quartierId ? { quartierId: params.quartierId } : {}),
    ...(params.typeId ? { typeId: params.typeId } : {}),
    ...(params.search
      ? {
          OR: [
            { nom: { contains: params.search, mode: "insensitive" } },
            { vendeur: { contains: params.search, mode: "insensitive" } },
            { repere: { contains: params.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const orderBy: Prisma.PointVenteOrderByWithRelationInput = params.triCommandes
    ? { commandes: { _count: params.triCommandes } }
    : { createdAt: "desc" };

  const [data, total] = await prisma.$transaction([
    prisma.pointVente.findMany({
      where,
      skip,
      take,
      orderBy,
      include: {
        ville: { select: { id: true, nom: true } },
        quartier: { select: { id: true, nom: true } },
        type: { select: { id: true, nom: true } },
        photos: { orderBy: { createdAt: "desc" }, take: 1 },
        _count: { select: { commandes: true } },
      },
    }),
    prisma.pointVente.count({ where }),
  ]);

  return buildPaginatedResponse(data, total, page, pageSize);
}

/**
 * Fiche détaillée d'un point de vente pour la page /admin/points-vente/[id]
 * (mêmes principes de calcul crédit que getClientDetail dans
 * lib/queries/clients.ts, appliqués au point de vente plutôt qu'au client).
 */
export async function getPointVenteDetail(id: string) {
  const pointVente = await prisma.pointVente.findUnique({
    where: { id },
    include: {
      ville: { select: { nom: true } },
      quartier: { select: { nom: true } },
      type: { select: { nom: true } },
      createdBy: { select: { nom: true, prenom: true } },
      ventes: {
        orderBy: { createdAt: "desc" },
        take: 30,
        select: {
          id: true,
          montantTotal: true,
          createdAt: true,
          commercial: { select: { nom: true, prenom: true } },
          client: { select: { nom: true } },
          lignes: {
            select: { nbSachets: true, nbFilets: true, nbCartons: true, produit: { select: { code: true } } },
          },
          paiements: { select: { montant: true, modePaiement: true } },
        },
      },
      commandes: {
        orderBy: { dateCommande: "desc" },
        take: 30,
        select: {
          id: true,
          statut: true,
          dateCommande: true,
          dateLivraisonPrevue: true,
          commercial: { select: { nom: true, prenom: true } },
          lignes: {
            select: { nbSachets: true, nbFilets: true, nbCartons: true, produit: { select: { code: true } } },
          },
        },
      },
      visites: {
        orderBy: { dateVisite: "desc" },
        take: 30,
        select: {
          id: true,
          dateVisite: true,
          observation: true,
          commercial: { select: { nom: true, prenom: true } },
        },
      },
      _count: { select: { visites: true, ventes: true, commandes: true } },
    },
  });
  if (!pointVente) return null;

  const resumeLignes = (lignes: { nbCartons: number; nbSachets: number; nbFilets: number; produit: { code: string } }[]) =>
    lignes
      .map((l) => {
        const qte = l.nbCartons > 0 ? `${l.nbCartons} cartons` : l.nbFilets > 0 ? `${l.nbFilets} filets` : `${l.nbSachets} sachets`;
        return `${l.produit.code} — ${qte}`;
      })
      .join(", ");

  const ventes = pointVente.ventes.map((v) => {
    const paye = v.paiements.reduce((s, p) => s + Number(p.montant), 0);
    const montantTotal = Number(v.montantTotal);
    return {
      id: v.id,
      createdAt: v.createdAt,
      commercialNom: `${v.commercial.prenom} ${v.commercial.nom}`,
      clientNom: v.client?.nom ?? null,
      produitsResume: resumeLignes(v.lignes) || "—",
      montantTotal,
      montantPaye: paye,
      montantDu: Math.max(0, montantTotal - paye),
    };
  });

  const commandes = pointVente.commandes.map((c) => ({
    id: c.id,
    statut: c.statut,
    dateCommande: c.dateCommande,
    dateLivraisonPrevue: c.dateLivraisonPrevue,
    commercialNom: `${c.commercial.prenom} ${c.commercial.nom}`,
    produitsResume: resumeLignes(c.lignes) || "—",
  }));

  const visites = pointVente.visites.map((v) => ({
    id: v.id,
    dateVisite: v.dateVisite,
    observation: v.observation,
    commercialNom: `${v.commercial.prenom} ${v.commercial.nom}`,
  }));

  const totalVenteFcfa = ventes.reduce((s, v) => s + v.montantTotal, 0);
  const resteAPayerFcfa = ventes.reduce((s, v) => s + v.montantDu, 0);

  return {
    id: pointVente.id,
    nom: pointVente.nom,
    vendeur: pointVente.vendeur,
    telephoneVendeur: pointVente.telephoneVendeur,
    telephonePatron: pointVente.telephonePatron,
    repere: pointVente.repere,
    latitude: pointVente.latitude,
    longitude: pointVente.longitude,
    presentoir: pointVente.presentoir,
    ville: pointVente.ville,
    quartier: pointVente.quartier,
    type: pointVente.type,
    createdBy: pointVente.createdBy,
    createdAt: pointVente.createdAt,
    nbVisites: pointVente._count.visites,
    totalVenteFcfa,
    resteAPayerFcfa,
    ventes,
    commandes,
    visites,
  };
}
