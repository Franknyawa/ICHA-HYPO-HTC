import { prisma } from "@/lib/prisma";
import { valeurCatalogueLigne } from "@/lib/utils/tarifs";
import { cartonsEq, arrondiCartons, detailQte, SELECT_CONV } from "@/lib/utils/cartons-equiv";
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
    // « Clients » = points de vente ayant au moins une commande validée.
    prisma.pointVente.count({
      where: { archivedAt: null, commandes: { some: { valideeAt: { not: null }, statut: { not: "ANNULEE" } } } },
    }),
  ]);

  // « Ventes » = commandes VALIDÉES aujourd'hui par l'admin (pas la prise de commande terrain).
  const validees = { valideeAt: today, statut: { in: ["EN_LIVRAISON", "LIVREE"] as ("EN_LIVRAISON" | "LIVREE")[] } };
  const [commandesValidees, commandesEnAttente, lignesValidees] = await Promise.all([
    prisma.commande.count({ where: validees }),
    prisma.commande.count({ where: { statut: "EN_ATTENTE", archivedAt: null } }),
    prisma.commandeLigne.findMany({
      where: { commande: validees },
      select: {
        nbSachets: true,
        nbFilets: true,
        nbCartons: true,
        produit: { select: { code: true, ...SELECT_CONV } },
      },
    }),
  ]);

  // « Chiffre d'affaires » = argent réellement encaissé aujourd'hui.
  const [paiementsAujourdhui, stocks] = await Promise.all([
    prisma.paiement.findMany({
      where: { datePaiement: today },
      select: { montant: true, estCredit: true },
    }),
    prisma.stock.findMany({
      include: { produit: { select: { code: true, sachetsParCarton: true } } },
    }),
  ]);

  const cartonsDe = (code: string) =>
    arrondiCartons(
      lignesValidees.filter((l) => l.produit.code === code).reduce((s, l) => s + cartonsEq(l, l.produit), 0)
    );
  const cartonsHypo = cartonsDe("HYPO");
  const cartonsHtc = cartonsDe("HTC");

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
    ventesAujourdhui: commandesValidees,
    commandesEnAttente,
    cartonsHypo,
    cartonsHtc,
    caAujourdhui: encaissements,
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

  const paiements = await prisma.paiement.findMany({
    where: { datePaiement: today, estCredit: false },
    select: {
      montant: true,
      commande: {
        select: {
          commercial: {
            select: { id: true, nom: true, prenom: true, binome: { select: { id: true, nom: true } } },
          },
        },
      },
      vente: {
        select: {
          commercial: {
            select: { id: true, nom: true, prenom: true, binome: { select: { id: true, nom: true } } },
          },
        },
      },
    },
  });

  const parBinome = new Map<string, number>();
  const parVendeur = new Map<string, { nom: string; montant: number }>();

  for (const p of paiements) {
    const commercial = p.commande?.commercial ?? p.vente?.commercial;
    if (!commercial) continue;
    const montant = Number(p.montant);
    const binomeNom = commercial.binome?.nom ?? "Sans binôme";
    parBinome.set(binomeNom, (parBinome.get(binomeNom) ?? 0) + montant);

    const vendeurNom = `${commercial.prenom} ${commercial.nom}`;
    const existing = parVendeur.get(commercial.id);
    parVendeur.set(commercial.id, { nom: vendeurNom, montant: (existing?.montant ?? 0) + montant });
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

export type BilanCommandesEnCours = {
  statut: "EN_ATTENTE" | "EN_LIVRAISON";
  nbCommandes: number;
  cartons: number;
  montant: number;
  produits: { code: string; nom: string; detail: string; cartons: number; montant: number }[];
}[];

/** Commandes à traiter (en attente) et validées non livrées (en livraison), cumulées par produit. */
export async function getCommandesEnCours(): Promise<BilanCommandesEnCours> {
  const commandes = await prisma.commande.findMany({
    where: { statut: { in: ["EN_ATTENTE", "EN_LIVRAISON"] }, archivedAt: null },
    select: {
      statut: true,
      montantTotal: true,
      lignes: {
        select: {
          nbSachets: true,
          nbFilets: true,
          nbCartons: true,
          montant: true,
          produit: {
            select: { code: true, nom: true, sachetsParCarton: true, sachetsParFilet: true, filetsParCarton: true, prixSachet: true, prixFilet: true, prixCarton: true },
          },
        },
      },
    },
  });

  return (["EN_ATTENTE", "EN_LIVRAISON"] as const).map((statut) => {
    const liste = commandes.filter((c) => c.statut === statut);
    const parProduit = new Map<string, { code: string; nom: string; nbCartons: number; nbFilets: number; nbSachets: number; cartons: number; montant: number }>();
    for (const c of liste) {
      const valeurs = c.lignes.map((l) => {
        const m = Number(l.montant);
        return m > 0
          ? m
          : valeurCatalogueLigne(l, l.produit);
      });
      const somme = valeurs.reduce((s, x) => s + x, 0);
      c.lignes.forEach((l, i) => {
        const g = parProduit.get(l.produit.code) ?? { code: l.produit.code, nom: l.produit.nom, nbCartons: 0, nbFilets: 0, nbSachets: 0, cartons: 0, montant: 0 };
        g.nbCartons += l.nbCartons;
        g.nbFilets += l.nbFilets;
        g.nbSachets += l.nbSachets;
        g.cartons += cartonsEq(l, l.produit);
        g.montant += somme > 0 ? (Number(c.montantTotal) * valeurs[i]) / somme : 0;
        parProduit.set(l.produit.code, g);
      });
    }
    const produits = [...parProduit.values()]
      .sort((a, b) => b.cartons - a.cartons)
      .map((g) => ({
        code: g.code,
        nom: g.nom,
        detail: detailQte(g),
        cartons: arrondiCartons(g.cartons),
        montant: Math.round(g.montant),
      }));
    return {
      statut,
      nbCommandes: liste.length,
      cartons: arrondiCartons(produits.reduce((s, p) => s + p.cartons, 0)),
      montant: produits.reduce((s, p) => s + p.montant, 0),
      produits,
    };
  });
}
