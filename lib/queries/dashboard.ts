import { prisma } from "@/lib/prisma";

function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { gte: start, lte: end };
}

export async function getDashboardKpis() {
  const today = todayRange();

  // Regroupées en 3 lots de 3 requêtes en parallèle (Promise.all), plutôt
  // que 9 requêtes strictement séquentielles ou 9 en parallèle d'un coup.
  // Nécessite connection_limit >= 3 dans DATABASE_URL — avec limit=1
  // (réglage précédent), ce lot repasserait de toute façon en file
  // d'attente côté Prisma, sans bénéfice ; avec limit=9+ d'un coup, on
  // recrée le risque de saturation du pool qu'on avait rencontré au
  // lancement. 3 est un compromis raisonnable pour le volume actuel.
  const [visitesAujourdhui, prospectsTotal, clientsTotal] = await Promise.all([
    prisma.visite.count({ where: { dateVisite: today } }),
    prisma.prospect.count(),
    prisma.client.count(),
  ]);

  const [ventesAujourdhui, commandesEnAttente, lignesVenteAujourdhui] = await Promise.all([
    prisma.vente.count({ where: { createdAt: today } }),
    prisma.commande.count({ where: { statut: "EN_ATTENTE" } }),
    prisma.venteLigne.findMany({
      where: { vente: { createdAt: today } },
      select: { nbCartons: true, produit: { select: { code: true } } },
    }),
  ]);

  const [caAujourdhui, paiementsAujourdhui, stocks] = await Promise.all([
    prisma.vente.aggregate({
      where: { createdAt: today },
      _sum: { montantTotal: true },
    }),
    prisma.paiement.findMany({
      where: { createdAt: today },
      select: { montant: true, estCredit: true },
    }),
    prisma.stock.findMany({
      include: { produit: { select: { code: true, sachetsParCarton: true } } },
    }),
  ]);

  const cartonsHypo = lignesVenteAujourdhui
    .filter((l) => l.produit.code === "HYPO")
    .reduce((s, l) => s + l.nbCartons, 0);
  const cartonsHtc = lignesVenteAujourdhui
    .filter((l) => l.produit.code === "HTC")
    .reduce((s, l) => s + l.nbCartons, 0);

  const encaissements = paiementsAujourdhui
    .filter((p) => !p.estCredit)
    .reduce((s, p) => s + Number(p.montant), 0);
  const credits = paiementsAujourdhui
    .filter((p) => p.estCredit)
    .reduce((s, p) => s + Number(p.montant), 0);

  const stockHypoStock = stocks.find((s) => s.produit.code === "HYPO");
  const stockHtcStock = stocks.find((s) => s.produit.code === "HTC");

  return {
    visitesAujourdhui,
    prospectsTotal,
    clientsTotal,
    ventesAujourdhui,
    commandesEnAttente,
    cartonsHypo,
    cartonsHtc,
    caAujourdhui: Number(caAujourdhui._sum.montantTotal ?? 0),
    encaissements,
    credits,
    stockHypoSachets: stockHypoStock?.quantiteSachets ?? 0,
    stockHypoCartons: stockHypoStock
      ? Math.floor(stockHypoStock.quantiteSachets / stockHypoStock.produit.sachetsParCarton)
      : 0,
    stockHtcSachets: stockHtcStock?.quantiteSachets ?? 0,
    stockHtcCartons: stockHtcStock
      ? Math.floor(stockHtcStock.quantiteSachets / stockHtcStock.produit.sachetsParCarton)
      : 0,
  };
}

export type DashboardKpis = Awaited<ReturnType<typeof getDashboardKpis>>;

export async function getCaParBinomeEtVendeur() {
  const today = todayRange();

  const ventes = await prisma.vente.findMany({
    where: { createdAt: today },
    select: {
      montantTotal: true,
      commercial: {
        select: {
          id: true,
          nom: true,
          prenom: true,
          binome: { select: { id: true, nom: true } },
        },
      },
    },
  });

  const parBinome = new Map<string, number>();
  const parVendeur = new Map<string, { nom: string; montant: number }>();

  for (const v of ventes) {
    const montant = Number(v.montantTotal);
    const binomeNom = v.commercial.binome?.nom ?? "Sans binôme";
    parBinome.set(binomeNom, (parBinome.get(binomeNom) ?? 0) + montant);

    const vendeurNom = `${v.commercial.prenom} ${v.commercial.nom}`;
    const existing = parVendeur.get(v.commercial.id);
    parVendeur.set(v.commercial.id, {
      nom: vendeurNom,
      montant: (existing?.montant ?? 0) + montant,
    });
  }

  return {
    parBinome: [...parBinome.entries()]
      .map(([nom, montant]) => ({ nom, montant }))
      .sort((a, b) => b.montant - a.montant),
    parVendeur: [...parVendeur.values()].sort((a, b) => b.montant - a.montant),
  };
}

export async function getObservationsRecentes(limit = 8) {
  return prisma.visite.findMany({
    where: { observation: { not: null } },
    orderBy: { dateVisite: "desc" },
    take: limit,
    select: {
      id: true,
      observation: true,
      dateVisite: true,
      commercial: { select: { nom: true, prenom: true } },
      pointVente: { select: { nom: true } },
    },
  });
}
