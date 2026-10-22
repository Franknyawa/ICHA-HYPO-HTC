import { prisma } from "@/lib/prisma";

export type Canal = "ESPECES" | "MOBILE_MONEY" | "BANQUE";

/**
 * Toute commande enregistrée (vente du jour ou commande à livrer) est une
 * créance : elle reste « à encaisser » tant que l'admin n'a pas validé
 * l'argent rapporté par le superviseur.
 */
export type CreditAEncaisser = {
  /** Clé unique « VENTE:uuid » ou « COMMANDE:uuid ». */
  cle: string;
  type: "VENTE" | "COMMANDE";
  id: string;
  pointVenteNom: string;
  commercialNom: string;
  date: Date;
  montantTotal: number;
  paye: number;
  du: number;
  /** Mode annoncé par le commercial sur le terrain (indicatif). */
  modeAnnonce: string | null;
  /** Date de livraison prévue : c'est le jour où l'argent doit être encaissé. */
  dateLivraisonPrevue: Date | null;
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
  return mode === "MOBILE_MONEY" ? "MOBILE_MONEY" : mode === "BANQUE" ? "BANQUE" : "ESPECES";
}

const num = (x: unknown) => Number(x ?? 0);

type LigneCreance = {
  id: string;
  total: number;
  paye: number;
  mode: string | null;
  date: Date;
  livraison: Date | null;
  pv: string;
  prenom: string;
  nom: string;
};

/**
 * Créances : commandes VALIDÉES par l'admin (en livraison ou livrées) dont
 * le reste dû est > 0. Une seule requête SQL agrégée (pas de chargement de
 * toutes les commandes en mémoire) pour que la caisse et le tableau de bord
 * restent rapides.
 */
export async function getCreditsAEncaisser(): Promise<CreditAEncaisser[]> {
  const rows = await prisma.$queryRaw<LigneCreance[]>`
    SELECT c.id,
           (c.montant_total - COALESCE(av.credit, 0))::float8 AS total,
           (COALESCE(p.paye, 0) - COALESCE(rb.rembourse, 0))::float8 AS paye,
           c.mode_paiement::text AS mode,
           c.created_at AS date,
           c.date_livraison_prevue AS livraison,
           pv.nom AS pv,
           u.prenom AS prenom,
           u.nom AS nom
    FROM commandes c
    JOIN points_vente pv ON pv.id = c.point_vente_id
    JOIN users u ON u.id = c.commercial_id
    LEFT JOIN (
      SELECT commande_id, SUM(montant) AS paye
      FROM paiements
      WHERE commande_id IS NOT NULL
      GROUP BY commande_id
    ) p ON p.commande_id = c.id
    LEFT JOIN (
      SELECT commande_id, SUM(montant) AS credit
      FROM (
        SELECT commande_id, montant FROM factures_avoir
        UNION ALL
        -- un retour déjà accompagné d'un avoir ne compte qu'une fois
        SELECT fr.commande_id, fr.montant FROM factures_retour fr
        WHERE NOT EXISTS (SELECT 1 FROM factures_avoir fa WHERE fa.retour_id = fr.id)
      ) x
      GROUP BY commande_id
    ) av ON av.commande_id = c.id
    LEFT JOIN (
      SELECT x.commande_id, SUM(oc.montant) AS rembourse
      FROM operations_caisse oc
      JOIN (
        SELECT id, commande_id FROM factures_avoir
        UNION ALL
        SELECT id, commande_id FROM factures_retour
      ) x ON x.id = oc.reference_id
      WHERE oc.type::text = 'DEPENSE' AND oc.reference_type IN ('AVOIR', 'RETOUR')
      GROUP BY x.commande_id
    ) rb ON rb.commande_id = c.id
    WHERE c.statut IN ('EN_LIVRAISON', 'LIVREE')
      AND c.montant_total > 0
      AND c.montant_total - COALESCE(av.credit, 0) - (COALESCE(p.paye, 0) - COALESCE(rb.rembourse, 0)) > 0.5
    ORDER BY c.date_livraison_prevue ASC NULLS LAST, c.created_at ASC`;

  return rows.map((r) => ({
    cle: `COMMANDE:${r.id}`,
    type: "COMMANDE" as const,
    id: r.id,
    pointVenteNom: r.pv,
    commercialNom: `${r.prenom} ${r.nom}`,
    date: new Date(r.date),
    montantTotal: r.total,
    paye: r.paye,
    du: r.total - r.paye,
    modeAnnonce: r.mode,
    dateLivraisonPrevue: r.livraison ? new Date(r.livraison) : null,
  }));
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

  const [paiementsPeriode, paiementsTotal, opsPeriode, opsTotal, commandesValidees, avoirsPeriode, retoursPeriode, credits, stock] = await Promise.all([
    prisma.paiement.findMany({
      where: plage ? { datePaiement: plage } : {},
      select: {
        id: true,
        montant: true,
        modePaiement: true,
        estCredit: true,
        datePaiement: true,
        vente: { select: { pointVente: { select: { nom: true } } } },
        commande: { select: { pointVente: { select: { nom: true } } } },
      },
      orderBy: { datePaiement: "desc" },
    }),
    prisma.paiement.groupBy({ by: ["modePaiement"], _sum: { montant: true } }),
    prisma.operationCaisse.findMany({
      where: plage ? { dateOperation: plage } : {},
      orderBy: { dateOperation: "desc" },
    }),
    prisma.operationCaisse.groupBy({ by: ["type", "canal"], _sum: { montant: true } }),
    // Commandes validées par l'admin sur la période (chiffre facturé), et non
    // plus les « ventes » saisies par les commerciaux, qui incluent des
    // commandes pas encore validées.
    prisma.commande.aggregate({
      where: { statut: { in: ["EN_LIVRAISON", "LIVREE"] }, ...(plage ? { valideeAt: plage } : {}) },
      _sum: { montantTotal: true },
      _count: { _all: true },
    }),
    prisma.factureAvoir.aggregate({
      where: plage ? { createdAt: plage } : {},
      _sum: { montant: true },
      _count: { _all: true },
    }),
    prisma.factureRetour.aggregate({
      where: plage ? { createdAt: plage } : {},
      _sum: { montant: true },
      _count: { _all: true },
    }),
    getCreditsAEncaisser(),
    getStockValorise(),
  ]);

  // --- Période ---------------------------------------------------------
  const parCanalPeriode: Record<Canal, { entrees: number; sorties: number }> = {
    ESPECES: { entrees: 0, sorties: 0 },
    MOBILE_MONEY: { entrees: 0, sorties: 0 },
    BANQUE: { entrees: 0, sorties: 0 },
  };
  let encaissementsVentes = 0;
  let nbEncaissements = 0;
  for (const p of paiementsPeriode) {
    const m = num(p.montant);
    encaissementsVentes += m;
    if (m > 0) nbEncaissements += 1;
    parCanalPeriode[canalDe(p.modePaiement)].entrees += m;
  }
  let autresRecettes = 0;
  let depenses = 0;
  // Remboursements de clients générés par une facture d'avoir : de l'argent
  // qui sort, mais qui vient en déduction des recettes (pas une dépense).
  let remboursements = 0;
  for (const o of opsPeriode) {
    const m = num(o.montant);
    if (o.type === "RECETTE") {
      autresRecettes += m;
      parCanalPeriode[o.canal].entrees += m;
    } else if (o.referenceType === "AVOIR" || o.referenceType === "RETOUR") {
      remboursements += m;
      parCanalPeriode[o.canal].sorties += m;
    } else {
      depenses += m;
      parCanalPeriode[o.canal].sorties += m;
    }
  }
  const recettes = encaissementsVentes + autresRecettes - remboursements;

  // --- Cumul depuis le début (solde de caisse) -------------------------
  const solde: Record<Canal, number> = { ESPECES: 0, MOBILE_MONEY: 0, BANQUE: 0 };
  for (const g of paiementsTotal) solde[canalDe(g.modePaiement)] += num(g._sum.montant);
  for (const g of opsTotal) {
    const m = num(g._sum.montant);
    solde[g.canal] += g.type === "RECETTE" ? m : -m;
  }
  const soldeTotal = solde.ESPECES + solde.MOBILE_MONEY + solde.BANQUE;

  const journal: LigneJournal[] = [
    ...paiementsPeriode
      .filter((p) => num(p.montant) > 0)
      .map<LigneJournal>((p) => ({
        id: `p-${p.id}`,
        date: p.datePaiement,
        sens: "ENTREE",
        libelle: p.estCredit ? "Acompte" : "Encaissement validé",
        detail: p.vente?.pointVente.nom ?? p.commande?.pointVente.nom ?? "—",
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
      supprimable: o.referenceType !== "AVOIR" && o.referenceType !== "RETOUR",
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
    nbEncaissements,
    autresRecettes,
    remboursements,
    depenses,
    resultat: recettes - depenses,
    commandesValideesMontant: num(commandesValidees._sum.montantTotal),
    commandesValideesNombre: commandesValidees._count._all,
    avoirsMontant: num(avoirsPeriode._sum.montant) + num(retoursPeriode._sum.montant),
    avoirsNombre: avoirsPeriode._count._all + retoursPeriode._count._all,
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
    prisma.operationCaisse.groupBy({ by: ["type", "referenceType"], where: { dateOperation: plage }, _sum: { montant: true } }),
    getCreditsAEncaisser(),
    getStockValorise(),
  ]);
  const somme = (g: { type: string; _sum: { montant: unknown } }[], t: string) =>
    g.filter((x) => x.type === t).reduce((s, x) => s + num(x._sum.montant), 0);
  const remboursementsJour = oJour
    .filter((x) => x.type === "DEPENSE" && (x.referenceType === "AVOIR" || x.referenceType === "RETOUR"))
    .reduce((s, x) => s + num(x._sum.montant), 0);
  return {
    solde: num(pTotal._sum.montant) + somme(oTotal, "RECETTE") - somme(oTotal, "DEPENSE"),
    recettesJour: num(pJour._sum.montant) + somme(oJour, "RECETTE") - remboursementsJour,
    depensesJour: somme(oJour, "DEPENSE") - remboursementsJour,
    creditsTotal: credits.reduce((s, c) => s + c.du, 0),
    nbCredits: credits.length,
    stock,
    valeurStockVente: stock.reduce((s, l) => s + l.valeurVente, 0),
  };
}
