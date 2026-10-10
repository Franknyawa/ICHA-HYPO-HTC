import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { formatMontant } from "@/lib/utils/format";

// ---------------------------------------------------------------------------
// Rapports — même modèle que BELGRAVIA : 7 vues (commercial, point de vente,
// ville, quartier, détail des ventes, produit, historique 12 mois), mêmes
// filtres, aperçu détaillé imprimable par ligne.
//
// Indépendant des produits : aucune colonne « HYPO / HTC » en dur. Les produits
// (et leur gamme) viennent de la base ; une nouvelle gamme apparaît donc
// toute seule dans le filtre Gamme, la vue Produit et les aperçus.
//
// Tout le calcul métier (quantité en cartons, répartition du CA par produit)
// est regroupé dans les fonctions « cartonsEquivalents » et « repartirVente » :
// au moment de la refonte multi-catégories, seules ces deux fonctions et le
// chargement des ventes changeront.
// ---------------------------------------------------------------------------

export type RapportVue =
  | "commercial"
  | "point_vente"
  | "ville"
  | "quartier"
  | "vente"
  | "produit"
  | "historique";

export type RapportFilters = {
  commercialId?: string;
  binomeId?: string;
  villeId?: string;
  /** Texte libre : « contient » sur le nom du quartier */
  quartier?: string;
  typeId?: string;
  gamme?: string;
  produitCode?: string;
  dateFrom?: string;
  dateTo?: string;
};

export type Mesures = {
  pointsVente: number;
  visites: number;
  commandes: number;
  nbVentes: number;
  cartons: number;
  ca: number;
  reste: number;
};

export type RapportTableau = {
  vue: RapportVue;
  colonnes: string[];
  /** Nombre de colonnes de texte au début (le reste est numérique, aligné à droite) */
  nbColsTexte: number;
  lignes: { cle: string; cellules: string[]; brut: (string | number)[] }[];
  total?: { cellules: string[]; brut: (string | number)[] };
  totaux: Mesures;
  pagination: { page: number; pageSize: number; total: number; totalPages: number } | null;
};

export type ApercuRapport = {
  titre: string;
  sousTitre: string;
  mesures: Mesures;
  produits: {
    code: string;
    nom: string;
    gamme: string;
    quantites: string;
    cartons: number;
    ca: number;
    part: number;
  }[];
  ventes: {
    id: string;
    date: string;
    commercial: string;
    pointVente: string;
    ville: string;
    client: string | null;
    cartons: number;
    ca: number;
    paye: number;
    reste: number;
  }[];
  ventesTronquees: boolean;
};

export const SANS_GAMME = "Sans gamme";
const TAILLE_PAGE_DETAIL = 30;
const MAX_VENTES_APERCU = 150;

// ---------------------------------------------------------------------------
// Utilitaires de calcul
// ---------------------------------------------------------------------------

function arrondi(n: number, d = 2) {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

export function formatQte(n: number): string {
  const r = arrondi(n, 1);
  return Number.isInteger(r) ? String(r) : String(r).replace(".", ",");
}

function formatPct(x: number): string {
  const r = Math.round(x * 10) / 10;
  return `${Number.isInteger(r) ? r : String(r).replace(".", ",")} %`;
}

const fcfa = (n: number) => `${formatMontant(n)} FCFA`;

type ProduitCalc = {
  sachetsParCarton: number;
  filetsParCarton: number | null;
  prixSachet: unknown;
  prixFilet: unknown;
  prixCarton: unknown;
};

/** Quantité d'une ligne exprimée en cartons (sachets et filets convertis). */
export function cartonsEquivalents(
  l: { nbSachets: number; nbFilets: number; nbCartons: number },
  p: ProduitCalc
): number {
  const dep = p.filetsParCarton && p.filetsParCarton > 0 ? l.nbFilets / p.filetsParCarton : 0;
  const sac = p.sachetsParCarton > 0 ? l.nbSachets / p.sachetsParCarton : 0;
  return l.nbCartons + dep + sac;
}

function valeurCatalogue(
  l: { nbSachets: number; nbFilets: number; nbCartons: number },
  p: ProduitCalc
): number {
  return (
    l.nbCartons * Number(p.prixCarton) +
    l.nbFilets * Number(p.prixFilet ?? 0) +
    l.nbSachets * Number(p.prixSachet)
  );
}

// ---------------------------------------------------------------------------
// Chargement
// ---------------------------------------------------------------------------

function bornes(filters: RapportFilters) {
  const gte = filters.dateFrom ? new Date(`${filters.dateFrom}T00:00:00`) : undefined;
  const lte = filters.dateTo ? new Date(`${filters.dateTo}T23:59:59.999`) : undefined;
  return { gte, lte };
}

function plageDates(filters: RapportFilters) {
  const { gte, lte } = bornes(filters);
  return gte || lte ? { ...(gte ? { gte } : {}), ...(lte ? { lte } : {}) } : undefined;
}

function filtreProduit(filters: RapportFilters): Prisma.ProduitWhereInput | undefined {
  const w: Prisma.ProduitWhereInput = {
    ...(filters.produitCode ? { code: filters.produitCode } : {}),
    ...(filters.gamme ? { gamme: filters.gamme === SANS_GAMME ? null : filters.gamme } : {}),
  };
  return Object.keys(w).length ? w : undefined;
}

function filtrePointVente(filters: RapportFilters): Prisma.PointVenteWhereInput | undefined {
  const w: Prisma.PointVenteWhereInput = {
    ...(filters.villeId ? { villeId: filters.villeId } : {}),
    ...(filters.typeId ? { typeId: filters.typeId } : {}),
    ...(filters.quartier
      ? { quartier: { nom: { contains: filters.quartier, mode: "insensitive" } } }
      : {}),
  };
  return Object.keys(w).length ? w : undefined;
}

const SELECT_PV = {
  id: true,
  nom: true,
  villeId: true,
  ville: { select: { nom: true } },
  quartierId: true,
  quartier: { select: { nom: true } },
} satisfies Prisma.PointVenteSelect;

async function chargerVentes(filters: RapportFilters) {
  const produitWhere = filtreProduit(filters);
  return prisma.vente.findMany({
    where: {
      ...(filters.commercialId ? { commercialId: filters.commercialId } : {}),
      ...(filters.binomeId ? { commercial: { binomeId: filters.binomeId } } : {}),
      ...(filtrePointVente(filters) ? { pointVente: filtrePointVente(filters) } : {}),
      ...(produitWhere ? { lignes: { some: { produit: produitWhere } } } : {}),
      ...(plageDates(filters) ? { dateVente: plageDates(filters) } : {}),
    },
    orderBy: { dateVente: "desc" },
    select: {
      id: true,
      dateVente: true,
      montantTotal: true,
      commercialId: true,
      commercial: { select: { nom: true, prenom: true, binome: { select: { nom: true } } } },
      pointVenteId: true,
      pointVente: { select: SELECT_PV },
      client: { select: { nom: true } },
      lignes: {
        select: {
          nbSachets: true,
          nbFilets: true,
          nbCartons: true,
          montant: true,
          produit: {
            select: {
              id: true,
              code: true,
              nom: true,
              gamme: true,
              sachetsParCarton: true,
              filetsParCarton: true,
              prixSachet: true,
              prixFilet: true,
              prixCarton: true,
            },
          },
        },
      },
      paiements: { select: { montant: true } },
    },
  });
}

type VenteChargee = Awaited<ReturnType<typeof chargerVentes>>[number];

// ---------------------------------------------------------------------------
// Répartition du CA d'une vente entre ses lignes
// ---------------------------------------------------------------------------
// Le montant n'est enregistré que pour la vente entière (montantTotal). Pour
// obtenir un CA par produit qui retombe exactement sur le total, on répartit
// montantTotal au prorata de la valeur de chaque ligne (montant de ligne s'il
// existe, sinon valeur au prix catalogue). Même logique pour le reste à payer.

export type LigneRepartie = {
  produitId: string;
  code: string;
  nom: string;
  gamme: string;
  nbSachets: number;
  nbFilets: number;
  nbCartons: number;
  cartons: number;
  ca: number;
  reste: number;
};

/** Forme minimale d'une vente pour répartir son CA (utilisée aussi par le tableau de bord). */
export type VenteRepartissable = {
  montantTotal: unknown;
  lignes: {
    nbSachets: number;
    nbFilets: number;
    nbCartons: number;
    montant: unknown;
    produit: ProduitCalc & { id: string; code: string; nom: string; gamme: string | null };
  }[];
  paiements?: { montant: unknown }[];
};

export function repartirVente(v: VenteRepartissable): { lignes: LigneRepartie[]; paye: number; resteVente: number } {
  const total = Number(v.montantTotal);
  const paye = (v.paiements ?? []).reduce((s, p) => s + Number(p.montant), 0);
  const resteVente = Math.max(0, total - paye);

  const poids = v.lignes.map((l) => {
    const m = Number(l.montant);
    return m > 0 ? m : valeurCatalogue(l, l.produit);
  });
  let somme = poids.reduce((s, x) => s + x, 0);
  let ws = poids;
  if (somme <= 0) {
    // Aucun prix exploitable : on répartit à parts égales entre les lignes.
    ws = v.lignes.map(() => 1);
    somme = ws.length || 1;
  }

  const lignes = v.lignes.map((l, i) => ({
    produitId: l.produit.id,
    code: l.produit.code,
    nom: l.produit.nom,
    gamme: l.produit.gamme ?? SANS_GAMME,
    nbSachets: l.nbSachets,
    nbFilets: l.nbFilets,
    nbCartons: l.nbCartons,
    cartons: cartonsEquivalents(l, l.produit),
    ca: (total * ws[i]) / somme,
    reste: (resteVente * ws[i]) / somme,
  }));
  return { lignes, paye, resteVente };
}

function ligneRetenue(l: LigneRepartie, filters: RapportFilters) {
  if (filters.produitCode && l.code !== filters.produitCode) return false;
  if (filters.gamme && l.gamme !== filters.gamme) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Événements (ventes, visites, commandes, points de vente créés) normalisés
// ---------------------------------------------------------------------------

type Evt = {
  type: "vente" | "visite" | "commande" | "pv";
  date: Date;
  commercialId: string;
  commercialNom: string;
  binomeNom: string | null;
  pvId: string | null;
  pvNom: string;
  villeId: string;
  villeNom: string;
  quartierId: string | null;
  quartierNom: string | null;
  // ventes uniquement
  venteId?: string;
  ca?: number;
  reste?: number;
  cartons?: number;
};

function moisDe(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

async function chargerEvenements(filters: RapportFilters) {
  const pvWhere = filtrePointVente(filters);
  const dates = plageDates(filters);
  const produitWhere = filtreProduit(filters);

  const [ventes, visites, commandes, pvs] = await Promise.all([
    chargerVentes(filters),
    prisma.visite.findMany({
      where: {
        ...(filters.commercialId ? { commercialId: filters.commercialId } : {}),
        ...(filters.binomeId ? { binomeId: filters.binomeId } : {}),
        ...(pvWhere ? { pointVente: pvWhere } : {}),
        ...(dates ? { dateVisite: dates } : {}),
      },
      select: {
        dateVisite: true,
        commercialId: true,
        commercial: { select: { nom: true, prenom: true, binome: { select: { nom: true } } } },
        pointVenteId: true,
        pointVente: { select: SELECT_PV },
      },
    }),
    prisma.commande.findMany({
      where: {
        ...(filters.commercialId ? { commercialId: filters.commercialId } : {}),
        ...(filters.binomeId ? { commercial: { binomeId: filters.binomeId } } : {}),
        ...(pvWhere ? { pointVente: pvWhere } : {}),
        ...(produitWhere ? { lignes: { some: { produit: produitWhere } } } : {}),
        ...(dates ? { dateCommande: dates } : {}),
      },
      select: {
        dateCommande: true,
        commercialId: true,
        commercial: { select: { nom: true, prenom: true, binome: { select: { nom: true } } } },
        pointVenteId: true,
        pointVente: { select: SELECT_PV },
      },
    }),
    prisma.pointVente.findMany({
      where: {
        ...(filters.commercialId ? { createdById: filters.commercialId } : {}),
        ...(filters.binomeId ? { createdBy: { binomeId: filters.binomeId } } : {}),
        ...(pvWhere ?? {}),
        ...(dates ? { createdAt: dates } : {}),
      },
      select: {
        ...SELECT_PV,
        createdAt: true,
        createdById: true,
        createdBy: { select: { nom: true, prenom: true, binome: { select: { nom: true } } } },
      },
    }),
  ]);

  const evts: Evt[] = [];

  for (const v of ventes) {
    const { lignes } = repartirVente(v);
    const retenues = lignes.filter((l) => ligneRetenue(l, filters));
    const ca = retenues.reduce((s, l) => s + l.ca, 0);
    const reste = retenues.reduce((s, l) => s + l.reste, 0);
    const cartons = retenues.reduce((s, l) => s + l.cartons, 0);
    evts.push({
      type: "vente",
      date: v.dateVente,
      commercialId: v.commercialId,
      commercialNom: `${v.commercial.prenom} ${v.commercial.nom}`,
      binomeNom: v.commercial.binome?.nom ?? null,
      pvId: v.pointVenteId,
      pvNom: v.pointVente.nom,
      villeId: v.pointVente.villeId,
      villeNom: v.pointVente.ville.nom,
      quartierId: v.pointVente.quartierId,
      quartierNom: v.pointVente.quartier?.nom ?? null,
      venteId: v.id,
      ca,
      reste,
      cartons,
    });
  }

  const base = (
    type: Evt["type"],
    date: Date,
    commercialId: string,
    c: { nom: string; prenom: string; binome: { nom: string } | null },
    pv: { id: string; nom: string; villeId: string; ville: { nom: string }; quartierId: string | null; quartier: { nom: string } | null }
  ): Evt => ({
    type,
    date,
    commercialId,
    commercialNom: `${c.prenom} ${c.nom}`,
    binomeNom: c.binome?.nom ?? null,
    pvId: pv.id,
    pvNom: pv.nom,
    villeId: pv.villeId,
    villeNom: pv.ville.nom,
    quartierId: pv.quartierId,
    quartierNom: pv.quartier?.nom ?? null,
  });

  for (const x of visites) evts.push(base("visite", x.dateVisite, x.commercialId, x.commercial, x.pointVente));
  for (const x of commandes) evts.push(base("commande", x.dateCommande, x.commercialId, x.commercial, x.pointVente));
  for (const p of pvs) evts.push(base("pv", p.createdAt, p.createdById, p.createdBy, p));

  return { evts, ventes };
}

// ---------------------------------------------------------------------------
// Regroupement par vue
// ---------------------------------------------------------------------------

type Cle = { cle: string; libelle: string; sous?: string };

function cleDe(vue: RapportVue, e: Evt): Cle | null {
  switch (vue) {
    case "commercial":
      return { cle: e.commercialId, libelle: e.commercialNom, sous: e.binomeNom ?? undefined };
    case "point_vente":
      return e.pvId ? { cle: e.pvId, libelle: e.pvNom, sous: `${e.villeNom}${e.quartierNom ? ` · ${e.quartierNom}` : ""}` } : null;
    case "ville":
      return { cle: e.villeId, libelle: e.villeNom };
    case "quartier":
      return {
        cle: e.quartierId ?? `sans-quartier-${e.villeId}`,
        libelle: e.quartierNom ?? "Sans quartier",
        sous: e.villeNom,
      };
    case "historique": {
      const m = moisDe(e.date);
      return { cle: m, libelle: m };
    }
    default:
      return null;
  }
}

function vide(): Mesures {
  return { pointsVente: 0, visites: 0, commandes: 0, nbVentes: 0, cartons: 0, ca: 0, reste: 0 };
}

function cumuler(m: Mesures, e: Evt) {
  if (e.type === "vente") {
    m.nbVentes += 1;
    m.ca += e.ca ?? 0;
    m.reste += e.reste ?? 0;
    m.cartons += e.cartons ?? 0;
  } else if (e.type === "visite") m.visites += 1;
  else if (e.type === "commande") m.commandes += 1;
  else m.pointsVente += 1;
}

const MOIS_FR = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
function libelleMois(cle: string) {
  const [a, m] = cle.split("-");
  return `${MOIS_FR[Number(m) - 1]} ${a}`;
}

function douzeDerniersMois(): string[] {
  const out: string[] = [];
  const d = new Date();
  d.setDate(1);
  for (let i = 0; i < 12; i++) {
    out.push(moisDe(d));
    d.setMonth(d.getMonth() - 1);
  }
  return out; // du plus récent au plus ancien
}

function filtresHistorique(filters: RapportFilters): RapportFilters {
  const mois = douzeDerniersMois();
  const [a, m] = mois[mois.length - 1].split("-");
  return { ...filters, dateFrom: `${a}-${m}-01`, dateTo: undefined };
}

function ligneMesures(m: Mesures, totalCa: number, avecCompteurs: boolean) {
  const part = totalCa > 0 ? (m.ca / totalCa) * 100 : 0;
  const cells = avecCompteurs
    ? [String(m.pointsVente), String(m.visites), String(m.commandes)]
    : [];
  const brut: number[] = avecCompteurs ? [m.pointsVente, m.visites, m.commandes] : [];
  return {
    cells: [...cells, formatQte(m.cartons), fcfa(m.ca), formatPct(part), fcfa(m.reste)],
    brut: [...brut, arrondi(m.cartons), Math.round(m.ca), arrondi(part, 1), Math.round(m.reste)],
  };
}

const COLS_MESURES = ["Points de vente recensés", "Visites", "Commandes", "Cartons vendus", "Chiffre d'affaires", "% du CA", "Reste à payer"];
const COLS_MESURES_PRODUIT = ["Ventes", "Cartons vendus", "Chiffre d'affaires", "% du CA", "Reste à payer"];

function totalMesures(evts: Evt[]): Mesures {
  const t = vide();
  for (const e of evts) cumuler(t, e);
  return t;
}

/**
 * Rapport complet (une vue) : tableau déjà formaté en texte — le même pour
 * l'écran, le PDF et l'export Excel — plus les totaux des tuiles.
 */
export async function getRapport(
  filtersBrut: RapportFilters,
  vue: RapportVue = "commercial",
  page = 1
): Promise<RapportTableau> {
  const filters = vue === "historique" ? filtresHistorique(filtersBrut) : filtersBrut;

  if (vue === "produit") return rapportProduit(filters);

  const { evts, ventes } = await chargerEvenements(filters);
  const totaux = totalMesures(evts);

  if (vue === "vente") {
    const totalPages = Math.max(1, Math.ceil(ventes.length / TAILLE_PAGE_DETAIL));
    const p = Math.min(Math.max(1, page), totalPages);
    const tranche = ventes.slice((p - 1) * TAILLE_PAGE_DETAIL, p * TAILLE_PAGE_DETAIL);
    const lignes = tranche.map((v) => {
      const r = repartirVente(v);
      const retenues = r.lignes.filter((l) => ligneRetenue(l, filters));
      const cartons = retenues.reduce((s, l) => s + l.cartons, 0);
      const ca = retenues.reduce((s, l) => s + l.ca, 0);
      const reste = retenues.reduce((s, l) => s + l.reste, 0);
      const resume =
        retenues
          .filter((l) => l.cartons > 0)
          .map((l) => `${l.code} ${formatQte(l.cartons)}c`)
          .join(", ") || "—";
      const date = v.dateVente.toLocaleDateString("fr-FR");
      const com = `${v.commercial.prenom} ${v.commercial.nom}`;
      return {
        cle: v.id,
        cellules: [date, com, v.pointVente.nom, v.pointVente.ville.nom, resume, formatQte(cartons), fcfa(ca), fcfa(reste)],
        brut: [date, com, v.pointVente.nom, v.pointVente.ville.nom, resume, arrondi(cartons), Math.round(ca), Math.round(reste)],
      };
    });
    return {
      vue,
      colonnes: ["Date", "Commercial", "Point de vente", "Ville", "Produits", "Cartons vendus", "Chiffre d'affaires", "Reste à payer"],
      nbColsTexte: 5,
      lignes,
      totaux,
      pagination: { page: p, pageSize: TAILLE_PAGE_DETAIL, total: ventes.length, totalPages },
    };
  }

  const groupes = new Map<string, { cle: Cle; m: Mesures }>();
  if (vue === "historique") {
    for (const m of douzeDerniersMois()) groupes.set(m, { cle: { cle: m, libelle: m }, m: vide() });
  }
  for (const e of evts) {
    const c = cleDe(vue, e);
    if (!c) continue;
    const g = groupes.get(c.cle) ?? { cle: c, m: vide() };
    cumuler(g.m, e);
    groupes.set(c.cle, g);
  }

  let liste = [...groupes.values()];
  if (vue === "historique") {
    // déjà du plus récent au plus ancien (ordre d'insertion)
  } else {
    liste = liste.sort((a, b) => b.m.ca - a.m.ca || a.cle.libelle.localeCompare(b.cle.libelle));
  }

  const lignes = liste.map(({ cle, m }) => {
    const mes = ligneMesures(m, totaux.ca, true);
    const libelle = vue === "historique" ? libelleMois(cle.cle) : cle.libelle;
    const texte = cle.sous && vue !== "commercial" ? [libelle, cle.sous] : [libelle];
    return {
      cle: cle.cle,
      cellules: [...texte, ...mes.cells],
      brut: [...texte, ...mes.brut],
    };
  });

  const colonnePrincipale = {
    commercial: "Commercial",
    point_vente: "Point de vente",
    ville: "Ville",
    quartier: "Quartier",
    historique: "Mois",
  }[vue] as string;
  const colSecondaire = vue === "point_vente" ? "Ville · quartier" : vue === "quartier" ? "Ville" : null;
  const colonnes = [colonnePrincipale, ...(colSecondaire ? [colSecondaire] : []), ...COLS_MESURES];
  const nbColsTexte = colSecondaire ? 2 : 1;

  const tm = ligneMesures(totaux, totaux.ca, true);
  const remplissage = Array(nbColsTexte - 1).fill("");
  return {
    vue,
    colonnes,
    nbColsTexte,
    lignes,
    total: {
      cellules: ["Total", ...remplissage, ...tm.cells],
      brut: ["Total", ...remplissage, ...tm.brut],
    },
    totaux,
    pagination: null,
  };
}

async function rapportProduit(filters: RapportFilters): Promise<RapportTableau> {
  const { evts, ventes } = await chargerEvenements(filters);
  const totaux = totalMesures(evts);

  const map = new Map<string, { code: string; nom: string; gamme: string; ventes: Set<string>; cartons: number; ca: number; reste: number }>();
  for (const v of ventes) {
    for (const l of repartirVente(v).lignes) {
      if (!ligneRetenue(l, filters)) continue;
      const g = map.get(l.produitId) ?? { code: l.code, nom: l.nom, gamme: l.gamme, ventes: new Set<string>(), cartons: 0, ca: 0, reste: 0 };
      g.ventes.add(v.id);
      g.cartons += l.cartons;
      g.ca += l.ca;
      g.reste += l.reste;
      map.set(l.produitId, g);
    }
  }
  const liste = [...map.entries()].sort((a, b) => b[1].ca - a[1].ca);
  const totalCa = liste.reduce((s, [, g]) => s + g.ca, 0);

  const lignes = liste.map(([id, g]) => {
    const m: Mesures = { ...vide(), nbVentes: g.ventes.size, cartons: g.cartons, ca: g.ca, reste: g.reste };
    const mes = ligneMesures(m, totalCa, false);
    return {
      cle: id,
      cellules: [`${g.code} — ${g.nom}`, g.gamme, String(m.nbVentes), ...mes.cells],
      brut: [`${g.code} — ${g.nom}`, g.gamme, m.nbVentes, ...mes.brut],
    };
  });

  const tot: Mesures = {
    ...vide(),
    nbVentes: ventes.length,
    cartons: liste.reduce((s, [, g]) => s + g.cartons, 0),
    ca: totalCa,
    reste: liste.reduce((s, [, g]) => s + g.reste, 0),
  };
  const tm = ligneMesures(tot, totalCa, false);

  return {
    vue: "produit",
    colonnes: ["Produit", "Gamme", ...COLS_MESURES_PRODUIT],
    nbColsTexte: 2,
    lignes,
    total: { cellules: ["Total", "", String(tot.nbVentes), ...tm.cells], brut: ["Total", "", tot.nbVentes, ...tm.brut] },
    totaux: { ...totaux, ca: totalCa, cartons: tot.cartons, reste: tot.reste },
    pagination: null,
  };
}

// ---------------------------------------------------------------------------
// Aperçu détaillé d'une ligne (imprimable seul)
// ---------------------------------------------------------------------------

function focusEvt(vue: RapportVue, cle: string, e: Evt): boolean {
  switch (vue) {
    case "commercial":
      return e.commercialId === cle;
    case "point_vente":
      return e.pvId === cle;
    case "ville":
      return e.villeId === cle;
    case "quartier":
      return (e.quartierId ?? `sans-quartier-${e.villeId}`) === cle;
    case "historique":
      return moisDe(e.date) === cle;
    case "vente":
      return e.venteId === cle;
    default:
      return true;
  }
}

const TITRES_APERCU: Record<RapportVue, string> = {
  commercial: "Fiche commercial",
  point_vente: "Fiche point de vente",
  ville: "Fiche ville",
  quartier: "Fiche quartier",
  vente: "Détail de la vente",
  produit: "Fiche produit",
  historique: "Bilan mensuel",
};

export async function getApercu(
  filtersBrut: RapportFilters,
  vue: RapportVue,
  cle: string
): Promise<ApercuRapport> {
  let filters = vue === "historique" ? filtresHistorique(filtersBrut) : filtersBrut;
  let titreCible = "";

  // Une fiche produit se calcule en filtrant sur ce produit.
  if (vue === "produit") {
    const p = await prisma.produit.findUnique({ where: { id: cle }, select: { code: true, nom: true } });
    if (p) {
      filters = { ...filters, produitCode: p.code };
      titreCible = `${p.code} — ${p.nom}`;
    }
  }

  const { evts, ventes } = await chargerEvenements(filters);
  const evtsFocus = evts.filter((e) => focusEvt(vue, cle, e));
  const mesures = totalMesures(evtsFocus);
  if (vue === "produit") {
    // Un produit n'a ni visites, ni commandes, ni points de vente propres.
    mesures.pointsVente = 0;
    mesures.visites = 0;
    mesures.commandes = 0;
  }

  const ventesIds = new Set(evtsFocus.filter((e) => e.type === "vente").map((e) => e.venteId));
  const ventesFocus = ventes.filter((v) => (vue === "produit" ? true : ventesIds.has(v.id)));

  if (!titreCible) {
    const e = evtsFocus[0];
    titreCible =
      vue === "historique"
        ? libelleMois(cle)
        : vue === "commercial"
          ? (e?.commercialNom ?? "—")
          : vue === "point_vente"
            ? (e?.pvNom ?? "—")
            : vue === "ville"
              ? (e?.villeNom ?? "—")
              : vue === "quartier"
                ? (e?.quartierNom ?? "Sans quartier")
                : vue === "vente"
                  ? `Vente du ${e?.date.toLocaleDateString("fr-FR") ?? ""}`
                  : "";
  }
  const sousTitre =
    vue === "point_vente" && evtsFocus[0]
      ? `${evtsFocus[0].villeNom}${evtsFocus[0].quartierNom ? ` · ${evtsFocus[0].quartierNom}` : ""}`
      : vue === "quartier" && evtsFocus[0]
        ? evtsFocus[0].villeNom
        : vue === "commercial" && evtsFocus[0]?.binomeNom
          ? `Binôme : ${evtsFocus[0].binomeNom}`
          : "";

  // Produits
  const prod = new Map<string, { code: string; nom: string; gamme: string; sach: number; fil: number; cart: number; cartons: number; ca: number }>();
  const lignesVentes: ApercuRapport["ventes"] = [];
  for (const v of ventesFocus) {
    const r = repartirVente(v);
    const retenues = r.lignes.filter((l) => ligneRetenue(l, filters));
    for (const l of retenues) {
      const g = prod.get(l.produitId) ?? { code: l.code, nom: l.nom, gamme: l.gamme, sach: 0, fil: 0, cart: 0, cartons: 0, ca: 0 };
      g.sach += l.nbSachets;
      g.fil += l.nbFilets;
      g.cart += l.nbCartons;
      g.cartons += l.cartons;
      g.ca += l.ca;
      prod.set(l.produitId, g);
    }
    lignesVentes.push({
      id: v.id,
      date: v.dateVente.toISOString(),
      commercial: `${v.commercial.prenom} ${v.commercial.nom}`,
      pointVente: v.pointVente.nom,
      ville: v.pointVente.ville.nom,
      client: v.client?.nom ?? null,
      cartons: arrondi(retenues.reduce((s, l) => s + l.cartons, 0)),
      ca: Math.round(retenues.reduce((s, l) => s + l.ca, 0)),
      paye: Math.round(r.paye),
      reste: Math.round(retenues.reduce((s, l) => s + l.reste, 0)),
    });
  }

  const totalCa = [...prod.values()].reduce((s, g) => s + g.ca, 0);
  const produits = [...prod.values()]
    .sort((a, b) => b.ca - a.ca)
    .map((g) => ({
      code: g.code,
      nom: g.nom,
      gamme: g.gamme,
      quantites: [g.cart ? `${g.cart} carton${g.cart > 1 ? "s" : ""}` : "", g.fil ? `${g.fil} filet${g.fil > 1 ? "s" : ""}` : "", g.sach ? `${g.sach} sachet${g.sach > 1 ? "s" : ""}` : ""]
        .filter(Boolean)
        .join(" · ") || "—",
      cartons: arrondi(g.cartons),
      ca: Math.round(g.ca),
      part: totalCa > 0 ? arrondi((g.ca / totalCa) * 100, 1) : 0,
    }));

  return {
    titre: `${TITRES_APERCU[vue]} — ${titreCible}`,
    sousTitre,
    mesures,
    produits,
    ventes: lignesVentes.slice(0, MAX_VENTES_APERCU),
    ventesTronquees: lignesVentes.length > MAX_VENTES_APERCU,
  };
}
