import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export type RapportFilters = {
  commercialId?: string;
  binomeId?: string;
  villeId?: string;
  quartierId?: string;
  typeId?: string;
  produitCode?: string;
  dateFrom?: string;
  dateTo?: string;
};

// Les 5 "catégories" de rapport demandées : mêmes filtres, même source de
// données (une seule requête Vente par appel), simplement regroupées ou
// listées différemment.
export type RapportVue = "commercial" | "point_vente" | "ville" | "quartier" | "vente";

export type RapportTotaux = {
  nbVentes: number;
  caTotal: number;
  cartonsHypo: number;
  cartonsHtc: number;
};

type BaseLigne = RapportTotaux & { cle: string };

export type RapportLigneCommercial = BaseLigne & {
  commercialNom: string;
  binomeNom: string | null;
};

export type RapportLignePointVente = BaseLigne & {
  pointVenteNom: string;
  villeNom: string;
  quartierNom: string | null;
};

export type RapportLigneVille = BaseLigne & {
  villeNom: string;
};

export type RapportLigneQuartier = BaseLigne & {
  quartierNom: string;
  villeNom: string;
};

export type RapportLigneVente = {
  cle: string;
  date: Date;
  commercialNom: string;
  pointVenteNom: string;
  villeNom: string;
  quartierNom: string | null;
  clientNom: string | null;
  produitsResume: string;
  caTotal: number;
};

export type RapportLigne =
  | RapportLigneCommercial
  | RapportLignePointVente
  | RapportLigneVille
  | RapportLigneQuartier
  | RapportLigneVente;

export type RapportResultat = {
  vue: RapportVue;
  totaux: RapportTotaux;
  lignes: RapportLigne[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number } | null;
};

function buildWhere(filters: RapportFilters): Prisma.VenteWhereInput {
  return {
    ...(filters.commercialId ? { commercialId: filters.commercialId } : {}),
    ...(filters.binomeId ? { commercial: { binomeId: filters.binomeId } } : {}),
    ...(filters.villeId || filters.quartierId || filters.typeId
      ? {
          pointVente: {
            ...(filters.villeId ? { villeId: filters.villeId } : {}),
            ...(filters.quartierId ? { quartierId: filters.quartierId } : {}),
            ...(filters.typeId ? { typeId: filters.typeId } : {}),
          },
        }
      : {}),
    ...(filters.produitCode
      ? { lignes: { some: { produit: { code: filters.produitCode } } } }
      : {}),
    ...(filters.dateFrom || filters.dateTo
      ? {
          createdAt: {
            ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
            ...(filters.dateTo ? { lte: new Date(`${filters.dateTo}T23:59:59`) } : {}),
          },
        }
      : {}),
  };
}

async function chargerVentesFiltrees(filters: RapportFilters) {
  return prisma.vente.findMany({
    where: buildWhere(filters),
    orderBy: { dateVente: "desc" },
    select: {
      id: true,
      dateVente: true,
      montantTotal: true,
      commercialId: true,
      commercial: {
        select: { nom: true, prenom: true, binome: { select: { nom: true } } },
      },
      pointVenteId: true,
      pointVente: {
        select: {
          nom: true,
          villeId: true,
          ville: { select: { nom: true } },
          quartierId: true,
          quartier: { select: { nom: true } },
        },
      },
      client: { select: { nom: true } },
      lignes: { select: { nbCartons: true, produit: { select: { code: true } } } },
    },
  });
}

type VenteChargee = Awaited<ReturnType<typeof chargerVentesFiltrees>>[number];

function cartonsParProduit(lignes: VenteChargee["lignes"]) {
  let hypo = 0;
  let htc = 0;
  for (const l of lignes) {
    if (l.produit.code === "HYPO") hypo += l.nbCartons;
    if (l.produit.code === "HTC") htc += l.nbCartons;
  }
  return { hypo, htc };
}

function cumulerLigne<T extends BaseLigne>(existing: T, v: VenteChargee): T {
  const { hypo, htc } = cartonsParProduit(v.lignes);
  return {
    ...existing,
    nbVentes: existing.nbVentes + 1,
    caTotal: existing.caTotal + Number(v.montantTotal),
    cartonsHypo: existing.cartonsHypo + hypo,
    cartonsHtc: existing.cartonsHtc + htc,
  };
}

const PAGE_SIZE_DETAIL = 30;

/**
 * Rapport unique, filtrable (commercial, binôme, ville, quartier, type de
 * point de vente, produit, période) et déclinable en 5 "vues" :
 *  - commercial / point_vente / ville / quartier : agrégats groupés
 *    (regroupement fait en mémoire, une seule requête Vente couvre tous
 *    les cas — le jeu de données d'un rapport terrain reste raisonnable)
 *  - vente : détail ligne par ligne (une ligne = une vente), paginé
 *
 * Les totaux (tuiles en haut de page) portent toujours sur l'intégralité
 * du filtre, quelle que soit la vue et quelle que soit la page affichée.
 */
export async function getRapport(
  filters: RapportFilters,
  vue: RapportVue = "commercial",
  page = 1
): Promise<RapportResultat> {
  const ventes = await chargerVentesFiltrees(filters);

  const totaux = ventes.reduce<RapportTotaux>(
    (acc, v) => {
      const { hypo, htc } = cartonsParProduit(v.lignes);
      return {
        nbVentes: acc.nbVentes + 1,
        caTotal: acc.caTotal + Number(v.montantTotal),
        cartonsHypo: acc.cartonsHypo + hypo,
        cartonsHtc: acc.cartonsHtc + htc,
      };
    },
    { nbVentes: 0, caTotal: 0, cartonsHypo: 0, cartonsHtc: 0 }
  );

  if (vue === "commercial") {
    const map = new Map<string, RapportLigneCommercial>();
    for (const v of ventes) {
      const key = v.commercialId;
      const base =
        map.get(key) ??
        ({
          cle: key,
          commercialNom: `${v.commercial.prenom} ${v.commercial.nom}`,
          binomeNom: v.commercial.binome?.nom ?? null,
          nbVentes: 0,
          caTotal: 0,
          cartonsHypo: 0,
          cartonsHtc: 0,
        } satisfies RapportLigneCommercial);
      map.set(key, cumulerLigne(base, v));
    }
    const lignes = [...map.values()].sort((a, b) => b.caTotal - a.caTotal);
    return { vue, totaux, lignes, pagination: null };
  }

  if (vue === "point_vente") {
    const map = new Map<string, RapportLignePointVente>();
    for (const v of ventes) {
      const key = v.pointVenteId;
      const base =
        map.get(key) ??
        ({
          cle: key,
          pointVenteNom: v.pointVente.nom,
          villeNom: v.pointVente.ville.nom,
          quartierNom: v.pointVente.quartier?.nom ?? null,
          nbVentes: 0,
          caTotal: 0,
          cartonsHypo: 0,
          cartonsHtc: 0,
        } satisfies RapportLignePointVente);
      map.set(key, cumulerLigne(base, v));
    }
    const lignes = [...map.values()].sort((a, b) => b.caTotal - a.caTotal);
    return { vue, totaux, lignes, pagination: null };
  }

  if (vue === "ville") {
    const map = new Map<string, RapportLigneVille>();
    for (const v of ventes) {
      const key = v.pointVente.villeId;
      const base =
        map.get(key) ??
        ({
          cle: key,
          villeNom: v.pointVente.ville.nom,
          nbVentes: 0,
          caTotal: 0,
          cartonsHypo: 0,
          cartonsHtc: 0,
        } satisfies RapportLigneVille);
      map.set(key, cumulerLigne(base, v));
    }
    const lignes = [...map.values()].sort((a, b) => b.caTotal - a.caTotal);
    return { vue, totaux, lignes, pagination: null };
  }

  if (vue === "quartier") {
    const map = new Map<string, RapportLigneQuartier>();
    for (const v of ventes) {
      const key = v.pointVente.quartierId ?? `sans-quartier-${v.pointVente.villeId}`;
      const base =
        map.get(key) ??
        ({
          cle: key,
          quartierNom: v.pointVente.quartier?.nom ?? "Sans quartier",
          villeNom: v.pointVente.ville.nom,
          nbVentes: 0,
          caTotal: 0,
          cartonsHypo: 0,
          cartonsHtc: 0,
        } satisfies RapportLigneQuartier);
      map.set(key, cumulerLigne(base, v));
    }
    const lignes = [...map.values()].sort((a, b) => b.caTotal - a.caTotal);
    return { vue, totaux, lignes, pagination: null };
  }

  // vue === "vente" : détail ligne par ligne, paginé en mémoire (la liste
  // filtrée est déjà chargée en une seule requête ci-dessus).
  const totalPages = Math.max(1, Math.ceil(ventes.length / PAGE_SIZE_DETAIL));
  const pageActuelle = Math.min(Math.max(1, page), totalPages);
  const debut = (pageActuelle - 1) * PAGE_SIZE_DETAIL;
  const sousEnsemble = ventes.slice(debut, debut + PAGE_SIZE_DETAIL);

  const lignes: RapportLigneVente[] = sousEnsemble.map((v) => {
    const { hypo, htc } = cartonsParProduit(v.lignes);
    const parts: string[] = [];
    if (hypo > 0) parts.push(`HYPO ${hypo}c`);
    if (htc > 0) parts.push(`HTC ${htc}c`);
    return {
      cle: v.id,
      date: v.dateVente,
      commercialNom: `${v.commercial.prenom} ${v.commercial.nom}`,
      pointVenteNom: v.pointVente.nom,
      villeNom: v.pointVente.ville.nom,
      quartierNom: v.pointVente.quartier?.nom ?? null,
      clientNom: v.client?.nom ?? null,
      produitsResume: parts.join(", ") || "—",
      caTotal: Number(v.montantTotal),
    };
  });

  return {
    vue,
    totaux,
    lignes,
    pagination: { page: pageActuelle, pageSize: PAGE_SIZE_DETAIL, total: ventes.length, totalPages },
  };
}
