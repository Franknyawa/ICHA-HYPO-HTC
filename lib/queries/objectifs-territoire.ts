import { prisma } from "@/lib/prisma";
import { NOMS_REGIONS, regionDeVille } from "@/lib/geo/cameroun";
import { assurerVilles } from "@/lib/geo/synchro-villes";
import { ajouterJours, debutJour, jourDouala } from "@/lib/utils/periode";

export type PeriodeTerritoire = "JOURNALIER" | "HEBDOMADAIRE" | "MENSUEL";
const PERIODES: PeriodeTerritoire[] = ["JOURNALIER", "HEBDOMADAIRE", "MENSUEL"];

export type MesureTerritoire = { realise: number; objectif: number; pourcentage: number; couleur: "rouge" | "orange" | "vert" };

export type LigneTerritoire = {
  cle: string;
  nom: string;
  /** Région d'une ville (affichée en petit). */
  sous?: string;
  periodes: Record<PeriodeTerritoire, MesureTerritoire>;
};

export type ProgressionTerritoires = { regions: LigneTerritoire[]; villes: LigneTerritoire[] };

function mesure(realise: number, objectif: number): MesureTerritoire {
  const pct = objectif > 0 ? (realise / objectif) * 100 : 0;
  return {
    realise,
    objectif,
    pourcentage: objectif > 0 ? Math.min(999, Math.round(pct)) : 0,
    couleur: pct >= 80 ? "vert" : pct >= 50 ? "orange" : "rouge",
  };
}

/**
 * Cartons vendus ou commandés (hors commandes annulées) par région et par
 * ville sur le jour, la semaine (depuis lundi) et le mois en cours — jours de
 * Douala — comparés aux objectifs saisis dans les paramètres.
 */
export async function getProgressionTerritoires(): Promise<ProgressionTerritoires> {
  await assurerVilles();
  const aujourdhui = jourDouala();
  const debutJourMs = debutJour(aujourdhui).getTime();
  const jourSemaine = (new Date(`${aujourdhui}T00:00:00Z`).getUTCDay() + 6) % 7; // 0 = lundi
  const debutSemaineMs = debutJour(ajouterJours(aujourdhui, -jourSemaine)).getTime();
  const debutMoisMs = debutJour(`${aujourdhui.slice(0, 8)}01`).getTime();
  const depuis = new Date(Math.min(debutSemaineMs, debutMoisMs));

  const [lignesVente, lignesCommande, objectifs, villes] = await Promise.all([
    prisma.venteLigne.findMany({
      where: { nbCartons: { gt: 0 }, vente: { dateVente: { gte: depuis } } },
      select: { nbCartons: true, vente: { select: { dateVente: true, pointVente: { select: { villeId: true } } } } },
    }),
    prisma.commandeLigne.findMany({
      // Les commandes issues d'une vente terrain (venteId) sont déjà comptées dans les ventes.
      where: { nbCartons: { gt: 0 }, commande: { statut: { not: "ANNULEE" }, venteId: null, dateCommande: { gte: depuis } } },
      select: { nbCartons: true, commande: { select: { dateCommande: true, pointVente: { select: { villeId: true } } } } },
    }),
    prisma.objectifTerritoire.findMany(),
    prisma.ville.findMany({ select: { id: true, nom: true, region: true } }),
  ]);

  const villeParId = new Map(villes.map((v) => [v.id, v]));
  const vide = () => ({ JOURNALIER: 0, HEBDOMADAIRE: 0, MENSUEL: 0 });
  const parVille = new Map<string, Record<PeriodeTerritoire, number>>();
  const parRegion = new Map<string, Record<PeriodeTerritoire, number>>();

  const ajouter = (villeId: string, date: Date, cartons: number) => {
    const ville = villeParId.get(villeId);
    if (!ville) return;
    const region = ville.region ?? regionDeVille(ville.nom) ?? "Autres";
    const t = date.getTime();
    for (const cible of [
      parVille.get(villeId) ?? parVille.set(villeId, vide()).get(villeId)!,
      parRegion.get(region) ?? parRegion.set(region, vide()).get(region)!,
    ]) {
      if (t >= debutJourMs) cible.JOURNALIER += cartons;
      if (t >= debutSemaineMs) cible.HEBDOMADAIRE += cartons;
      if (t >= debutMoisMs) cible.MENSUEL += cartons;
    }
  };
  for (const l of lignesVente) ajouter(l.vente.pointVente.villeId, l.vente.dateVente, l.nbCartons);
  for (const l of lignesCommande) ajouter(l.commande.pointVente.villeId, l.commande.dateCommande, l.nbCartons);

  const objectifDe = (niveau: string, cle: string) => {
    const o = vide();
    for (const x of objectifs) if (x.niveau === niveau && x.cle === cle) o[x.periode] = x.valeurCartons;
    return o;
  };
  const construire = (niveau: string, cle: string, nom: string, realise: Record<PeriodeTerritoire, number>, sous?: string) => {
    const obj = objectifDe(niveau, cle);
    const periodes = {} as Record<PeriodeTerritoire, MesureTerritoire>;
    for (const p of PERIODES) periodes[p] = mesure(realise[p], obj[p]);
    const actif = PERIODES.some((p) => obj[p] > 0 || realise[p] > 0);
    return actif ? ({ cle, nom, sous, periodes } as LigneTerritoire) : null;
  };

  const regions = [...NOMS_REGIONS, ...[...parRegion.keys()].filter((r) => !NOMS_REGIONS.includes(r))]
    .map((r) => construire("REGION", r, r, parRegion.get(r) ?? vide()))
    .filter((x): x is LigneTerritoire => x !== null);

  const idsVilles = new Set<string>([...parVille.keys(), ...objectifs.filter((o) => o.niveau === "VILLE").map((o) => o.cle)]);
  const lignesVilles = [...idsVilles]
    .map((id) => {
      const v = villeParId.get(id);
      return v ? construire("VILLE", id, v.nom, parVille.get(id) ?? vide(), v.region ?? undefined) : null;
    })
    .filter((x): x is LigneTerritoire => x !== null)
    .sort((a, b) => b.periodes.MENSUEL.realise - a.periodes.MENSUEL.realise);

  return { regions, villes: lignesVilles };
}
