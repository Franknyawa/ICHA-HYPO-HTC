import { prisma } from "@/lib/prisma";
import { chargerVentes, repartirVente } from "@/lib/queries/rapports";
import { getCaisseResume } from "@/lib/queries/caisse";
import { NOM_CLIENT_DIVERS } from "@/lib/services/client-divers";
import { ajouterJours, debutJour, finJour, jourDouala } from "@/lib/utils/periode";
import { partsVente, texteDetail, volAjouter, volVide, type Vol } from "@/lib/utils/cartons-equiv";

export type TypePeriode = "semaine" | "mois";

export type PeriodeRef = {
  type: TypePeriode;
  /** Premier jour (AAAA-MM-JJ) */
  du: string;
  /** Dernier jour (AAAA-MM-JJ) */
  au: string;
  libelle: string;
  /** Référence de la période précédente / suivante, pour la navigation */
  precedente: string;
  suivante: string;
  /** Référence de cette période (semaine : lundi ; mois : AAAA-MM) */
  ref: string;
};

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const fr = (j: string) => new Date(`${j}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", timeZone: "UTC" });

export function resoudrePeriodique(type: TypePeriode, ref?: string): PeriodeRef {
  const aujourdhui = jourDouala();
  if (type === "mois") {
    const m = /^(\d{4})-(\d{2})$/.test(ref ?? "") ? ref! : aujourdhui.slice(0, 7);
    const [a, mo] = m.split("-").map(Number);
    const du = `${m}-01`;
    const dernier = new Date(Date.UTC(a, mo, 0)).getUTCDate();
    const au = `${m}-${String(dernier).padStart(2, "0")}`;
    const prec = new Date(Date.UTC(a, mo - 2, 1));
    const suiv = new Date(Date.UTC(a, mo, 1));
    const cle = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    return { type, du, au, ref: m, libelle: `${MOIS[mo - 1][0].toUpperCase()}${MOIS[mo - 1].slice(1)} ${a}`, precedente: cle(prec), suivante: cle(suiv) };
  }
  const jour = /^\d{4}-\d{2}-\d{2}$/.test(ref ?? "") ? ref! : aujourdhui;
  const dow = new Date(`${jour}T00:00:00Z`).getUTCDay(); // 0 = dimanche
  const du = ajouterJours(jour, -((dow + 6) % 7));
  const au = ajouterJours(du, 6);
  return { type, du, au, ref: du, libelle: `Semaine du ${fr(du)} au ${fr(au)} ${au.slice(0, 4)}`, precedente: ajouterJours(du, -7), suivante: ajouterJours(du, 7) };
}

export type ProduitPeriode = {
  code: string;
  nom: string;
  vol: Vol;
  /** Cartons équivalents (cartons + détail converti), pour la part du produit. */
  eq: number;
  partProduit: number;
  parts: { cartons: number; detail: number } | null;
  variation: number | null;
};
export type JourPeriode = { cle: string; libelle: string; vol: Vol; commandes: number };
export type ClassementLigne = { nom: string; sous?: string; vol: Vol; commandes: number };

export type RapportPeriodique = {
  periode: PeriodeRef;
  totaux: { vol: Vol; eq: number; parts: { cartons: number; detail: number } | null; commandes: number; visites: number; nouveauxPv: number; variationEq: number | null };
  precedent: { libelle: string; eq: number };
  produits: ProduitPeriode[];
  jours: JourPeriode[];
  commerciaux: ClassementLigne[];
  pointsVente: ClassementLigne[];
  caisse: { encaisse: number; depenses: number };
  lecture: Lecture[];
  /** « du lundi 19 au dimanche 25 octobre 2026 » */
  datesLongues: string;
  nbJours: number;
};

export type Lecture = { titre: string; texte: string; ton: "info" | "bon" | "alerte" | "neutre" };

type Agg = { vol: Vol; commandes: number };
const eqDe = (v: Vol) => v.gros + v.detailEq;
const pct = (n: number) => String(Math.round(n * 10) / 10).replace(".", ",");

async function agreger(du: string, au: string) {
  const ventes = await chargerVentes({ dateFrom: du, dateTo: au });
  const produits = new Map<string, { code: string; nom: string; vol: Vol }>();
  const jours = new Map<string, Agg>();
  const commerciaux = new Map<string, ClassementLigne & { bureau: boolean }>();
  const pvs = new Map<string, ClassementLigne>();
  const total = volVide();

  for (const v of ventes) {
    const { lignes } = repartirVente(v);
    const volVente = volVide();
    for (const l of lignes) {
      volAjouter(volVente, l.vol);
      const p = produits.get(l.code) ?? { code: l.code, nom: l.nom, vol: volVide() };
      volAjouter(p.vol, l.vol);
      produits.set(l.code, p);
    }
    volAjouter(total, volVente);
    const j = jourDouala(v.dateVente);
    const a = jours.get(j) ?? { vol: volVide(), commandes: 0 };
    volAjouter(a.vol, volVente);
    a.commandes += 1;
    jours.set(j, a);

    const cNom = `${v.commercial.prenom} ${v.commercial.nom}`;
    const c = commerciaux.get(v.commercialId) ?? { nom: cNom, vol: volVide(), commandes: 0, bureau: v.commercial.role !== "COMMERCIAL" };
    volAjouter(c.vol, volVente);
    c.commandes += 1;
    commerciaux.set(v.commercialId, c);

    if (v.pointVente.nom !== NOM_CLIENT_DIVERS) {
      const q = pvs.get(v.pointVenteId) ?? {
        nom: v.pointVente.nom,
        sous: [v.pointVente.quartier?.nom, v.pointVente.ville?.nom].filter(Boolean).join(", "),
        vol: volVide(),
        commandes: 0,
      };
      volAjouter(q.vol, volVente);
      q.commandes += 1;
      pvs.set(v.pointVenteId, q);
    }
  }
  return { produits, jours, commerciaux, pvs, total, commandes: ventes.length };
}

export async function getRapportPeriodique(type: TypePeriode, ref?: string): Promise<RapportPeriodique> {
  const periode = resoudrePeriodique(type, ref);
  const prec = resoudrePeriodique(type, periode.precedente);
  const [cur, prev, visites, nouveauxPv, caisse] = await Promise.all([
    agreger(periode.du, periode.au),
    agreger(prec.du, prec.au),
    prisma.visite.count({ where: { dateVisite: { gte: debutJour(periode.du), lte: finJour(periode.au) } } }),
    prisma.pointVente.count({ where: { createdAt: { gte: debutJour(periode.du), lte: finJour(periode.au) }, nom: { not: NOM_CLIENT_DIVERS } } }),
    getCaisseResume(debutJour(periode.du), finJour(periode.au)),
  ]);

  const eqTotal = eqDe(cur.total);
  const eqPrec = eqDe(prev.total);
  const variation = (a: number, b: number) => (b > 0 ? Math.round(((a - b) / b) * 1000) / 10 : null);

  const produits: ProduitPeriode[] = [...cur.produits.values()]
    .map((p) => {
      const eq = eqDe(p.vol);
      const avant = prev.produits.get(p.code);
      return {
        code: p.code,
        nom: p.nom,
        vol: p.vol,
        eq,
        partProduit: eqTotal > 0 ? Math.round((eq / eqTotal) * 1000) / 10 : 0,
        parts: partsVente(p.vol),
        variation: avant ? variation(eq, eqDe(avant.vol)) : null,
      };
    })
    .sort((a, b) => b.eq - a.eq);

  // Découpage : un jour par ligne pour la semaine ; une semaine (lundi → dimanche) par ligne pour le mois.
  const jours: JourPeriode[] = [];
  if (type === "semaine") {
    for (let i = 0; i < 7; i++) {
      const j = ajouterJours(periode.du, i);
      const a = cur.jours.get(j);
      jours.push({
        cle: j,
        libelle: new Date(`${j}T12:00:00Z`).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", timeZone: "UTC" }),
        vol: a?.vol ?? volVide(),
        commandes: a?.commandes ?? 0,
      });
    }
  } else {
    const parSemaine = new Map<string, JourPeriode>();
    for (let j = periode.du; j <= periode.au; j = ajouterJours(j, 1)) {
      const dow = new Date(`${j}T00:00:00Z`).getUTCDay();
      let lundi = ajouterJours(j, -((dow + 6) % 7));
      if (lundi < periode.du) lundi = periode.du;
      const fin = ajouterJours(lundi, 6) > periode.au ? periode.au : ajouterJours(lundi, 6);
      const e = parSemaine.get(lundi) ?? { cle: lundi, libelle: `${fr(lundi)} → ${fr(fin)}`, vol: volVide(), commandes: 0 };
      const a = cur.jours.get(j);
      if (a) {
        volAjouter(e.vol, a.vol);
        e.commandes += a.commandes;
      }
      parSemaine.set(lundi, e);
    }
    jours.push(...parSemaine.values());
  }

  const top = <T extends ClassementLigne>(m: Map<string, T>, n: number) =>
    [...m.values()].sort((a, b) => eqDe(b.vol) - eqDe(a.vol)).slice(0, n);
  const commerciaux = top(cur.commerciaux, 20).filter((c) => !c.bureau);
  const bureau = top(cur.commerciaux, 20).filter((c) => c.bureau);
  const bureauTotal: ClassementLigne | null = bureau.length
    ? { nom: "Commandes enregistrées au bureau", sous: "superviseurs et administrateurs", vol: bureau.reduce((s, b) => volAjouter(s, b.vol), volVide()), commandes: bureau.reduce((s, b) => s + b.commandes, 0) }
    : null;

  // Lecture de la période : points clés rédigés pour le marketing.
  const parts = partsVente(cur.total);
  const partsPrec = partsVente(prev.total);
  const lecture: Lecture[] = [];
  const vEq = variation(eqTotal, eqPrec);
  const detailPrec = partsPrec?.detail ?? null;
  if (!parts) {
    lecture.push({ titre: "Aucune vente", texte: "Aucune commande validée sur cette période.", ton: "neutre" });
  } else {
    lecture.push({
      titre: "Répartition des ventes",
      texte: `${pct(parts.cartons)} % du volume est vendu en cartons et ${pct(parts.detail)} % au détail (sachets et filets à l'unité).${
        detailPrec != null ? ` Le détail représentait ${pct(detailPrec)} % sur la période précédente (${parts.detail >= detailPrec ? "+" : "−"}${pct(Math.abs(Math.round((parts.detail - detailPrec) * 10) / 10))} point).` : ""
      }`,
      ton: "info",
    });
  }
  if (vEq != null) {
    lecture.push({
      titre: "Évolution du volume",
      texte: `Volume ${vEq >= 0 ? "en hausse" : "en baisse"} de ${pct(Math.abs(vEq))} % par rapport à ${prec.libelle.toLowerCase()} (${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(eqPrec)} → ${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(eqTotal)} cartons équivalents).`,
      ton: vEq >= 0 ? "bon" : "alerte",
    });
  }
  if (produits[0]) {
    lecture.push({
      titre: "Produit n°1",
      texte: `${produits[0].code} réalise ${pct(produits[0].partProduit)} % du volume${produits[1] ? `, devant ${produits[1].code} (${pct(produits[1].partProduit)} %)` : ""}.`,
      ton: "bon",
    });
  }
  const plusDetail = produits.filter((p) => p.parts && p.eq > 0).sort((a, b) => b.parts!.detail - a.parts!.detail)[0];
  if (plusDetail?.parts && plusDetail.parts.detail > 0) {
    lecture.push({
      titre: "Produit le plus acheté au détail",
      texte: `${plusDetail.code} : ${pct(plusDetail.parts.detail)} % de ses ventes se font à l'unité (${texteDetail(plusDetail.vol)}).`,
      ton: "info",
    });
  }
  const meilleur = [...cur.jours.entries()].sort((a, b) => eqDe(b[1].vol) - eqDe(a[1].vol))[0];
  if (meilleur && eqDe(meilleur[1].vol) > 0) {
    lecture.push({
      titre: "Meilleur jour",
      texte: `${new Date(`${meilleur[0]}T12:00:00Z`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })} : ${meilleur[1].commandes} commande(s), ${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(meilleur[1].vol.gros)} cartons${meilleur[1].vol.sd + meilleur[1].vol.fd > 0 ? ` et ${texteDetail(meilleur[1].vol)} au détail` : ""}.`,
      ton: "bon",
    });
  }
  const actifs = [...cur.commerciaux.values()].filter((c) => !c.bureau).length;
  lecture.push({
    titre: "Activité terrain",
    texte: `${visites} visite(s), ${nouveauxPv} nouveau(x) point(s) de vente recensé(s), ${actifs} commercial(aux) ayant eu au moins une commande validée.`,
    ton: "neutre",
  });

  const nbJours = Math.round((debutJour(periode.au).getTime() - debutJour(periode.du).getTime()) / 86400000) + 1;
  const jl = (j: string) => new Date(`${j}T12:00:00Z`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

  return {
    periode,
    totaux: { vol: cur.total, eq: eqTotal, parts, commandes: cur.commandes, visites, nouveauxPv, variationEq: vEq },
    precedent: { libelle: prec.libelle, eq: eqPrec },
    produits,
    jours,
    commerciaux: bureauTotal ? [...commerciaux, bureauTotal] : commerciaux,
    pointsVente: top(cur.pvs, 10),
    caisse: { encaisse: caisse.recettesJour, depenses: caisse.depensesJour },
    lecture,
    datesLongues: `du ${jl(periode.du)} au ${jl(periode.au)}`,
    nbJours,
  };
}
