import { prisma } from "@/lib/prisma";
import { getPaginationParams, buildPaginatedResponse } from "@/lib/pagination";
import { Prisma } from "@prisma/client";

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
    archivedAt: null,
    ...(params.villeId ? { villeId: params.villeId } : {}),
    ...(params.quartierId ? { quartierId: params.quartierId } : {}),
    ...(params.typeId ? { OR: [{ typeId: params.typeId }, { typesIds: { has: params.typeId } }] } : {}),
    ...(params.search
      ? {
          AND: [{
          OR: [
            { nom: { contains: params.search, mode: "insensitive" } },
            { vendeur: { contains: params.search, mode: "insensitive" } },
            { repere: { contains: params.search, mode: "insensitive" } },
          ],
          }],
        }
      : {}),
  };

  const orderBy: Prisma.PointVenteOrderByWithRelationInput = params.triCommandes
    ? { commandes: { _count: params.triCommandes } }
    : { createdAt: "desc" };

  const [lignes, total] = await Promise.all([
    prisma.pointVente.findMany({
      relationLoadStrategy: "join",
      where,
      skip,
      take,
      orderBy,
      include: {
        ville: { select: { id: true, nom: true } },
        quartier: { select: { id: true, nom: true } },
        type: { select: { id: true, nom: true } },
        _count: { select: { commandes: true } },
      },
    }),
    prisma.pointVente.count({ where }),
  ]);

  // Dernière photo de chaque point de vente, en une requête. Une photo stockée
  // en data URL (ancien repli hors ligne, plusieurs centaines de Ko) n'est
  // jamais chargée dans la liste : elle est servie à part, mise en cache.
  const ids = lignes.map((l) => l.id);
  const photosBrutes = ids.length
    ? await prisma.$queryRaw<{ point_vente_id: string; id: string; url: string | null }[]>`
        SELECT DISTINCT ON (point_vente_id) point_vente_id, id,
               CASE WHEN url LIKE 'data:%' THEN NULL ELSE url END AS url
        FROM photos
        WHERE point_vente_id IN (${Prisma.join(ids)})
        ORDER BY point_vente_id, created_at DESC`
    : [];
  const photoParPv = new Map(photosBrutes.map((p) => [p.point_vente_id, { id: p.id, url: p.url ?? `/api/points-vente/photo/${p.id}` }]));
  const data = lignes.map((l) => ({ ...l, photos: photoParPv.has(l.id) ? [photoParPv.get(l.id)!] : [] }));

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
          montantTotal: true,
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
        const parts = [
          l.nbCartons > 0 ? `${l.nbCartons} carton${l.nbCartons > 1 ? "s" : ""}` : "",
          l.nbFilets > 0 ? `${l.nbFilets} filet${l.nbFilets > 1 ? "s" : ""}` : "",
          l.nbSachets > 0 ? `${l.nbSachets} sachet${l.nbSachets > 1 ? "s" : ""}` : "",
        ].filter(Boolean);
        return `${l.produit.code} — ${parts.join(" + ") || "0"}`;
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
    montantTotal: Number(c.montantTotal),
  }));

  const typesNoms = pointVente.typesIds.length
    ? (await prisma.typePointVente.findMany({ where: { id: { in: pointVente.typesIds } }, select: { id: true, nom: true } }))
        .sort((a, b) => pointVente.typesIds.indexOf(a.id) - pointVente.typesIds.indexOf(b.id))
        .map((t) => t.nom)
    : pointVente.type
      ? [pointVente.type.nom]
      : [];

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
    repondantRole: pointVente.repondantRole,
    repondantFonction: pointVente.repondantFonction,
    patronNom: pointVente.patronNom,
    typeAutre: pointVente.typeAutre,
    typesIds: pointVente.typesIds,
    archivedAt: pointVente.archivedAt,
    typesNoms: typesNoms,
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
