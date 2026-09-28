import { prisma } from "@/lib/prisma";
import { getObjectifsIndividuels, couleurPerformance } from "@/lib/queries/commercial-stats";

// Optimisé pour un nombre FIXE de requêtes, peu importe le nombre de
// binômes/commerciaux — la version précédente refaisait 4 requêtes PAR
// binôme et PAR commercial (via getStatsBinome/getStatsPersonnelles en
// boucle), ce qui devenait très coûteux en latence réseau (chaque aller-
// retour vers la base traverse l'Atlantique — voir discussion lenteur).
// Ici : quelques requêtes globales, tout le regroupement se fait en JS.

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

function withPct(realise: number, objectif: number) {
  return {
    realise,
    objectif,
    pourcentage: objectif > 0 ? Math.min(999, Math.round((realise / objectif) * 100)) : 0,
    couleur: couleurPerformance(objectif > 0 ? (realise / objectif) * 100 : 0),
  };
}

export async function getProgressionBinomes() {
  const { debutJour, finJour, debutSemaine, maintenant } = plages();

  const [binomes, lignesJour, lignesSemaine, objectifsActifs] = await Promise.all([
    prisma.binome.findMany({ where: { actif: true }, orderBy: { nom: "asc" } }),
    prisma.venteLigne.findMany({
      where: { vente: { createdAt: { gte: debutJour, lte: finJour } } },
      select: { nbCartons: true, vente: { select: { commercial: { select: { binomeId: true } } } } },
    }),
    prisma.venteLigne.findMany({
      where: { vente: { createdAt: { gte: debutSemaine } } },
      select: { nbCartons: true, vente: { select: { commercial: { select: { binomeId: true } } } } },
    }),
    prisma.objectif.findMany({
      where: {
        periode: { in: ["JOURNALIER", "HEBDOMADAIRE"] },
        dateDebut: { lte: maintenant },
        dateFin: { gte: maintenant },
      },
      select: { binomeId: true, periode: true, valeurCartons: true },
    }),
  ]);

  const sommeParBinome = (lignes: typeof lignesJour) => {
    const m = new Map<string, number>();
    for (const l of lignes) {
      const bId = l.vente.commercial.binomeId;
      if (!bId) continue;
      m.set(bId, (m.get(bId) ?? 0) + l.nbCartons);
    }
    return m;
  };
  const cartonsJourParBinome = sommeParBinome(lignesJour);
  const cartonsSemaineParBinome = sommeParBinome(lignesSemaine);

  const objectifParBinome = new Map<string, { jour?: number; semaine?: number }>();
  for (const o of objectifsActifs) {
    if (!o.binomeId) continue;
    const existant = objectifParBinome.get(o.binomeId) ?? {};
    if (o.periode === "JOURNALIER") existant.jour = o.valeurCartons;
    if (o.periode === "HEBDOMADAIRE") existant.semaine = o.valeurCartons;
    objectifParBinome.set(o.binomeId, existant);
  }

  return binomes.map((b) => {
    const obj = objectifParBinome.get(b.id) ?? {};
    return {
      id: b.id,
      nom: b.nom,
      jour: withPct(cartonsJourParBinome.get(b.id) ?? 0, obj.jour ?? 42),
      semaine: withPct(cartonsSemaineParBinome.get(b.id) ?? 0, obj.semaine ?? 2500),
    };
  });
}

export async function getProgressionCommerciaux() {
  const { debutJour, finJour, debutSemaine, debutMois } = plages();

  const [commerciaux, lignesJour, lignesSemaine, lignesMois, objectifs] = await Promise.all([
    prisma.user.findMany({
      where: { role: "COMMERCIAL", actif: true },
      orderBy: { nom: "asc" },
      include: { binome: { select: { nom: true } } },
    }),
    prisma.venteLigne.findMany({
      where: { vente: { createdAt: { gte: debutJour, lte: finJour } } },
      select: { nbCartons: true, vente: { select: { commercialId: true } } },
    }),
    prisma.venteLigne.findMany({
      where: { vente: { createdAt: { gte: debutSemaine } } },
      select: { nbCartons: true, vente: { select: { commercialId: true } } },
    }),
    prisma.venteLigne.findMany({
      where: { vente: { createdAt: { gte: debutMois } } },
      select: { nbCartons: true, vente: { select: { commercialId: true } } },
    }),
    getObjectifsIndividuels(),
  ]);

  const sommeParCommercial = (lignes: typeof lignesJour) => {
    const m = new Map<string, number>();
    for (const l of lignes) {
      const cId = l.vente.commercialId;
      m.set(cId, (m.get(cId) ?? 0) + l.nbCartons);
    }
    return m;
  };
  const jourParCommercial = sommeParCommercial(lignesJour);
  const semaineParCommercial = sommeParCommercial(lignesSemaine);
  const moisParCommercial = sommeParCommercial(lignesMois);

  return commerciaux.map((c) => ({
    id: c.id,
    nom: `${c.prenom} ${c.nom}`,
    binomeNom: c.binome?.nom ?? null,
    jour: withPct(jourParCommercial.get(c.id) ?? 0, objectifs.JOURNALIER),
    semaine: withPct(semaineParCommercial.get(c.id) ?? 0, objectifs.HEBDOMADAIRE),
    mois: withPct(moisParCommercial.get(c.id) ?? 0, objectifs.MENSUEL),
  }));
}
