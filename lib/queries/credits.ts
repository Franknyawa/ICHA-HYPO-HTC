import { prisma } from "@/lib/prisma";

export type CreditDetail = {
  venteId: string;
  pointVenteNom: string;
  montantDu: number;
  dateVente: Date;
};

/**
 * Calcule le "reste à payer" pour un commercial : pour chaque vente,
 * montantTotal (valeur catalogue) moins la somme des paiements reçus.
 * N'inclut que les ventes où il reste effectivement quelque chose dû.
 */
export async function getCreditsCommercial(commercialId: string) {
  const ventes = await prisma.vente.findMany({
    where: { commercialId, paiements: { some: { estCredit: true } } },
    select: {
      id: true,
      montantTotal: true,
      createdAt: true,
      pointVente: { select: { nom: true } },
      paiements: { select: { montant: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const detail: CreditDetail[] = [];

  for (const v of ventes) {
    const totalPaye = v.paiements.reduce((s, p) => s + Number(p.montant), 0);
    const montantDu = Number(v.montantTotal) - totalPaye;
    if (montantDu > 0) {
      detail.push({
        venteId: v.id,
        pointVenteNom: v.pointVente.nom,
        montantDu,
        dateVente: v.createdAt,
      });
    }
  }

  const total = detail.reduce((s, d) => s + d.montantDu, 0);

  return { total, detail };
}
