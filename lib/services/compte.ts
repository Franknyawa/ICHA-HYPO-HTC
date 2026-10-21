// Compte client — règles comptables, centralisées pour que la caisse, les
// encaissements, les avoirs, les retours et le profil client donnent TOUS le
// même chiffre.
//
//   DÉBIT  (ce que le client nous doit)  : facture = commande validée.
//   CRÉDIT (ce qui réduit sa dette)      : paiements, factures d'avoir, factures retour.
//   REMBOURSEMENT : si le client a déjà trop payé après un avoir/retour, on lui
//   rend la différence (sortie de caisse) ; c'est un débit de plus sur son compte.
//
//   Solde dû = facturé − avoirs − retours − paiements + remboursements.

import type { Prisma, PrismaClient } from "@prisma/client";

type Tx = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"> | Prisma.TransactionClient;

const num = (x: unknown) => Number(x ?? 0);

export type CreditsCommande = {
  total: number;
  avoirs: number;
  retours: number;
  paye: number;
  rembourse: number;
  /** avoirs + retours */
  credits: number;
  /** Net facturé après avoirs et retours. */
  net: number;
  /** Reste à encaisser (≥ 0). */
  du: number;
};

export async function creditsCommande(tx: Tx, commandeId: string): Promise<CreditsCommande> {
  const [commande, avoirs, retours, paiements] = await Promise.all([
    tx.commande.findUnique({ where: { id: commandeId }, select: { montantTotal: true } }),
    tx.factureAvoir.findMany({ where: { commandeId }, select: { id: true, montant: true, retourId: true } }),
    tx.factureRetour.findMany({ where: { commandeId }, select: { id: true, montant: true } }),
    tx.paiement.aggregate({ where: { commandeId }, _sum: { montant: true } }),
  ]);
  const total = num(commande?.montantTotal);
  const sommeAvoirs = avoirs.reduce((s, a) => s + num(a.montant), 0);
  // Un retour déjà accompagné d'un avoir (anciens documents) ne compte qu'une fois.
  const retoursAvecAvoir = new Set(avoirs.map((a) => a.retourId).filter(Boolean));
  const sommeRetours = retours.filter((r) => !retoursAvecAvoir.has(r.id)).reduce((s, r) => s + num(r.montant), 0);
  const ids = [...avoirs.map((a) => a.id), ...retours.map((r) => r.id)];
  const rembourse = ids.length
    ? num(
        (
          await tx.operationCaisse.aggregate({
            where: { type: "DEPENSE", referenceType: { in: ["AVOIR", "RETOUR"] }, referenceId: { in: ids } },
            _sum: { montant: true },
          })
        )._sum.montant
      )
    : 0;
  const paye = num(paiements._sum.montant);
  const credits = sommeAvoirs + sommeRetours;
  const net = total - credits;
  const du = Math.max(0, net - (paye - rembourse));
  return { total, avoirs: sommeAvoirs, retours: sommeRetours, paye, rembourse, credits, net, du };
}

/**
 * Si, après un avoir ou un retour, le client a payé plus que le net facturé,
 * la différence lui est remboursée : sortie de caisse (non comptée comme dépense).
 * Retourne le montant remboursé (0 si rien à rendre).
 */
export async function rembourserSiTropPercu(
  tx: Tx,
  p: {
    commandeId: string;
    canal: "ESPECES" | "MOBILE_MONEY" | "BANQUE";
    userId: string;
    reference: { type: "AVOIR" | "RETOUR"; id: string; libelle: string };
    pointVenteNom: string;
  }
): Promise<number> {
  const c = await creditsCommande(tx, p.commandeId);
  const aRembourser = Math.round(c.paye - c.rembourse - c.net);
  if (aRembourser <= 0) return 0;
  await tx.operationCaisse.create({
    data: {
      type: "DEPENSE",
      canal: p.canal,
      montant: aRembourser,
      categorie: p.reference.type === "AVOIR" ? "Remboursement avoir" : "Remboursement retour",
      note: `${p.reference.libelle} · ${p.pointVenteNom}`,
      referenceType: p.reference.type,
      referenceId: p.reference.id,
      createdById: p.userId,
    },
  });
  return aRembourser;
}

/**
 * Reste dû d'une vente terrain qui a une commande liée : c'est la commande qui porte
 * les encaissements, avoirs et retours. Renvoie null pour une vente sans commande liée
 * (ancien fonctionnement : on se base alors sur ses propres paiements).
 */
export async function dusParVente(tx: Tx, venteIds: string[]): Promise<Map<string, number | null>> {
  const res = new Map<string, number | null>();
  if (venteIds.length === 0) return res;
  const commandes = await tx.commande.findMany({
    where: { venteId: { in: venteIds } },
    select: { id: true, venteId: true, statut: true, montantTotal: true },
  });
  for (const id of venteIds) res.set(id, null);
  for (const c of commandes) {
    if (!c.venteId) continue;
    if (c.statut === "ANNULEE") res.set(c.venteId, 0);
    else if (c.statut === "EN_ATTENTE") res.set(c.venteId, num(c.montantTotal));
    else res.set(c.venteId, (await creditsCommande(tx, c.id)).du);
  }
  return res;
}
