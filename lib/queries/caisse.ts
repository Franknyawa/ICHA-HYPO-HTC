import { prisma } from "@/lib/prisma";

export type Canal = "ESPECES" | "MOBILE_MONEY";

export type CreditAEncaisser = {
  venteId: string;
  pointVenteNom: string;
  commercialNom: string;
  dateVente: Date;
  montantTotal: number;
  paye: number;
  du: number;
};

export type LigneJournal = {
  id: string;
  date: Date;
  sens: "ENTREE" | "SORTIE";
  libelle: string;
  detail: string;
  canal: Canal;
  montant: number;
  /** Opération manuelle supprimable (les paiements viennent des ventes et ne se suppriment pas ici). */
  supprimable: boolean;
};

export type LigneStock = {
  produitId: string;
  nom: string;
  code: string;
  cartons: number;
  prixCarton: number;
  coutCarton: number | null;
  valeurVente: number;
  valeurCout: number | null;
  seuilCartons: number;
};

function canalDe(mode: string): Canal {
  return mode === "MOBILE_MONEY" ? "MOBILE_MONEY" : "ESPECES";
}

const num = (x: unknown) => Number(x ?? 0);

/** Crédits restant dus (ventes avec crédit non soldées, hors règlements déjà validés par un admin). */
export async function getCreditsAEncaisser(): Promise<CreditAEncaisser[]> {
  const ventes = await prisma.vente.findMany({
    where: { paiements: { some: { estCredit: true } } },
    select: {
      id: true,
      montantTotal: true,
      createdAt: true,
      pointVente: { select: { nom: true } },
      commercial: { select: { prenom: true, nom: true } },
      paiements: { select: { montant: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  if (ventes.length === 0) return [];

  const alertes = await prisma.alerte.findMany({
    where: { type: "CREDIT_RETARD", entiteType: "Vente", entiteId: { in: ventes.map((v) => v.id) }, statut: "RESOLUE" },
    select: { entiteId: true },
  });
  const resolues = new Set(alertes.map((a) => a.entiteId));

  const liste: CreditAEncaisser[] = [];
  for (const v of ventes) {
    if (resolues.has(v.id)) continue;
    const paye = v.paiements.reduce((s, p) => s + num(p.montant), 0);
    const du = num(v.montantTotal) - paye;
    if (du > 0) {
      liste.push({
        venteId: v.id,
        pointVenteNom: v.pointVente.nom,
        commercialNom: `${v.commercial.prenom} ${v.commercial.nom}`,
        dateVente: v.createdAt,
        montantTotal: num(v.montantTotal),
        paye,
        du,
      });
    }
  }
  return liste;
}

/** Stock présent valorisé au prix de vente et au coût d'achat moyen. */
export async function getStockValorise(): Promise<LigneStock[]> {
  const stocks = await prisma.stock.findMany({
    include: { produit: true },
    orderBy: { produit: { nom: "asc" } },
  });
  return stocks.map((s) => {
    const cartons = s.quantiteSachets / s.produit.sachetsParCarton;
    const prixCarton = num(s.produit.prixCarton);
    const cout = s.produit.coutCarton === null ? null : num(s.produit.coutCarton);
    return {
      produitId: s.produitId,
      nom: s.produit.nom,
      code: s.produit.code,
      cartons: Math.floor(cartons),
      prixCarton,
      coutCarton: cout,
      valeurVente: Math.round(cartons * prixCarton),
      valeurCout: cout === null ? null : Math.round(cartons * cout),
      seuilCartons: Math.ceil(s.seuilAlerte / s.produit.sachetsParCarton),
    };
  });
}

export async function getCaisse(debut: Date | null, fin: Date | null) {
  const plage = debut && fin ? { gte: debut, lte: fin } : undefined;

  const [paiementsPeriode, paiementsTotal, opsPeriode, opsTotal, ventesPeriode, credits, stock] = await Promise.all([
    prisma.paiement.findMany({
      where: plage ? { datePaiement: plage } : {},
      select: {
        id: true,
        montant: true,
        modePaiement: true,
        estCredit: true,
        datePaiement: true,
        vente: { select: { pointVente: { select: { nom: true } } } },
      },
      orderBy: { datePaiement: "desc" },
    }),
    prisma.paiement.groupBy({ by: ["modePaiement"], _sum: { montant: true } }),
    prisma.operationCaisse.findMany({
      where: plage ? { dateOperation: plage } : {},
      orderBy: { dateOperation: "desc" },
    }),
    prisma.operationCaisse.groupBy({ by: ["type", "canal"], _sum: { montant: true } }),
    prisma.vente.aggregate({
      where: plage ? { dateVente: plage } : {},
      _sum: { montantTotal: true },
      _count: { _all: true },
    }),
    getCreditsAEncaisser(),
    getStockValorise(),
  ]);

  // --- Période ---------------------------------------------------------
  const parCanalPeriode: Record<Canal, { entrees: number; sorties: number }> = {
    ESPECES: { entrees: 0, sorties: 0 },
    MOBILE_MONEY: { entrees: 0, sorties: 0 },
  };
  let encaissementsVentes = 0;
  for (const p of paiementsPeriode) {
    const m = num(p.montant);
    encaissementsVentes += m;
    parCanalPeriode[canalDe(p.modePaiement)].entrees += m;
  }
  let autresRecettes = 0;
  let depenses = 0;
  for (const o of opsPeriode) {
    const m = num(o.montant);
    if (o.type === "RECETTE") {
      autresRecettes += m;
      parCanalPeriode[o.canal].entrees += m;
    } else {
      depenses += m;
      parCanalPeriode[o.canal].sorties += m;
    }
  }
  const recettes = encaissementsVentes + autresRecettes;

  // --- Cumul depuis le début (solde de caisse) -------------------------
  const solde: Record<Canal, number> = { ESPECES: 0, MOBILE_MONEY: 0 };
  for (const g of paiementsTotal) solde[canalDe(g.modePaiement)] += num(g._sum.montant);
  for (const g of opsTotal) {
    const m = num(g._sum.montant);
    solde[g.canal] += g.type === "RECETTE" ? m : -m;
  }
  const soldeTotal = solde.ESPECES + solde.MOBILE_MONEY;

  const journal: LigneJournal[] = [
    ...paiementsPeriode
      .filter((p) => num(p.montant) > 0)
      .map<LigneJournal>((p) => ({
        id: `p-${p.id}`,
        date: p.datePaiement,
        sens: "ENTREE",
        libelle: p.estCredit ? "Acompte de vente" : "Encaissement",
        detail: p.vente?.pointVente.nom ?? "—",
        canal: canalDe(p.modePaiement),
        montant: num(p.montant),
        supprimable: false,
      })),
    ...opsPeriode.map<LigneJournal>((o) => ({
      id: o.id,
      date: o.dateOperation,
      sens: o.type === "RECETTE" ? "ENTREE" : "SORTIE",
      libelle: o.categorie || (o.type === "RECETTE" ? "Autre recette" : "Dépense"),
      detail: o.note ?? "",
      canal: o.canal,
      montant: num(o.montant),
      supprimable: true,
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  const creditsTotal = credits.reduce((s, c) => s + c.du, 0);
  const valeurStockVente = stock.reduce((s, l) => s + l.valeurVente, 0);
  const valeurStockCout = stock.some((l) => l.valeurCout !== null)
    ? stock.reduce((s, l) => s + (l.valeurCout ?? 0), 0)
    : null;
  const cartonsEnStock = stock.reduce((s, l) => s + l.cartons, 0);

  return {
    recettes,
    encaissementsVentes,
    autresRecettes,
    depenses,
    resultat: recettes - depenses,
    ventesMontant: num(ventesPeriode._sum.montantTotal),
    ventesNombre: ventesPeriode._count._all,
    parCanalPeriode,
    solde,
    soldeTotal,
    credits,
    creditsTotal,
    stock,
    valeurStockVente,
    valeurStockCout,
    cartonsEnStock,
    journal: journal.slice(0, 80),
    journalComplet: journal.length,
  };
}

export type DonneesCaisse = Awaited<ReturnType<typeof getCaisse>>;

/** Version légère pour le tableau de bord : solde cumulé + mouvements du jour. */
export async function getCaisseResume(debut: Date, fin: Date) {
  const plage = { gte: debut, lte: fin };
  const [pTotal, oTotal, pJour, oJour, credits, stock] = await Promise.all([
    prisma.paiement.aggregate({ _sum: { montant: true } }),
    prisma.operationCaisse.groupBy({ by: ["type"], _sum: { montant: true } }),
    prisma.paiement.aggregate({ where: { datePaiement: plage }, _sum: { montant: true } }),
    prisma.operationCaisse.groupBy({ by: ["type"], where: { dateOperation: plage }, _sum: { montant: true } }),
    getCreditsAEncaisser(),
    getStockValorise(),
  ]);
  const somme = (g: { type: string; _sum: { montant: unknown } }[], t: string) =>
    num(g.find((x) => x.type === t)?._sum.montant);
  return {
    solde: num(pTotal._sum.montant) + somme(oTotal, "RECETTE") - somme(oTotal, "DEPENSE"),
    recettesJour: num(pJour._sum.montant) + somme(oJour, "RECETTE"),
    depensesJour: somme(oJour, "DEPENSE"),
    creditsTotal: credits.reduce((s, c) => s + c.du, 0),
    nbCredits: credits.length,
    stock,
    valeurStockVente: stock.reduce((s, l) => s + l.valeurVente, 0),
  };
}
