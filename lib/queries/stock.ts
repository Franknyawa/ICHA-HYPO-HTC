import { prisma } from "@/lib/prisma";

export async function listStockAvecProduits() {
  const stocks = await prisma.stock.findMany({
    include: { produit: true },
    orderBy: { produit: { code: "asc" } },
  });

  return stocks.map((s) => ({
    id: s.id,
    produitId: s.produitId,
    produitCode: s.produit.code,
    produitNom: s.produit.nom,
    quantiteSachets: s.quantiteSachets,
    quantiteCartons: Math.floor(s.quantiteSachets / s.produit.sachetsParCarton),
    sachetsParCarton: s.produit.sachetsParCarton,
    seuilAlerte: s.seuilAlerte,
    prixCarton: Number(s.produit.prixCarton),
    coutCarton: s.produit.coutCarton === null ? null : Number(s.produit.coutCarton),
    enAlerte: s.quantiteSachets < s.seuilAlerte,
    updatedAt: s.updatedAt,
  }));
}

export async function getMouvementsRecents(produitId: string, limit = 10) {
  return prisma.mouvementStock.findMany({
    where: { produitId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export type CategorieMouvement = "ENTREE" | "VENTE" | "AVARIE" | "ECHANTILLON" | "GIFT" | "AJUSTEMENT";

export type FiltreMouvements = {
  du?: string;
  au?: string;
  produitId?: string;
  categorie?: CategorieMouvement;
  limit?: number;
};

function ouCategorie(c?: CategorieMouvement) {
  switch (c) {
    case "ENTREE":
      return { type: "ENTREE" as const };
    case "VENTE":
      return { referenceType: "VENTE" };
    case "AVARIE":
    case "ECHANTILLON":
    case "GIFT":
      return { referenceType: c };
    case "AJUSTEMENT":
      return { referenceType: "AJUSTEMENT_MANUEL" };
    default:
      return {};
  }
}

/**
 * Historique des mouvements de stock, tous produits confondus, avec filtres
 * (période, produit, catégorie) — sert à l'écran et à l'impression.
 * `resume` totalise les sorties hors vente (avaries, échantillons, gifts) sur
 * la même période, avec leur valeur au prix catalogue.
 */
export async function getMouvements(f: FiltreMouvements = {}) {
  const dates = {
    ...(f.du ? { gte: new Date(`${f.du}T00:00:00+01:00`) } : {}),
    ...(f.au ? { lte: new Date(`${f.au}T23:59:59.999+01:00`) } : {}),
  };
  const periode = f.du || f.au ? { createdAt: dates } : {};
  const where = {
    ...periode,
    ...(f.produitId ? { produitId: f.produitId } : {}),
    ...ouCategorie(f.categorie),
  };

  const [mouvements, total, groupes, produits] = await Promise.all([
    prisma.mouvementStock.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: Math.min(f.limit ?? 200, 2000),
      include: { produit: { select: { code: true, nom: true } } },
    }),
    prisma.mouvementStock.count({ where }),
    prisma.mouvementStock.groupBy({
      by: ["referenceType", "produitId"],
      where: { ...periode, referenceType: { in: ["AVARIE", "ECHANTILLON", "GIFT"] } },
      _sum: { quantiteSachets: true },
      _count: { _all: true },
    }),
    prisma.produit.findMany({ select: { id: true, sachetsParCarton: true, prixCarton: true } }),
  ]);

  const parProduit = new Map(produits.map((p) => [p.id, p]));
  const resume: Record<"AVARIE" | "ECHANTILLON" | "GIFT", { sachets: number; cartons: number; valeur: number; operations: number }> = {
    AVARIE: { sachets: 0, cartons: 0, valeur: 0, operations: 0 },
    ECHANTILLON: { sachets: 0, cartons: 0, valeur: 0, operations: 0 },
    GIFT: { sachets: 0, cartons: 0, valeur: 0, operations: 0 },
  };
  for (const g of groupes) {
    const cle = g.referenceType as keyof typeof resume;
    const p = parProduit.get(g.produitId);
    if (!resume[cle] || !p) continue;
    const sachets = g._sum.quantiteSachets ?? 0;
    resume[cle].sachets += sachets;
    resume[cle].cartons += sachets / p.sachetsParCarton;
    resume[cle].valeur += Math.round((sachets / p.sachetsParCarton) * Number(p.prixCarton));
    resume[cle].operations += g._count._all;
  }
  for (const k of Object.keys(resume) as (keyof typeof resume)[]) {
    resume[k].cartons = Math.round(resume[k].cartons * 100) / 100;
  }

  return {
    total,
    resume,
    data: mouvements.map((m) => ({
      id: m.id,
      type: m.type,
      quantiteSachets: m.quantiteSachets,
      referenceType: m.referenceType,
      note: m.note,
      createdAt: m.createdAt,
      produitCode: m.produit.code,
      produitNom: m.produit.nom,
    })),
  };
}
