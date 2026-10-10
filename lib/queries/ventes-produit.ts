import { prisma } from "@/lib/prisma";
import { repartirVente, SANS_GAMME } from "@/lib/queries/rapports";

// Section « Ventes par produit » du tableau de bord : classement, meilleurs
// points de vente / quartiers, évolution sur 12 mois et sur 30 jours — pour
// chaque produit et pour 4 périodes. Tout est précalculé ici en une seule
// passe pour que l'écran réagisse instantanément aux changements de produit,
// de période ou d'indicateur. Indépendant des produits : fonctionne pour toute
// nouvelle gamme sans modification.

export type PeriodeId = "30j" | "90j" | "12m" | "tout";

export const PERIODES: { id: PeriodeId; label: string; jours: number | null }[] = [
  { id: "30j", label: "30 derniers jours", jours: 30 },
  { id: "90j", label: "90 derniers jours", jours: 90 },
  { id: "12m", label: "12 derniers mois", jours: 365 },
  { id: "tout", label: "Depuis le début", jours: null },
];

export type Classement = { nom: string; lieu: string; cartons: number; ca: number };

export type StatProduit = {
  id: string;
  code: string;
  nom: string;
  gamme: string;
  cartons: number;
  ca: number;
  commandes: number;
  pointsVente: number;
  topPointsVente: Classement[];
  topQuartiers: Classement[];
};

export type PointSerie = { label: string; cartons: number; ca: number };

export type DonneesVentesProduit = {
  periodes: Record<PeriodeId, StatProduit[]>;
  serie12: Record<string, PointSerie[]>;
  serie30: Record<string, PointSerie[]>;
};

const MOIS_COURTS = ["janv", "févr", "mars", "avr", "mai", "juin", "juil", "août", "sept", "oct", "nov", "déc"];

function debutDuJour(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

type Acc = {
  id: string;
  code: string;
  nom: string;
  gamme: string;
  cartons: number;
  ca: number;
  pvs: Map<string, { nom: string; lieu: string; cartons: number; ca: number }>;
  quartiers: Map<string, { nom: string; lieu: string; cartons: number; ca: number }>;
};

const top = (m: Map<string, Classement>) =>
  [...m.values()]
    .sort((a, b) => b.cartons - a.cartons || b.ca - a.ca)
    .slice(0, 5)
    .map((x) => ({ ...x, cartons: Math.round(x.cartons * 10) / 10, ca: Math.round(x.ca) }));

export async function getDonneesVentesProduit(): Promise<DonneesVentesProduit> {
  const maintenant = new Date();
  const debuts = Object.fromEntries(
    PERIODES.map((p) => [p.id, p.jours ? debutDuJour(new Date(maintenant.getTime() - p.jours * 86400000)) : null])
  ) as Record<PeriodeId, Date | null>;

  const [ventes, commandesParPeriode] = await Promise.all([
    prisma.vente.findMany({
      select: {
        dateVente: true,
        montantTotal: true,
        pointVenteId: true,
        pointVente: {
          select: {
            nom: true,
            villeId: true,
            ville: { select: { nom: true } },
            quartierId: true,
            quartier: { select: { nom: true } },
          },
        },
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
      },
    }),
    Promise.all(
      PERIODES.map((p) =>
        prisma.commandeLigne.groupBy({
          by: ["produitId"],
          where: debuts[p.id] ? { commande: { dateCommande: { gte: debuts[p.id]! } } } : undefined,
          _count: { _all: true },
        })
      )
    ),
  ]);

  // Accumulateurs par période
  const accs = Object.fromEntries(PERIODES.map((p) => [p.id, new Map<string, Acc>()])) as Record<PeriodeId, Map<string, Acc>>;

  // Séries : 12 mois (du plus ancien au plus récent) et 30 jours
  const mois: { cle: string; label: string }[] = [];
  const d = new Date(maintenant.getFullYear(), maintenant.getMonth(), 1);
  for (let i = 0; i < 12; i++) {
    mois.unshift({
      cle: `${d.getFullYear()}-${d.getMonth()}`,
      label: `${MOIS_COURTS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`,
    });
    d.setMonth(d.getMonth() - 1);
  }
  const jours: { cle: string; label: string }[] = [];
  for (let i = 29; i >= 0; i--) {
    const j = new Date(maintenant.getTime() - i * 86400000);
    jours.push({
      cle: j.toDateString(),
      label: `${String(j.getDate()).padStart(2, "0")}/${String(j.getMonth() + 1).padStart(2, "0")}`,
    });
  }
  const s12 = new Map<string, Map<string, { cartons: number; ca: number }>>();
  const s30 = new Map<string, Map<string, { cartons: number; ca: number }>>();
  const ajouter = (m: Map<string, Map<string, { cartons: number; ca: number }>>, pid: string, cle: string, cartons: number, ca: number) => {
    const interne = m.get(pid) ?? new Map();
    const cur = interne.get(cle) ?? { cartons: 0, ca: 0 };
    cur.cartons += cartons;
    cur.ca += ca;
    interne.set(cle, cur);
    m.set(pid, interne);
  };

  const ids12 = new Set(mois.map((m) => m.cle));
  const ids30 = new Set(jours.map((j) => j.cle));

  for (const v of ventes) {
    const date = v.dateVente;
    const pv = v.pointVente;
    const lieuPv = `${pv.ville.nom}${pv.quartier ? ` · ${pv.quartier.nom}` : ""}`;
    const cleQuartier = pv.quartierId ?? `sans-${pv.villeId}`;

    for (const l of repartirVente(v).lignes) {
      for (const p of PERIODES) {
        const debut = debuts[p.id];
        if (debut && date < debut) continue;
        const m = accs[p.id];
        const a =
          m.get(l.produitId) ??
          ({ id: l.produitId, code: l.code, nom: l.nom, gamme: l.gamme, cartons: 0, ca: 0, pvs: new Map(), quartiers: new Map() } as Acc);
        a.cartons += l.cartons;
        a.ca += l.ca;
        const ep = a.pvs.get(v.pointVenteId) ?? { nom: pv.nom, lieu: lieuPv, cartons: 0, ca: 0 };
        ep.cartons += l.cartons;
        ep.ca += l.ca;
        a.pvs.set(v.pointVenteId, ep);
        const eq = a.quartiers.get(cleQuartier) ?? { nom: pv.quartier?.nom ?? "Sans quartier", lieu: pv.ville.nom, cartons: 0, ca: 0 };
        eq.cartons += l.cartons;
        eq.ca += l.ca;
        a.quartiers.set(cleQuartier, eq);
        m.set(l.produitId, a);
      }
      const cm = `${date.getFullYear()}-${date.getMonth()}`;
      if (ids12.has(cm)) ajouter(s12, l.produitId, cm, l.cartons, l.ca);
      const cj = date.toDateString();
      if (ids30.has(cj)) ajouter(s30, l.produitId, cj, l.cartons, l.ca);
    }
  }

  const periodes = {} as Record<PeriodeId, StatProduit[]>;
  PERIODES.forEach((p, i) => {
    const cmd = new Map<string, number>(
      (commandesParPeriode[i] as { produitId: string; _count: { _all: number } }[]).map(
        (c: { produitId: string; _count: { _all: number } }) => [c.produitId, Number(c._count._all)] as [string, number],
      ),
    );
    periodes[p.id] = [...accs[p.id].values()].map((a) => ({
      id: a.id,
      code: a.code,
      nom: a.nom,
      gamme: a.gamme || SANS_GAMME,
      cartons: Math.round(a.cartons * 10) / 10,
      ca: Math.round(a.ca),
      commandes: cmd.get(a.id) ?? 0,
      pointsVente: a.pvs.size,
      topPointsVente: top(a.pvs),
      topQuartiers: top(a.quartiers),
    }));
  });

  const serie = (src: typeof s12, axe: { cle: string; label: string }[]) => {
    const out: Record<string, PointSerie[]> = {};
    for (const [pid, interne] of src) {
      out[pid] = axe.map((x) => ({
        label: x.label,
        cartons: Math.round((interne.get(x.cle)?.cartons ?? 0) * 10) / 10,
        ca: Math.round(interne.get(x.cle)?.ca ?? 0),
      }));
    }
    return out;
  };

  return { periodes, serie12: serie(s12, mois), serie30: serie(s30, jours) };
}
