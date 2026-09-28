import { prisma } from "@/lib/prisma";

export type CreditDetail = {
  venteId: string;
  pointVenteNom: string;
  montantDu: number;
  dateVente: Date;
  // "declare" = le commercial a cliqué "Marquer réglé", en attente de
  // vérification par un admin — bouton désactivé côté client tant que
  // cet état dure.
  statutDeclaration: "AUCUNE" | "EN_ATTENTE_VERIFICATION";
};

/**
 * Calcule le "reste à payer" pour un commercial : pour chaque vente,
 * montantTotal (valeur catalogue) moins la somme des paiements reçus.
 * N'inclut que les ventes où il reste effectivement quelque chose dû.
 *
 * Un crédit dont la déclaration de règlement a été VALIDÉE par un admin
 * (Alerte CREDIT_RETARD au statut RESOLUE) est exclu de la liste même si
 * montantDu reste mathématiquement > 0 : aucun paiement réel n'a été
 * enregistré (§ choix produit — déclaration administrative, pas un vrai
 * encaissement), on considère juste ce crédit clos côté suivi.
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

  if (ventes.length === 0) return { total: 0, detail: [] as CreditDetail[] };

  const alertes = await prisma.alerte.findMany({
    where: { type: "CREDIT_RETARD", entiteType: "Vente", entiteId: { in: ventes.map((v) => v.id) } },
    select: { entiteId: true, statut: true },
  });
  const statutParVenteId = new Map(alertes.map((a) => [a.entiteId, a.statut]));

  const detail: CreditDetail[] = [];

  for (const v of ventes) {
    if (statutParVenteId.get(v.id) === "RESOLUE") continue;

    const totalPaye = v.paiements.reduce((s, p) => s + Number(p.montant), 0);
    const montantDu = Number(v.montantTotal) - totalPaye;
    if (montantDu > 0) {
      detail.push({
        venteId: v.id,
        pointVenteNom: v.pointVente.nom,
        montantDu,
        dateVente: v.createdAt,
        statutDeclaration:
          statutParVenteId.get(v.id) === "EN_ATTENTE_VERIFICATION" ? "EN_ATTENTE_VERIFICATION" : "AUCUNE",
      });
    }
  }

  const total = detail.reduce((s, d) => s + d.montantDu, 0);

  return { total, detail };
}
