import { prisma } from "@/lib/prisma";

const DEFAUTS_INDIVIDUEL: Record<"JOURNALIER" | "HEBDOMADAIRE" | "MENSUEL", number> = {
  JOURNALIER: 42,
  HEBDOMADAIRE: 192,
  MENSUEL: 768,
};

function plages() {
  const now = new Date();

  const debutJour = new Date(now);
  debutJour.setHours(0, 0, 0, 0);
  const finJour = new Date(now);
  finJour.setHours(23, 59, 59, 999);

  const jourSemaine = (now.getDay() + 6) % 7; // 0 = lundi
  const debutSemaine = new Date(now);
  debutSemaine.setDate(now.getDate() - jourSemaine);
  debutSemaine.setHours(0, 0, 0, 0);

  const debutMois = new Date(now.getFullYear(), now.getMonth(), 1);

  return { debutJour, finJour, debutSemaine, debutMois, maintenant: now };
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

async function cartonsVendus(where: { commercialId?: string; binomeId?: string }, depuis: Date, jusqua?: Date) {
  const lignes = await prisma.venteLigne.findMany({
    where: {
      vente: {
        createdAt: { gte: depuis, ...(jusqua ? { lte: jusqua } : {}) },
        ...(where.commercialId ? { commercialId: where.commercialId } : {}),
        ...(where.binomeId ? { commercial: { binomeId: where.binomeId } } : {}),
      },
    },
    select: { nbCartons: true },
  });
  return lignes.reduce((s, l) => s + l.nbCartons, 0);
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
    cartonsVendus({ commercialId }, debutJour, finJour),
    cartonsVendus({ commercialId }, debutSemaine),
    cartonsVendus({ commercialId }, debutMois),
  ]);

  const withPct = (realise: number, objectif: number) => ({
    realise,
    objectif,
    pourcentage: objectif > 0 ? Math.min(999, Math.round((realise / objectif) * 100)) : 0,
    couleur: couleurPerformance(objectif > 0 ? (realise / objectif) * 100 : 0),
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
    cartonsVendus({ binomeId }, debutJour, finJour),
    cartonsVendus({ binomeId }, debutSemaine),
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

  const withPct = (realise: number, objectif: number) => ({
    realise,
    objectif,
    pourcentage: objectif > 0 ? Math.min(999, Math.round((realise / objectif) * 100)) : 0,
    couleur: couleurPerformance(objectif > 0 ? (realise / objectif) * 100 : 0),
  });

  return {
    jour: withPct(jourCartons, objJour),
    semaine: withPct(semaineCartons, objSemaine),
  };
}

/** Commandes en attente du commercial connecté, pour rappel sur son accueil. */
export async function getCommandesEnAttente(commercialId: string) {
  return prisma.commande.findMany({
    where: { commercialId, statut: "EN_ATTENTE" },
    orderBy: { dateLivraisonPrevue: "asc" },
    take: 10,
    select: {
      id: true,
      dateLivraisonPrevue: true,
      pointVente: { select: { nom: true } },
    },
  });
}
