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

export type RapportLigne = {
  commercialId: string;
  commercialNom: string;
  binomeNom: string | null;
  nbVentes: number;
  caTotal: number;
  cartonsHypo: number;
  cartonsHtc: number;
};

export async function getRapport(filters: RapportFilters) {
  const where: Prisma.VenteWhereInput = {
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

  const ventes = await prisma.vente.findMany({
    where,
    select: {
      id: true,
      montantTotal: true,
      commercialId: true,
      commercial: {
        select: { nom: true, prenom: true, binome: { select: { nom: true } } },
      },
      lignes: { select: { nbCartons: true, produit: { select: { code: true } } } },
    },
  });

  const parCommercial = new Map<string, RapportLigne>();

  for (const v of ventes) {
    const key = v.commercialId;
    const existing = parCommercial.get(key) ?? {
      commercialId: key,
      commercialNom: `${v.commercial.prenom} ${v.commercial.nom}`,
      binomeNom: v.commercial.binome?.nom ?? null,
      nbVentes: 0,
      caTotal: 0,
      cartonsHypo: 0,
      cartonsHtc: 0,
    };

    existing.nbVentes += 1;
    existing.caTotal += Number(v.montantTotal);
    for (const l of v.lignes) {
      if (l.produit.code === "HYPO") existing.cartonsHypo += l.nbCartons;
      if (l.produit.code === "HTC") existing.cartonsHtc += l.nbCartons;
    }

    parCommercial.set(key, existing);
  }

  const lignes = [...parCommercial.values()].sort((a, b) => b.caTotal - a.caTotal);

  const totaux = lignes.reduce(
    (acc, l) => ({
      nbVentes: acc.nbVentes + l.nbVentes,
      caTotal: acc.caTotal + l.caTotal,
      cartonsHypo: acc.cartonsHypo + l.cartonsHypo,
      cartonsHtc: acc.cartonsHtc + l.cartonsHtc,
    }),
    { nbVentes: 0, caTotal: 0, cartonsHypo: 0, cartonsHtc: 0 }
  );

  return { lignes, totaux };
}
