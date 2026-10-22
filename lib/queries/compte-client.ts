// Relevé de compte d'un point de vente (client), façon logiciel comptable :
// journal chronologique Débit / Crédit avec solde cumulé, et récapitulatif par facture.

import { prisma } from "@/lib/prisma";
import { assurerMontantsConformes } from "@/lib/services/recalcul-prix";
import { numeroAvoir, numeroFacture, numeroRetour, libelleModePaiement } from "@/lib/utils/documents";

const num = (x: unknown) => Number(x ?? 0);

export type TypeEcriture = "FACTURE" | "PAIEMENT" | "AVOIR" | "RETOUR" | "REMBOURSEMENT";

export type EcritureCompte = {
  cle: string;
  date: Date;
  type: TypeEcriture;
  piece: string;
  libelle: string;
  /** Ce que le client nous doit en plus. */
  debit: number;
  /** Ce qui réduit sa dette. */
  credit: number;
  /** Solde cumulé après cette écriture (> 0 : le client doit). */
  solde: number;
};

export type FactureCompte = {
  commandeId: string;
  piece: string;
  date: Date;
  statut: string;
  produits: string;
  montant: number;
  avoirs: number;
  retours: number;
  paye: number;
  rembourse: number;
  reste: number;
};

export type CompteClient = {
  totalFacture: number;
  totalAvoirs: number;
  totalRetours: number;
  totalPaye: number;
  totalRembourse: number;
  /** Solde dû par le client (≥ 0). */
  soldeDu: number;
  enAttente: { id: string; date: Date; montant: number; produits: string }[];
  factures: FactureCompte[];
  ecritures: EcritureCompte[];
};

export async function getCompteClient(pointVenteId: string): Promise<CompteClient> {
  await assurerMontantsConformes();
  const commandes = await prisma.commande.findMany({
    where: { pointVenteId, statut: { in: ["EN_ATTENTE", "EN_LIVRAISON", "LIVREE"] } },
    orderBy: { dateCommande: "asc" },
    select: {
      id: true,
      statut: true,
      dateCommande: true,
      valideeAt: true,
      montantTotal: true,
      lignes: { select: { nbCartons: true, nbFilets: true, nbSachets: true, produit: { select: { code: true } } } },
    },
  });
  const validees = commandes.filter((c) => c.statut !== "EN_ATTENTE");
  const ids = validees.map((c) => c.id);

  const [factures, paiements, avoirs, retours] = ids.length
    ? await Promise.all([
        prisma.facture.findMany({ where: { commandeId: { in: ids } }, select: { commandeId: true, numero: true } }),
        prisma.paiement.findMany({ where: { commandeId: { in: ids } }, select: { id: true, commandeId: true, montant: true, modePaiement: true, datePaiement: true } }),
        prisma.factureAvoir.findMany({ where: { commandeId: { in: ids } }, select: { id: true, commandeId: true, numero: true, montant: true, motif: true, retourId: true, createdAt: true } }),
        prisma.factureRetour.findMany({ where: { commandeId: { in: ids } }, select: { id: true, commandeId: true, numero: true, montant: true, motif: true, destination: true, createdAt: true } }),
      ])
    : [[], [], [], []];

  const refIds = [...avoirs.map((a) => a.id), ...retours.map((r) => r.id)];
  const remboursements = refIds.length
    ? await prisma.operationCaisse.findMany({
        where: { type: "DEPENSE", referenceType: { in: ["AVOIR", "RETOUR"] }, referenceId: { in: refIds } },
        select: { id: true, montant: true, canal: true, dateOperation: true, referenceType: true, referenceId: true },
      })
    : [];

  const commandeDe = new Map<string, string>(); // id d'avoir/retour -> commande
  for (const a of avoirs) commandeDe.set(a.id, a.commandeId);
  for (const r of retours) commandeDe.set(r.id, r.commandeId);
  const pieceFacture = new Map(factures.map((f) => [f.commandeId as string, numeroFacture(f.numero)]));
  const retoursAvecAvoir = new Set(avoirs.map((a) => a.retourId).filter(Boolean));

  const resume = (lignes: { nbCartons: number; nbFilets: number; nbSachets: number; produit: { code: string } }[]) =>
    lignes
      .map((l) => `${l.produit.code} ${l.nbCartons > 0 ? `${l.nbCartons} ct` : l.nbFilets > 0 ? `${l.nbFilets} filets` : `${l.nbSachets} sachets`}`)
      .join(", ") || "—";

  // --- Écritures --------------------------------------------------------
  const brutes: Omit<EcritureCompte, "solde">[] = [];
  for (const c of validees) {
    const piece = pieceFacture.get(c.id) ?? "Facture à émettre";
    brutes.push({ cle: `F${c.id}`, date: c.valideeAt ?? c.dateCommande, type: "FACTURE", piece, libelle: `Facture — ${resume(c.lignes)}`, debit: num(c.montantTotal), credit: 0 });
  }
  for (const p of paiements) {
    brutes.push({ cle: `P${p.id}`, date: p.datePaiement, type: "PAIEMENT", piece: pieceFacture.get(p.commandeId as string) ?? "—", libelle: `Encaissement — ${libelleModePaiement(p.modePaiement)}`, debit: 0, credit: num(p.montant) });
  }
  for (const a of avoirs) {
    brutes.push({ cle: `A${a.id}`, date: a.createdAt, type: "AVOIR", piece: numeroAvoir(a.numero), libelle: `Facture d'avoir — ${a.motif}`, debit: 0, credit: num(a.montant) });
  }
  for (const r of retours) {
    // Un retour accompagné d'un avoir (anciens documents) n'est pas compté deux fois.
    const credit = retoursAvecAvoir.has(r.id) ? 0 : num(r.montant);
    brutes.push({
      cle: `R${r.id}`, date: r.createdAt, type: "RETOUR", piece: numeroRetour(r.numero),
      libelle: `Facture retour (${r.destination === "AVARIES" ? "avaries" : "retour en stock"}) — ${r.motif}`,
      debit: 0, credit,
    });
  }
  for (const o of remboursements) {
    const cmd = commandeDe.get(o.referenceId as string);
    brutes.push({
      cle: `B${o.id}`, date: o.dateOperation, type: "REMBOURSEMENT",
      piece: pieceFacture.get(cmd as string) ?? "—",
      libelle: `Remboursement au client (${o.canal === "ESPECES" ? "espèces" : o.canal === "MOBILE_MONEY" ? "OM/MOMO" : "banque"})`,
      debit: num(o.montant), credit: 0,
    });
  }
  const ordre: Record<TypeEcriture, number> = { FACTURE: 0, PAIEMENT: 1, AVOIR: 2, RETOUR: 3, REMBOURSEMENT: 4 };
  brutes.sort((a, b) => a.date.getTime() - b.date.getTime() || ordre[a.type] - ordre[b.type]);
  let cumul = 0;
  const ecritures: EcritureCompte[] = brutes.map((e) => {
    cumul += e.debit - e.credit;
    return { ...e, solde: cumul };
  });

  // --- Récapitulatif par facture -----------------------------------------
  const lignesFactures: FactureCompte[] = validees.map((c) => {
    const av = avoirs.filter((a) => a.commandeId === c.id).reduce((s, a) => s + num(a.montant), 0);
    const re = retours.filter((r) => r.commandeId === c.id && !retoursAvecAvoir.has(r.id)).reduce((s, r) => s + num(r.montant), 0);
    const pa = paiements.filter((p) => p.commandeId === c.id).reduce((s, p) => s + num(p.montant), 0);
    const rb = remboursements.filter((o) => commandeDe.get(o.referenceId as string) === c.id).reduce((s, o) => s + num(o.montant), 0);
    const montant = num(c.montantTotal);
    return {
      commandeId: c.id,
      piece: pieceFacture.get(c.id) ?? "À émettre",
      date: c.valideeAt ?? c.dateCommande,
      statut: c.statut,
      produits: resume(c.lignes),
      montant, avoirs: av, retours: re, paye: pa, rembourse: rb,
      reste: Math.max(0, montant - av - re - (pa - rb)),
    };
  });

  const somme = (k: "montant" | "avoirs" | "retours" | "paye" | "rembourse") => lignesFactures.reduce((s, f) => s + f[k], 0);
  return {
    totalFacture: somme("montant"),
    totalAvoirs: somme("avoirs"),
    totalRetours: somme("retours"),
    totalPaye: somme("paye"),
    totalRembourse: somme("rembourse"),
    soldeDu: lignesFactures.reduce((s, f) => s + f.reste, 0),
    enAttente: commandes.filter((c) => c.statut === "EN_ATTENTE").map((c) => ({ id: c.id, date: c.dateCommande, montant: num(c.montantTotal), produits: resume(c.lignes) })),
    factures: lignesFactures.reverse(),
    ecritures,
  };
}
