import { prisma } from "@/lib/prisma";
import { valeurCatalogueLigne } from "@/lib/utils/tarifs";
import { ventesBureau } from "@/lib/queries/ventes-bureau";
import { debutJour, finJour, jourDouala, ajouterJours } from "@/lib/utils/periode";
import { cartonsEq, arrondiCartons, SELECT_CONV } from "@/lib/utils/cartons-equiv";

const DEFAUTS_INDIVIDUEL: Record<"JOURNALIER" | "HEBDOMADAIRE" | "MENSUEL", number> = {
  JOURNALIER: 42,
  HEBDOMADAIRE: 192,
  MENSUEL: 768,
};

function plages() {
  // Jours, semaines et mois calculés à l'heure de Douala (le serveur Vercel est en UTC).
  const aujourdhui = jourDouala();
  const jourSemaine = (new Date(`${aujourdhui}T12:00:00Z`).getUTCDay() + 6) % 7; // 0 = lundi
  const lundi = ajouterJours(aujourdhui, -jourSemaine);
  const premierDuMois = `${aujourdhui.slice(0, 7)}-01`;
  return {
    debutJour: debutJour(aujourdhui),
    finJour: finJour(aujourdhui),
    debutSemaine: debutJour(lundi),
    debutMois: debutJour(premierDuMois),
    maintenant: new Date(),
  };
}

/**
 * Couleur de performance — seuils choisis en l'absence d'indication
 * précise ("tu sauras comment calculer les pourcentages") : en dessous de
 * 50% = médiocre (rouge), 50 à 79% = moyen (orange), 80%+ = bien (vert).
 * Modifiable ici si Victor souhaite d'autres seuils.
 */
export function couleurPerformance(pourcentage: number): "rouge" | "orange" | "vert" {
  if (pourcentage >= 80) return "vert";
  if (pourcentage >= 50) return "orange";
  return "rouge";
}

export type DetailProduit = { code: string; nom: string; cartons: number; filets: number; sachets: number; equivalent: number };
export type DetailVentes = { cartons: number; filets: number; sachets: number; parProduit: DetailProduit[] };
export type PerfPeriode = { realise: number; detail: DetailVentes };

/** Cartons (équivalent) + détail brut : cartons, filets et sachets vendus, au total et par produit. */
async function ventesVendues(where: { commercialId?: string; binomeId?: string }, depuis: Date, jusqua?: Date): Promise<PerfPeriode> {
  const lignes = await prisma.venteLigne.findMany({
    where: {
      vente: {
        createdAt: { gte: depuis, ...(jusqua ? { lte: jusqua } : {}) },
        ...(where.commercialId ? { commercialId: where.commercialId } : {}),
        ...(where.binomeId ? { commercial: { binomeId: where.binomeId } } : {}),
      },
    },
    select: { nbCartons: true, nbSachets: true, nbFilets: true, produit: { select: { code: true, ...SELECT_CONV } } },
  });
  // + commandes saisies au bureau au nom du commercial (sans vente terrain)
  const bureau = (await ventesBureau(depuis, jusqua)).filter(
    (b) => (!where.commercialId || b.commercialId === where.commercialId) && (!where.binomeId || b.binomeId === where.binomeId)
  );
  const catalogue = await prisma.produit.findMany({ select: { code: true, nom: true, ...SELECT_CONV } });
  const convDe = new Map(catalogue.map((p) => [p.code, p]));
  const parCode = new Map<string, DetailProduit>();
  const ajouter = (code: string, c: number, f: number, s: number) => {
    const d = parCode.get(code) ?? { code, nom: convDe.get(code)?.nom ?? code, cartons: 0, filets: 0, sachets: 0, equivalent: 0 };
    d.cartons += c;
    d.filets += f;
    d.sachets += s;
    parCode.set(code, d);
  };
  for (const l of lignes) ajouter(l.produit.code, l.nbCartons, l.nbFilets, l.nbSachets);
  for (const b of bureau) for (const q of b.qte) ajouter(q.code, q.nbCartons, q.nbFilets, q.nbSachets);
  const parProduit = [...parCode.values()].sort((x, y) => x.code.localeCompare(y.code));
  for (const d of parProduit) {
    const conv = convDe.get(d.code);
    d.equivalent = conv ? arrondiCartons(cartonsEq({ nbCartons: d.cartons, nbFilets: d.filets, nbSachets: d.sachets }, conv)) : d.cartons;
  }
  const somme = (k: "cartons" | "filets" | "sachets") => parProduit.reduce((t, d) => t + d[k], 0);
  return {
    realise: arrondiCartons(lignes.reduce((t, l) => t + cartonsEq(l, l.produit), 0) + bureau.reduce((t, b) => t + b.cartons, 0)),
    detail: { cartons: somme("cartons"), filets: somme("filets"), sachets: somme("sachets"), parProduit },
  };
}

export async function getObjectifsIndividuels() {
  const rows = await prisma.objectifIndividuel.findMany();
  const parPeriode = new Map(rows.map((r) => [r.periode, r.valeurCartons]));
  return {
    JOURNALIER: parPeriode.get("JOURNALIER") ?? DEFAUTS_INDIVIDUEL.JOURNALIER,
    HEBDOMADAIRE: parPeriode.get("HEBDOMADAIRE") ?? DEFAUTS_INDIVIDUEL.HEBDOMADAIRE,
    MENSUEL: parPeriode.get("MENSUEL") ?? DEFAUTS_INDIVIDUEL.MENSUEL,
  };
}

/** Statistiques personnelles du commercial connecté : jour/semaine/mois. */
export async function getStatsPersonnelles(commercialId: string) {
  const { debutJour, finJour, debutSemaine, debutMois } = plages();
  const objectifs = await getObjectifsIndividuels();

  const [jour, semaine, mois] = await Promise.all([
    ventesVendues({ commercialId }, debutJour, finJour),
    ventesVendues({ commercialId }, debutSemaine),
    ventesVendues({ commercialId }, debutMois),
  ]);

  const withPct = (perf: PerfPeriode, objectif: number) => ({
    realise: perf.realise,
    detail: perf.detail,
    objectif,
    pourcentage: objectif > 0 ? Math.min(999, Math.round((perf.realise / objectif) * 100)) : 0,
    couleur: couleurPerformance(objectif > 0 ? (perf.realise / objectif) * 100 : 0),
  });

  return {
    jour: withPct(jour, objectifs.JOURNALIER),
    semaine: withPct(semaine, objectifs.HEBDOMADAIRE),
    mois: withPct(mois, objectifs.MENSUEL),
  };
}

/**
 * Statistiques du binôme — comparées aux objectifs PAR BINÔME déjà en
 * place (distincts des objectifs individuels ci-dessus), jour + semaine
 * uniquement (pas d'objectif mensuel par binôme pour l'instant).
 */
export async function getStatsBinome(binomeId: string) {
  const { debutJour, finJour, debutSemaine, maintenant } = plages();

  const [jourCartons, semaineCartons, objectifJournalier, objectifHebdo] = await Promise.all([
    ventesVendues({ binomeId }, debutJour, finJour),
    ventesVendues({ binomeId }, debutSemaine),
    prisma.objectif.findFirst({
      where: {
        binomeId,
        periode: "JOURNALIER",
        dateDebut: { lte: maintenant },
        dateFin: { gte: maintenant },
      },
    }),
    prisma.objectif.findFirst({
      where: {
        binomeId,
        periode: "HEBDOMADAIRE",
        dateDebut: { lte: maintenant },
        dateFin: { gte: maintenant },
      },
    }),
  ]);

  const objJour = objectifJournalier?.valeurCartons ?? 42;
  const objSemaine = objectifHebdo?.valeurCartons ?? 2500;

  const withPct = (perf: PerfPeriode, objectif: number) => ({
    realise: perf.realise,
    detail: perf.detail,
    objectif,
    pourcentage: objectif > 0 ? Math.min(999, Math.round((perf.realise / objectif) * 100)) : 0,
    couleur: couleurPerformance(objectif > 0 ? (perf.realise / objectif) * 100 : 0),
  });

  return {
    jour: withPct(jourCartons, objJour),
    semaine: withPct(semaineCartons, objSemaine),
  };
}

/** Commandes en attente du commercial connecté, pour rappel sur son accueil. */
export async function getCommandesEnAttente(commercialId: string) {
  const commandes = await prisma.commande.findMany({
    where: { commercialId, statut: "EN_ATTENTE" },
    orderBy: { dateLivraisonPrevue: "asc" },
    take: 10,
    select: {
      id: true,
      dateLivraisonPrevue: true,
      pointVente: { select: { nom: true } },
      lignes: {
        select: {
          nbSachets: true,
          nbFilets: true,
          nbCartons: true,
          produit: { select: { prixSachet: true, prixFilet: true, prixCarton: true, sachetsParCarton: true, sachetsParFilet: true } },
        },
      },
    },
  });

  // La commande elle-même n'a pas de montant enregistré (aucun prix n'est
  // saisi au moment de la prise de commande) — on l'estime ici à partir
  // des prix produits actuels, pour l'affichage sur le dashboard.
  return commandes.map((c) => ({
    id: c.id,
    dateLivraisonPrevue: c.dateLivraisonPrevue,
    pointVente: c.pointVente,
    montantEstime: c.lignes.reduce((s, l) => s + valeurCatalogueLigne(l, l.produit), 0),
  }));
}
