import { prisma } from "@/lib/prisma";
import { getCaisse, type Canal } from "@/lib/queries/caisse";
import { SELECT_CONV, volAjouter, volLigne, volVide, type Vol } from "@/lib/utils/cartons-equiv";
import { jourDouala } from "@/lib/utils/periode";

const num = (x: unknown) => Number(x ?? 0);
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

export type BilanProduit = { code: string; nom: string; vol: Vol; montant: number; commandes: number };
export type BilanMois = { cle: string; libelle: string; commandes: number; montant: number; vol: Vol; cumul: number };

/**
 * Bilan des ventes depuis le début de l'activité : toutes les commandes LIVRÉES (marchandise sortie du stock),
 * rapprochées de la caisse (encaissé, reste à encaisser, solde présent).
 */
export async function getBilanVentes() {
  const [commandes, caisse, payeLivrees] = await Promise.all([
    prisma.commande.findMany({
      where: { statut: "LIVREE" },
      select: {
        montantTotal: true,
        dateCommande: true,
        valideeAt: true,
        lignes: { select: { nbSachets: true, nbFilets: true, nbCartons: true, detail: true, montant: true, produit: { select: { code: true, nom: true, ...SELECT_CONV } } } },
      },
    }),
    getCaisse(null, null),
    prisma.paiement.aggregate({ where: { commande: { statut: "LIVREE" } }, _sum: { montant: true } }),
  ]);

  const produits = new Map<string, BilanProduit>();
  const mois = new Map<string, BilanMois>();
  const total = volVide();
  let ventesBrutes = 0;
  let premier: Date | null = null;

  for (const c of commandes) {
    const date = c.valideeAt ?? c.dateCommande;
    if (!premier || date < premier) premier = date;
    const jour = jourDouala(date);
    const cle = jour.slice(0, 7);
    const m = mois.get(cle) ?? { cle, libelle: `${MOIS[Number(cle.slice(5)) - 1]} ${cle.slice(0, 4)}`, commandes: 0, montant: 0, vol: volVide(), cumul: 0 };
    m.commandes += 1;
    m.montant += num(c.montantTotal);
    ventesBrutes += num(c.montantTotal);

    const vus = new Set<string>();
    for (const l of c.lignes) {
      const v = volLigne(l, l.produit);
      volAjouter(total, v);
      volAjouter(m.vol, v);
      const p = produits.get(l.produit.code) ?? { code: l.produit.code, nom: l.produit.nom, vol: volVide(), montant: 0, commandes: 0 };
      volAjouter(p.vol, v);
      p.montant += num(l.montant);
      if (!vus.has(l.produit.code)) {
        vus.add(l.produit.code);
        p.commandes += 1;
      }
      produits.set(l.produit.code, p);
    }
    mois.set(cle, m);
  }

  const moisListe = [...mois.values()].sort((a, b) => a.cle.localeCompare(b.cle));
  let cumul = 0;
  for (const m of moisListe) {
    cumul += m.montant;
    m.cumul = cumul;
  }

  const avoirs = caisse.avoirsMontant;
  const ventesNettes = ventesBrutes - avoirs;
  const encaisse = num(payeLivrees._sum.montant);
  const resteAEncaisser = caisse.creditsTotal;

  return {
    aujourdhui: jourDouala(),
    premierJour: premier ? jourDouala(premier) : null,
    nbCommandes: commandes.length,
    ventesBrutes,
    avoirs,
    ventesNettes,
    encaisse,
    resteAEncaisser,
    ecart: Math.round(ventesNettes - encaisse - resteAEncaisser),
    vol: total,
    produits: [...produits.values()].sort((a, b) => b.montant - a.montant),
    mois: moisListe,
    caisse: {
      solde: caisse.solde as Record<Canal, number>,
      soldeTotal: caisse.soldeTotal,
    },
  };
}
