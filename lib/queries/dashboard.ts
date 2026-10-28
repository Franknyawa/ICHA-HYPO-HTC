import { prisma } from "@/lib/prisma";
import { assurerMontantsConformes } from "@/lib/services/recalcul-prix";
import { valeurCatalogueLigne } from "@/lib/utils/tarifs";
import { cartonsEq, arrondiCartons, detailQte, SELECT_CONV, volLigne, volVide, volAjouter, type Vol } from "@/lib/utils/cartons-equiv";
import { repartirVente } from "@/lib/queries/rapports";
import { ajouterJours, debutJour, finJour, jourDouala } from "@/lib/utils/periode";

// « Aujourd'hui » = la journée du Cameroun (UTC+1), quel que soit le fuseau
// du serveur (Vercel tourne en UTC : sans cela, la journée commence à 1 h).
/** Livraison prévue un autre jour qu'aujourd'hui, pour une commande pas encore partie. */
function livraisonAVenir() {
  return {
    dateLivraisonPrevue: { gt: finJour(jourDouala()) },
    statut: { in: ["EN_ATTENTE", "EN_LIVRAISON"] as ("EN_ATTENTE" | "EN_LIVRAISON")[] },
  };
}

function todayRange() {
  const jour = jourDouala();
  return { gte: debutJour(jour), lte: finJour(jour) };
}

export async function getDashboardKpis() {
  await assurerMontantsConformes();
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
    // Prospects encore à travailler (hors convertis / abandonnés).
    prisma.prospect.count({ where: { statut: { in: ["NOUVEAU", "A_RELANCER"] } } }),
    // « Clients » = points de vente ayant au moins une commande validée.
    prisma.pointVente.count({
      where: { archivedAt: null, commandes: { some: { valideeAt: { not: null }, statut: { not: "ANNULEE" } } } },
    }),
  ]);

  // « Ventes » = commandes VALIDÉES aujourd'hui par l'admin (pas la prise de commande terrain).
  const validees = { valideeAt: today, statut: { in: ["EN_LIVRAISON", "LIVREE"] as ("EN_LIVRAISON" | "LIVREE")[] } };
  const [commandesValidees, commandesEnAttente, lignesValidees, indecisARelancer, livraisonsAVenir] = await Promise.all([
    prisma.commande.count({ where: validees }),
    prisma.commande.count({ where: { statut: "EN_ATTENTE", archivedAt: null, NOT: livraisonAVenir() } }),
    prisma.commandeLigne.findMany({
      where: { commande: validees },
      select: {
        nbSachets: true,
        nbFilets: true,
        nbCartons: true,
        produit: { select: { code: true, ...SELECT_CONV } },
      },
    }),
    prisma.prospectIndecis.count({ where: { statut: "A_RELANCER" } }),
    prisma.commande.count({ where: { archivedAt: null, ...livraisonAVenir() } }),
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
    indecisARelancer,
    clientsTotal,
    ventesAujourdhui: commandesValidees,
    commandesEnAttente,
    livraisonsAVenir,
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
  produits: { code: string; nom: string; detail: string; cartons: number; vol: Vol; montant: number }[];
}[];

/** Commandes à traiter (en attente) et validées non livrées (en livraison), cumulées par produit. */
export async function getCommandesEnCours(): Promise<BilanCommandesEnCours> {
  await assurerMontantsConformes();
  const commandes = await prisma.commande.findMany({
    where: { statut: { in: ["EN_ATTENTE", "EN_LIVRAISON"] }, archivedAt: null, NOT: livraisonAVenir() },
    select: {
      statut: true,
      montantTotal: true,
      lignes: {
        select: {
          nbSachets: true,
          nbFilets: true,
          nbCartons: true,
          montant: true,
          detail: true,
          produit: {
            select: { code: true, nom: true, sachetsParCarton: true, sachetsParFilet: true, filetsParCarton: true, prixSachet: true, prixFilet: true, prixCarton: true },
          },
        },
      },
    },
  });

  return (["EN_ATTENTE", "EN_LIVRAISON"] as const).map((statut) => {
    const liste = commandes.filter((c) => c.statut === statut);
    const parProduit = new Map<string, { code: string; nom: string; nbCartons: number; nbFilets: number; nbSachets: number; cartons: number; vol: Vol; montant: number }>();
    for (const c of liste) {
      const valeurs = c.lignes.map((l) => {
        const m = Number(l.montant);
        return m > 0
          ? m
          : valeurCatalogueLigne(l, l.produit);
      });
      const somme = valeurs.reduce((s, x) => s + x, 0);
      c.lignes.forEach((l, i) => {
        const g = parProduit.get(l.produit.code) ?? { code: l.produit.code, nom: l.produit.nom, nbCartons: 0, nbFilets: 0, nbSachets: 0, cartons: 0, vol: volVide(), montant: 0 };
        g.nbCartons += l.nbCartons;
        g.nbFilets += l.nbFilets;
        g.nbSachets += l.nbSachets;
        volAjouter(g.vol, volLigne(l, l.produit));
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
        vol: g.vol,
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

export type CartonsJour = {
  jour: string;
  hypo: number;
  htc: number;
  total: number;
  /** Ventes au détail : sachets et filets vendus à l'unité (par produit et au total). */
  hypoSd: number;
  hypoFd: number;
  htcSd: number;
  htcFd: number;
  detailSd: number;
  detailFd: number;
  /** Vente au détail en cartons équivalents (uniquement pour calculer la part du détail). */
  detailEq: number;
  commandes: number;
  montant: number;
};

/**
 * Cartons vendus par jour (commandes validées ce jour-là par l'admin), sur les `nbJours` derniers jours,
 * du plus récent au plus ancien. « Cartons » = ventes en cartons ; le détail (sachets / filets à l'unité) est compté à part.
 */
export async function getCartonsParJour(nbJours = 14): Promise<CartonsJour[]> {
  await assurerMontantsConformes();
  const aujourdhui = jourDouala();
  const premier = ajouterJours(aujourdhui, -(nbJours - 1));
  const commandes = await prisma.commande.findMany({
    where: {
      valideeAt: { gte: debutJour(premier), lte: finJour(aujourdhui) },
      statut: { in: ["EN_LIVRAISON", "LIVREE"] },
    },
    select: {
      valideeAt: true,
      montantTotal: true,
      lignes: { select: { nbSachets: true, nbFilets: true, nbCartons: true, detail: true, produit: { select: { code: true, ...SELECT_CONV } } } },
    },
  });

  const jours = new Map<string, CartonsJour>();
  for (let i = 0; i < nbJours; i++) {
    const j = ajouterJours(aujourdhui, -i);
    jours.set(j, { jour: j, hypo: 0, htc: 0, total: 0, hypoSd: 0, hypoFd: 0, htcSd: 0, htcFd: 0, detailSd: 0, detailFd: 0, detailEq: 0, commandes: 0, montant: 0 });
  }
  for (const c of commandes) {
    const g = jours.get(jourDouala(c.valideeAt!));
    if (!g) continue;
    g.commandes += 1;
    g.montant += Number(c.montantTotal);
    for (const l of c.lignes) {
      const v = volLigne(l, l.produit);
      // « Cartons » = ventes en cartons (gros) ; le détail est compté en sachets / filets à l'unité.
      g.total += v.gros;
      g.detailEq += v.detailEq;
      g.detailSd += v.sd;
      g.detailFd += v.fd;
      if (l.produit.code === "HYPO") {
        g.hypo += v.gros;
        g.hypoSd += v.sd;
        g.hypoFd += v.fd;
      } else if (l.produit.code === "HTC") {
        g.htc += v.gros;
        g.htcSd += v.sd;
        g.htcFd += v.fd;
      }
    }
  }
  return [...jours.values()].map((g) => ({
    ...g,
    hypo: arrondiCartons(g.hypo),
    htc: arrondiCartons(g.htc),
    total: arrondiCartons(g.total),
    detailEq: Math.round(g.detailEq * 100) / 100,
    montant: Math.round(g.montant),
  }));
}


export type LotValide = { nb: number; /** vendus en cartons */ cartons: number; /** vendus au détail (sachets / filets à l'unité) */ vol: Vol; montant: number };
export type BilanValidees = {
  /** Validées aujourd'hui (livrées ou non) : c'est le chiffre « Ventes validées ». */
  aujourdhui: LotValide;
  /** … dont déjà livrées aujourd'hui (stock sorti, encaissement ouvert). */
  livrees: LotValide;
  /** … dont encore à livrer. */
  aLivrer: LotValide;
  /** Validées un jour précédent et toujours à livrer. */
  avant: LotValide;
  /** Total « Validées, à livrer » = aLivrer + avant. */
  totalALivrer: LotValide;
};

/**
 * Réconcilie les validées du jour avec « Validées, à livrer » :
 * validées aujourd'hui = livrées + à livrer ; à livrer total = à livrer aujourd'hui + validées avant.
 */
export async function getBilanValidees(): Promise<BilanValidees> {
  await assurerMontantsConformes();
  const debut = debutJour(jourDouala());
  const commandes = await prisma.commande.findMany({
    where: {
      OR: [
        { valideeAt: { gte: debut }, statut: { in: ["EN_LIVRAISON", "LIVREE"] } },
        { statut: "EN_LIVRAISON", archivedAt: null },
      ],
    },
    select: {
      statut: true,
      valideeAt: true,
      montantTotal: true,
      lignes: { select: { nbSachets: true, nbFilets: true, nbCartons: true, detail: true, produit: { select: SELECT_CONV } } },
    },
  });
  const vide = (): LotValide => ({ nb: 0, cartons: 0, vol: volVide(), montant: 0 });
  const r = { aujourdhui: vide(), livrees: vide(), aLivrer: vide(), avant: vide(), totalALivrer: vide() };
  const ajoute = (lot: LotValide, vol: Vol, montant: number) => {
    lot.nb += 1;
    lot.cartons += vol.gros;
    volAjouter(lot.vol, vol);
    lot.montant += montant;
  };
  for (const c of commandes) {
    const cartons = c.lignes.reduce((a, l) => volAjouter(a, volLigne(l, l.produit)), volVide());
    const montant = Number(c.montantTotal);
    const aujourdhui = !!c.valideeAt && c.valideeAt >= debut;
    if (aujourdhui) {
      ajoute(r.aujourdhui, cartons, montant);
      ajoute(c.statut === "LIVREE" ? r.livrees : r.aLivrer, cartons, montant);
    } else {
      ajoute(r.avant, cartons, montant);
    }
    if (c.statut === "EN_LIVRAISON") ajoute(r.totalALivrer, cartons, montant);
  }
  for (const lot of Object.values(r)) {
    lot.cartons = arrondiCartons(lot.cartons);
    lot.montant = Math.round(lot.montant);
  }
  return r;
}


export type ProduitDuJour = {
  code: string;
  nom: string;
  commandes: number;
  /** Vendus en cartons (cartons entiers et demi-cartons), en cartons. */
  cartons: number;
  /** Vendus au détail : sachets et filets à l'unité. */
  sachetsDetail: number;
  filetsDetail: number;
  /** Détail en cartons équivalents (pour la part du détail uniquement). */
  detailEq: number;
  /** Valeur facturée de ce produit (montant des commandes réparti entre les lignes). */
  montant: number;
  /** Livré / à livrer, en nombre de commandes contenant ce produit. */
  livrees: number;
  aLivrer: number;
};

export type CommandesDuJour = {
  produits: ProduitDuJour[];
  total: {
    commandes: number;
    cartons: number;
    sachetsDetail: number;
    filetsDetail: number;
    detailEq: number;
    livrees: number;
    aLivrer: number;
    enAttente: number;
    /** Valeurs en FCFA */
    montant: number;
    montantLivrees: number;
    montantALivrer: number;
    montantEnAttente: number;
  };
};

/**
 * Commandes de la journée (validées aujourd'hui par l'admin), produit par produit :
 * cartons vendus en cartons, sachets et filets vendus à l'unité, et part de chacun.
 */
export async function getCommandesDuJour(): Promise<CommandesDuJour> {
  await assurerMontantsConformes();
  const jour = jourDouala();
  const [commandes, enAttente, enAttenteMontant] = await Promise.all([
    prisma.commande.findMany({
      where: { valideeAt: { gte: debutJour(jour), lte: finJour(jour) }, statut: { in: ["EN_LIVRAISON", "LIVREE"] } },
      select: {
        statut: true,
        montantTotal: true,
        lignes: {
          select: {
            nbSachets: true,
            nbFilets: true,
            nbCartons: true,
            detail: true,
            montant: true,
            produit: { select: { id: true, code: true, nom: true, gamme: true, prixSachet: true, prixFilet: true, prixCarton: true, ...SELECT_CONV } },
          },
        },
      },
    }),
    prisma.commande.count({ where: { statut: "EN_ATTENTE", archivedAt: null, NOT: livraisonAVenir() } }),
    prisma.commande.aggregate({ where: { statut: "EN_ATTENTE", archivedAt: null, NOT: livraisonAVenir() }, _sum: { montantTotal: true } }),
  ]);

  type Acc = ProduitDuJour & { vue: Set<number>; vuLivree: Set<number> };
  const map = new Map<string, Acc>();
  commandes.forEach((c, idx) => {
    const reparti = repartirVente({ montantTotal: c.montantTotal, lignes: c.lignes });
    for (const [i, l] of c.lignes.entries()) {
      const g =
        map.get(l.produit.code) ??
        { code: l.produit.code, nom: l.produit.nom, commandes: 0, cartons: 0, sachetsDetail: 0, filetsDetail: 0, detailEq: 0, montant: 0, livrees: 0, aLivrer: 0, vue: new Set<number>(), vuLivree: new Set<number>() };
      const v: Vol = volLigne(l, l.produit);
      g.cartons += v.gros;
      g.sachetsDetail += v.sd;
      g.filetsDetail += v.fd;
      g.detailEq += v.detailEq;
      g.montant += reparti.lignes[i]?.ca ?? 0;
      g.vue.add(idx);
      if (c.statut === "LIVREE") g.vuLivree.add(idx);
      map.set(l.produit.code, g);
    }
  });
  const produits: ProduitDuJour[] = [...map.values()]
    .sort((a, b) => a.code.localeCompare(b.code))
    .map((g) => ({
      code: g.code,
      nom: g.nom,
      commandes: g.vue.size,
      cartons: arrondiCartons(g.cartons),
      sachetsDetail: g.sachetsDetail,
      filetsDetail: g.filetsDetail,
      detailEq: Math.round(g.detailEq * 100) / 100,
      montant: Math.round(g.montant),
      livrees: g.vuLivree.size,
      aLivrer: g.vue.size - g.vuLivree.size,
    }));
  return {
    produits,
    total: {
      commandes: commandes.length,
      cartons: arrondiCartons(produits.reduce((s, p) => s + p.cartons, 0)),
      sachetsDetail: produits.reduce((s, p) => s + p.sachetsDetail, 0),
      filetsDetail: produits.reduce((s, p) => s + p.filetsDetail, 0),
      detailEq: Math.round(produits.reduce((s, p) => s + p.detailEq, 0) * 100) / 100,
      livrees: commandes.filter((c) => c.statut === "LIVREE").length,
      aLivrer: commandes.filter((c) => c.statut !== "LIVREE").length,
      enAttente,
      montant: commandes.reduce((s, c) => s + Number(c.montantTotal), 0),
      montantLivrees: commandes.filter((c) => c.statut === "LIVREE").reduce((s, c) => s + Number(c.montantTotal), 0),
      montantALivrer: commandes.filter((c) => c.statut !== "LIVREE").reduce((s, c) => s + Number(c.montantTotal), 0),
      montantEnAttente: Number(enAttenteMontant._sum.montantTotal ?? 0),
    },
  };
}
