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
