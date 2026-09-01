import { prisma } from "@/lib/prisma";

/**
 * Agrège les ventes d'une journée donnée dans VentesJournalieres, groupées
 * par (ville, commercial, binôme). Le montant n'étant pas ventilé par
 * produit sur les lignes de vente (seulement le total de la vente), on
 * n'agrège pas par produit ici — cohérent avec les requêtes dashboard/
 * rapports existantes, qui font le même choix.
 *
 * Idempotent : peut être relancé plusieurs fois pour la même date sans
 * créer de doublons (upsert sur la contrainte unique du modèle).
 */
export async function aggregateVentesDuJour(date: Date) {
  const debut = new Date(date);
  debut.setHours(0, 0, 0, 0);
  const fin = new Date(date);
  fin.setHours(23, 59, 59, 999);

  const ventes = await prisma.vente.findMany({
    where: { createdAt: { gte: debut, lte: fin } },
    select: {
      montantTotal: true,
      commercialId: true,
      commercial: { select: { binomeId: true } },
      pointVente: { select: { villeId: true } },
      lignes: { select: { nbCartons: true } },
    },
  });

  type Cle = string;
  const groupes = new Map<
    Cle,
    { villeId: string | null; commercialId: string; binomeId: string | null; cartons: number; montant: number }
  >();

  for (const v of ventes) {
    const villeId = v.pointVente.villeId;
    const binomeId = v.commercial.binomeId;
    const cle = `${villeId}|${v.commercialId}|${binomeId}`;
    const existant = groupes.get(cle) ?? {
      villeId,
      commercialId: v.commercialId,
      binomeId,
      cartons: 0,
      montant: 0,
    };
    existant.cartons += v.lignes.reduce((s, l) => s + l.nbCartons, 0);
    existant.montant += Number(v.montantTotal);
    groupes.set(cle, existant);
  }

  let nbLignesEcrites = 0;
  for (const g of groupes.values()) {
    await prisma.ventesJournalieres.upsert({
      where: {
        date_villeId_commercialId_binomeId_produitId: {
          date: debut,
          villeId: g.villeId,
          commercialId: g.commercialId,
          binomeId: g.binomeId,
          produitId: null,
        },
      },
      update: { cartonsVendus: g.cartons, montantTotal: g.montant },
      create: {
        date: debut,
        villeId: g.villeId,
        commercialId: g.commercialId,
        binomeId: g.binomeId,
        produitId: null,
        cartonsVendus: g.cartons,
        montantTotal: g.montant,
      },
    });
    nbLignesEcrites += 1;
  }

  return { date: debut, nbLignesEcrites };
}

/**
 * Agrège la performance de chaque binôme pour un mois donné
 * (periode = "YYYY-MM") dans PerformanceBinome. Recalculé chaque jour
 * pour rester à jour tout au long du mois en cours.
 *
 * Limitation connue : "nouveauxClients" est approximé par le nombre de
 * clients créés sur des points de vente eux-mêmes créés par un membre de
 * ce binôme durant la période — il n'existe pas de lien direct
 * client→binôme dans le schéma actuel.
 */
export async function aggregerPerformanceBinome(anneeMois: string) {
  const [annee, mois] = anneeMois.split("-").map(Number);
  const debut = new Date(annee, mois - 1, 1);
  const fin = new Date(annee, mois, 0, 23, 59, 59, 999);

  const binomes = await prisma.binome.findMany({ select: { id: true } });

  for (const b of binomes) {
    const membres = await prisma.user.findMany({
      where: { binomeId: b.id },
      select: { id: true },
    });
    const membreIds = membres.map((m) => m.id);

    const [lignesVente, visites, nouveauxClients] = await Promise.all([
      prisma.venteLigne.findMany({
        where: {
          vente: {
            commercialId: { in: membreIds },
            createdAt: { gte: debut, lte: fin },
          },
        },
        select: { nbCartons: true },
      }),
      prisma.visite.count({
        where: { binomeId: b.id, dateVisite: { gte: debut, lte: fin } },
      }),
      prisma.client.count({
        where: {
          createdAt: { gte: debut, lte: fin },
          pointVente: { createdById: { in: membreIds } },
        },
      }),
    ]);

    const cartonsVendus = lignesVente.reduce((s, l) => s + l.nbCartons, 0);

    await prisma.performanceBinome.upsert({
      where: { binomeId_periode: { binomeId: b.id, periode: anneeMois } },
      update: { cartonsVendus, visites, nouveauxClients },
      create: { binomeId: b.id, periode: anneeMois, cartonsVendus, visites, nouveauxClients },
    });
  }

  return { periode: anneeMois, nbBinomes: binomes.length };
}
