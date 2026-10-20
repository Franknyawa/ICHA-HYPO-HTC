import { prisma } from "@/lib/prisma";
import { ajouterJours, debutJour, finJour, jourDouala } from "@/lib/utils/periode";

// « Aujourd'hui » = la journée du Cameroun (UTC+1), quel que soit le fuseau
// du serveur (Vercel tourne en UTC : sans cela, la journée commence à 1 h).
function todayRange() {
  const jour = jourDouala();
  return { gte: debutJour(jour), lte: finJour(jour) };
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
    // « Clients » = points de vente ayant déjà acheté (vente ou commande non annulée).
    prisma.pointVente.count({
      where: { archivedAt: null, OR: [{ ventes: { some: {} } }, { commandes: { some: { statut: { not: "ANNULEE" } } } }] },
    }),
  ]);

  const [ventesAujourdhui, commandesEnAttente, lignesVenteAujourdhui] = await Promise.all([
    prisma.vente.count({ where: { createdAt: today } }),
    prisma.commande.count({ where: { statut: "EN_ATTENTE", archivedAt: null } }),
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
    where: { observation: { not: null }, NOT: { observation: "" } },
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


export type JourVisites = { jour: string; label: string; visites: number; pointsVisites: number };

/**
 * Activité terrain des N derniers jours : nombre de visites et nombre de
 * points de vente DIFFÉRENTS visités chaque jour (un point revu deux fois le
 * même jour compte une fois dans « points visités »).
 */
export async function getVisitesParJour(jours = 30) {
  const aujourdhui = jourDouala();
  const premier = ajouterJours(aujourdhui, -(jours - 1));
  const visites = await prisma.visite.findMany({
    where: { dateVisite: { gte: debutJour(premier), lte: finJour(aujourdhui) } },
    select: { dateVisite: true, pointVenteId: true, commercialId: true },
  });

  const parJour = new Map<string, { visites: number; points: Set<string> }>();
  for (let i = 0; i < jours; i++) parJour.set(ajouterJours(premier, i), { visites: 0, points: new Set() });
  for (const v of visites) {
    const j = jourDouala(v.dateVisite);
    const e = parJour.get(j);
    if (!e) continue;
    e.visites += 1;
    e.points.add(v.pointVenteId);
  }

  const serie: JourVisites[] = [...parJour.entries()].map(([jour, e]) => ({
    jour,
    label: new Date(`${jour}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", timeZone: "UTC" }),
    visites: e.visites,
    pointsVisites: e.points.size,
  }));

  // Détail du jour par commercial
  const commerciauxAujourdhui = new Map<string, Set<string>>();
  for (const v of visites) {
    if (jourDouala(v.dateVisite) !== aujourdhui) continue;
    const set = commerciauxAujourdhui.get(v.commercialId) ?? new Set<string>();
    set.add(v.pointVenteId);
    commerciauxAujourdhui.set(v.commercialId, set);
  }
  const ids = [...commerciauxAujourdhui.keys()];
  const users = ids.length
    ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, prenom: true, nom: true } })
    : [];
  const parCommercial = users
    .map((u) => ({ nom: `${u.prenom} ${u.nom}`, points: commerciauxAujourdhui.get(u.id)?.size ?? 0 }))
    .sort((a, b) => b.points - a.points);

  const moyenne7 = serie.slice(-7).reduce((s, j) => s + j.pointsVisites, 0) / 7;
  const total30 = serie.reduce((s, j) => s + j.pointsVisites, 0);

  return {
    serie,
    aujourdhui: serie[serie.length - 1],
    hier: serie[serie.length - 2],
    moyenne7: Math.round(moyenne7 * 10) / 10,
    total30,
    parCommercial,
  };
}

export type VisitesParJour = Awaited<ReturnType<typeof getVisitesParJour>>;
