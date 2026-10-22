import { prisma } from "@/lib/prisma";
import { sousTotal } from "@/lib/utils/tarifs";

/**
 * Remet les montants déjà enregistrés en conformité avec la règle « base carton » :
 * un demi-carton (56 sachets HYPO, 60 sachets / 6 filets HTC) vaut le demi-prix du carton.
 * Les prix unitaires figés sur chaque ligne sont conservés ; seuls les montants de ligne
 * et les totaux des commandes / ventes sont recalculés. GET = simulation, POST = application.
 */
const DETAIL = { OR: [{ nbSachets: { gt: 0 } }, { nbFilets: { gt: 0 } }] };

export async function recalculerMontants(appliquer: boolean, seulementDetail = false) {
  const produitSel = { sachetsParCarton: true, sachetsParFilet: true, prixSachet: true, prixFilet: true, prixCarton: true } as const;

  const calcul = (l: {
    nbSachets: number; nbFilets: number; nbCartons: number;
    prixSachet: unknown; prixFilet: unknown; prixCarton: unknown;
    produit: { sachetsParCarton: number; sachetsParFilet: number | null; prixSachet: unknown; prixFilet: unknown; prixCarton: unknown };
  }) =>
    sousTotal(
      {
        sachet: Number(l.prixSachet ?? l.produit.prixSachet),
        filet: Number(l.prixFilet ?? l.produit.prixFilet ?? 0),
        carton: Number(l.prixCarton ?? l.produit.prixCarton),
      },
      { sachets: l.nbSachets, filets: l.nbFilets, cartons: l.nbCartons },
      l.produit
    );

  let lignesModifiees = 0;
  let commandesModifiees = 0;
  let ventesModifiees = 0;
  let ecart = 0;

  const commandes = await prisma.commande.findMany({
    where: { statut: { not: "ANNULEE" }, ...(seulementDetail ? { lignes: { some: DETAIL } } : {}) },
    select: {
      id: true,
      montantTotal: true,
      lignes: { select: { id: true, montant: true, nbSachets: true, nbFilets: true, nbCartons: true, prixSachet: true, prixFilet: true, prixCarton: true, produit: { select: produitSel } } },
    },
  });
  for (const c of commandes) {
    const nouvelles = c.lignes.map((l) => ({ id: l.id, ancien: Number(l.montant), nouveau: calcul(l) }));
    const changes = nouvelles.filter((x) => x.ancien !== x.nouveau);
    if (changes.length === 0) continue;
    const total = nouvelles.reduce((s, x) => s + x.nouveau, 0);
    lignesModifiees += changes.length;
    commandesModifiees += 1;
    ecart += total - Number(c.montantTotal);
    if (appliquer) {
      await prisma.$transaction([
        ...changes.map((x) => prisma.commandeLigne.update({ where: { id: x.id }, data: { montant: x.nouveau } })),
        prisma.commande.update({ where: { id: c.id }, data: { montantTotal: total } }),
      ]);
    }
  }

  const ventes = await prisma.vente.findMany({
    where: seulementDetail ? { lignes: { some: DETAIL } } : undefined,
    select: {
      id: true,
      montantTotal: true,
      lignes: { select: { id: true, montant: true, nbSachets: true, nbFilets: true, nbCartons: true, prixSachet: true, prixFilet: true, prixCarton: true, produit: { select: produitSel } } },
    },
  });
  for (const v of ventes) {
    const nouvelles = v.lignes.map((l) => ({ id: l.id, ancien: Number(l.montant), nouveau: calcul(l) }));
    const changes = nouvelles.filter((x) => x.ancien !== x.nouveau);
    if (changes.length === 0) continue;
    const total = nouvelles.reduce((s, x) => s + x.nouveau, 0);
    ventesModifiees += 1;
    if (appliquer) {
      await prisma.$transaction([
        ...changes.map((x) => prisma.venteLigne.update({ where: { id: x.id }, data: { montant: x.nouveau } })),
        prisma.vente.update({ where: { id: v.id }, data: { montantTotal: total } }),
      ]);
    }
  }

  return { appliquer, lignesModifiees, commandesModifiees, ventesModifiees, ecart: Math.round(ecart) };
}


let dernierControle = 0;
/** Mise en conformité automatique (au plus une fois par minute et par instance) : appelée par les pages admin. */
export async function assurerMontantsConformes() {
  if (Date.now() - dernierControle < 60_000) return;
  dernierControle = Date.now();
  try {
    await recalculerMontants(true, true);
  } catch (e) {
    console.error("Mise en conformité des montants impossible", e);
  }
}
