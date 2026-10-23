// Factures d'avoir (FA) et factures retour (FR). Les lignes sont figées en JSON
// au moment de l'émission : le document reste identique même si les tarifs ou
// les désignations changent ensuite.

import { sousTotal } from "@/lib/utils/tarifs";
import { prisma } from "@/lib/prisma";
import { applyStockMovement, InsufficientStockError } from "@/lib/services/stock";
import { convertToSachets } from "@/lib/services/produits";
import { creditsCommande, rembourserSiTropPercu } from "@/lib/services/compte";
import {
  numeroAvoir,
  numeroRetour,
  type AdresseClient,
  type LigneSource,
} from "@/lib/utils/documents";

export type LigneCorrection = {
  ligneId: string;
  produitId: string;
  source: LigneSource;
};

export type QuantitesLigne = { ligneId: string; nbCartons: number; nbFilets: number; nbSachets: number };

export type CorrectionJson = {
  id: string;
  type: "AVOIR" | "RETOUR";
  numero: string;
  date: string;
  commandeId: string;
  factureOrigine: string | null;
  client: AdresseClient;
  motif: string;
  destination?: string;
  montant: number;
  sources: LigneSource[];
};

const num = (x: unknown) => Number(x ?? 0);

export class CorrectionError extends Error {}

/** Prix de la ligne d'origine pour une unité (retrouvé via le montant si absent). */
function prixUnite(l: { prixCarton: unknown; prixFilet: unknown; prixSachet: unknown; montant: unknown; nbCartons: number; nbFilets: number; nbSachets: number }, unite: "carton" | "filet" | "sachet") {
  const brut = unite === "carton" ? l.prixCarton : unite === "filet" ? l.prixFilet : l.prixSachet;
  if (brut != null && num(brut) > 0) return num(brut);
  const utilisees = [l.nbCartons, l.nbFilets, l.nbSachets].filter((n) => n > 0).length;
  const q = unite === "carton" ? l.nbCartons : unite === "filet" ? l.nbFilets : l.nbSachets;
  if (utilisees === 1 && q > 0 && num(l.montant) > 0) return Math.round(num(l.montant) / q);
  return 0;
}

type Brut = { ligneId: string; produitId: string; source: LigneSource };

async function construireLignes(commandeId: string, demandees: QuantitesLigne[]) {
  const commande = await prisma.commande.findUnique({
    where: { id: commandeId },
    select: {
      id: true,
      montantTotal: true,
      statut: true,
      client: { select: { nom: true } },
      pointVente: {
        select: { nom: true, vendeur: true, repere: true, telephoneVendeur: true, ville: { select: { nom: true } }, quartier: { select: { nom: true } } },
      },
      lignes: {
        select: {
          id: true, produitId: true, nbSachets: true, nbFilets: true, nbCartons: true, detail: true,
          prixSachet: true, prixFilet: true, prixCarton: true, montant: true,
          produit: { select: { code: true, nom: true, designation: true, sachetsParCarton: true, volumeMl: true, sachetsParFilet: true } },
        },
      },
    },
  }) as unknown as {
    id: string; montantTotal: unknown; statut: string; client: { nom: string } | null;
    pointVente: { nom: string; repere: string | null; telephoneVendeur: string | null; ville: { nom: string } | null; quartier: { nom: string } | null };
    lignes: { id: string; produitId: string; nbSachets: number; nbFilets: number; nbCartons: number; detail: boolean; prixSachet: unknown; prixFilet: unknown; prixCarton: unknown; montant: unknown; produit: { code: string; nom: string; designation: string | null; sachetsParCarton: number; volumeMl: number | null; sachetsParFilet: number | null } }[];
  } | null;
  if (!commande) throw new CorrectionError("Commande introuvable.");
  if (commande.statut !== "EN_LIVRAISON" && commande.statut !== "LIVREE") {
    throw new CorrectionError("Seule une commande validée peut faire l'objet d'un avoir ou d'un retour.");
  }

  const retours = await prisma.factureRetour.findMany({ where: { commandeId }, select: { lignes: true } });
  const dejaRendu = new Map<string, { c: number; f: number; s: number }>();
  for (const r of retours) {
    for (const l of (r.lignes as unknown as { ligneId: string; source: LigneSource }[]) ?? []) {
      const cur = dejaRendu.get(l.ligneId) ?? { c: 0, f: 0, s: 0 };
      cur.c += l.source.nbCartons; cur.f += l.source.nbFilets; cur.s += l.source.nbSachets;
      dejaRendu.set(l.ligneId, cur);
    }
  }

  const sortie: Brut[] = [];
  let montant = 0;
  for (const d of demandees) {
    if (d.nbCartons + d.nbFilets + d.nbSachets <= 0) continue;
    const l = commande.lignes.find((x) => x.id === d.ligneId);
    if (!l) throw new CorrectionError("Ligne de commande inconnue.");
    const rendu = dejaRendu.get(l.id) ?? { c: 0, f: 0, s: 0 };
    if (d.nbCartons > l.nbCartons - rendu.c || d.nbFilets > l.nbFilets - rendu.f || d.nbSachets > l.nbSachets - rendu.s) {
      throw new CorrectionError(`Quantité supérieure à ce qui reste facturé pour ${l.produit.nom}.`);
    }
    const pc = prixUnite(l, "carton"), pf = prixUnite(l, "filet"), ps = prixUnite(l, "sachet");
    const m = sousTotal({ carton: pc, filet: pf, sachet: ps }, { cartons: d.nbCartons, filets: d.nbFilets, sachets: d.nbSachets }, l.produit, l.detail);
    montant += m;
    sortie.push({
      ligneId: l.id,
      produitId: l.produitId,
      source: {
        produitCode: l.produit.code,
        produitNom: l.produit.nom,
        designation: l.produit.designation,
        sachetsParCarton: l.produit.sachetsParCarton,
        sachetsParFilet: l.produit.sachetsParFilet,
        volumeMl: l.produit.volumeMl,
        nbCartons: d.nbCartons, nbFilets: d.nbFilets, nbSachets: d.nbSachets,
        prixCarton: pc || null, prixFilet: pf || null, prixSachet: ps || null,
        montant: m,
        detail: l.detail,
      },
    });
  }
  return { commande, lignes: sortie, montant: Math.round(montant) };
}

function versClient(pv: { nom: string; vendeur?: string | null; repere: string | null; telephoneVendeur: string | null; ville: { nom: string } | null; quartier: { nom: string } | null }, clientNom?: string | null): AdresseClient {
  return { signataire: clientNom || pv.vendeur || pv.nom, nom: pv.nom, ville: pv.ville?.nom ?? null, quartier: pv.quartier?.nom ?? null, repere: pv.repere, telephone: pv.telephoneVendeur };
}

async function numeroFactureOrigine(commandeId: string) {
  const f = await prisma.facture.findUnique({ where: { commandeId }, select: { numero: true } });
  if (!f) return null;
  const { numeroFacture } = await import("@/lib/utils/documents");
  return numeroFacture(f.numero);
}

export type AvoirResultat = CorrectionJson & { remboursement: number; canalRemboursement: string | null };

export async function creerAvoir(params: {
  commandeId: string; motif: string; lignes: QuantitesLigne[]; montantLibre?: number; canal?: "ESPECES" | "MOBILE_MONEY" | "BANQUE"; userId: string;
}): Promise<AvoirResultat> {
  const { commande, lignes, montant } = await construireLignes(params.commandeId, params.lignes);
  const final = lignes.length > 0 ? montant : Math.round(params.montantLibre ?? 0);
  if (final <= 0) throw new CorrectionError("Indiquez des quantités ou un montant à créditer.");
  const avant = await creditsCommande(prisma, params.commandeId);
  if (avant.credits + final > avant.total + 0.5) {
    throw new CorrectionError("Le total des avoirs et des retours dépasserait le montant de la commande.");
  }

  const { avoir, remboursement } = await prisma.$transaction(async (tx) => {
    const avoir = await tx.factureAvoir.create({
      data: {
        commandeId: params.commandeId, motif: params.motif, montant: final,
        lignes: lignes as never, createdById: params.userId,
      },
    });

    // Effet sur la caisse : si le client avait déjà payé plus que ce qu'il doit
    // après l'avoir, la différence lui est remboursée (sortie de caisse). Sinon,
    // l'avoir réduit seulement ce qu'il reste à encaisser.
    const remboursement = await rembourserSiTropPercu(tx, {
      commandeId: params.commandeId,
      canal: params.canal ?? "ESPECES",
      userId: params.userId,
      reference: { type: "AVOIR", id: avoir.id, libelle: numeroAvoir(avoir.numero) },
      pointVenteNom: commande.pointVente.nom,
    });
    return { avoir, remboursement };
  });

  return {
    id: avoir.id, type: "AVOIR", numero: numeroAvoir(avoir.numero), date: avoir.createdAt.toISOString(),
    commandeId: params.commandeId, factureOrigine: await numeroFactureOrigine(params.commandeId),
    client: versClient(commande.pointVente, commande.client?.nom), motif: avoir.motif, montant: final,
    sources: lignes.map((l) => l.source),
    remboursement,
    canalRemboursement: remboursement > 0 ? params.canal ?? "ESPECES" : null,
  };
}

export async function creerRetour(params: {
  commandeId: string; motif: string; lignes: QuantitesLigne[]; destination: "STOCK" | "AVARIES"; creerAvoir: boolean; canal?: "ESPECES" | "MOBILE_MONEY" | "BANQUE"; userId: string;
}): Promise<{ retour: CorrectionJson & { remboursement: number }; avoir: CorrectionJson | null }> {
  const { commande, lignes, montant } = await construireLignes(params.commandeId, params.lignes);
  if (lignes.length === 0) throw new CorrectionError("Indiquez au moins une quantité retournée.");
  // Le stock n'est débité qu'à la livraison : un retour n'a de sens (et ne remet en stock) qu'après.
  if (commande.statut !== "LIVREE") {
    throw new CorrectionError("Un retour n'est possible qu'une fois la commande livrée (le stock n'est débité qu'à la livraison). Utilisez une facture d'avoir pour corriger avant.");
  }
  // Le retour est un crédit sur le compte du client : avoirs + retours ne peuvent pas dépasser la facture.
  const avant = await creditsCommande(prisma, params.commandeId);
  if (avant.credits + montant > avant.total + 0.5) {
    throw new CorrectionError("Le total des avoirs et des retours dépasserait le montant de la commande.");
  }

  // Quantités à remettre en stock, par produit (en sachets).
  const parProduit = new Map<string, number>();
  const produits = await prisma.produit.findMany({
    where: { id: { in: lignes.map((l) => l.produitId) } },
    select: { id: true, sachetsParFilet: true, sachetsParCarton: true },
  });
  for (const l of lignes) {
    const p = produits.find((x) => x.id === l.produitId);
    if (!p) continue;
    parProduit.set(l.produitId, (parProduit.get(l.produitId) ?? 0) + convertToSachets(p, l.source));
  }

  const resultat = await prisma.$transaction(async (tx) => {
    const retour = await tx.factureRetour.create({
      data: {
        commandeId: params.commandeId, motif: params.motif, destination: params.destination,
        montant, lignes: lignes as never, createdById: params.userId,
      },
    });
    for (const [produitId, sachets] of parProduit) {
      if (sachets <= 0) continue;
      await applyStockMovement(tx, {
        uuidClient: `retour-${retour.id}-${produitId}-in`,
        produitId, type: "ENTREE", quantiteSachets: sachets,
        referenceType: "RETOUR", referenceId: retour.id,
        note: `Retour client (${params.motif})`,
      });
      if (params.destination === "AVARIES") {
        // Marchandise abîmée : elle ressort aussitôt du stock vendable, en avarie.
        await applyStockMovement(tx, {
          uuidClient: `retour-${retour.id}-${produitId}-avarie`,
          produitId, type: "SORTIE", quantiteSachets: sachets,
          referenceType: "AVARIE", referenceId: retour.id,
          note: `Retour client abîmé (${params.motif})`,
        });
      }
    }
    let avoir = null;
    if (params.creerAvoir && montant > 0) {
      avoir = await tx.factureAvoir.create({
        data: {
          commandeId: params.commandeId, retourId: retour.id, motif: `Retour de marchandise : ${params.motif}`,
          montant, lignes: lignes as never, createdById: params.userId,
        },
      });
    }
    // Le retour réduit ce que le client doit ; s'il avait déjà trop payé, la différence lui est remboursée.
    const remboursement = await rembourserSiTropPercu(tx, {
      commandeId: params.commandeId,
      canal: params.canal ?? "ESPECES",
      userId: params.userId,
      reference: { type: "RETOUR", id: retour.id, libelle: numeroRetour(retour.numero) },
      pointVenteNom: commande.pointVente.nom,
    });
    return { retour, avoir, remboursement };
  });

  const origine = await numeroFactureOrigine(params.commandeId);
  const client = versClient(commande.pointVente, commande.client?.nom);
  const sources = lignes.map((l) => l.source);
  return {
    retour: {
      id: resultat.retour.id, type: "RETOUR", numero: numeroRetour(resultat.retour.numero),
      date: resultat.retour.createdAt.toISOString(), commandeId: params.commandeId, factureOrigine: origine,
      client, motif: params.motif, destination: params.destination, montant, sources,
      remboursement: resultat.remboursement,
    },
    avoir: resultat.avoir
      ? {
          id: resultat.avoir.id, type: "AVOIR", numero: numeroAvoir(resultat.avoir.numero),
          date: resultat.avoir.createdAt.toISOString(), commandeId: params.commandeId, factureOrigine: origine,
          client, motif: resultat.avoir.motif, montant, sources,
        }
      : null,
  };
}

export { InsufficientStockError };

const selectPv = {
  nom: true, vendeur: true, repere: true, telephoneVendeur: true,
  ville: { select: { nom: true } }, quartier: { select: { nom: true } },
} as const;

/** Dernières factures d'avoir ou de retour, prêtes à être (ré)imprimées. */
export async function listerCorrections(type: "AVOIR" | "RETOUR", limite = 100): Promise<CorrectionJson[]> {
  const rows =
    type === "AVOIR"
      ? await prisma.factureAvoir.findMany({ orderBy: { createdAt: "desc" }, take: limite })
      : await prisma.factureRetour.findMany({ orderBy: { createdAt: "desc" }, take: limite });
  if (rows.length === 0) return [];

  const ids = Array.from(new Set(rows.map((r) => r.commandeId)));
  const [commandes, factures] = await Promise.all([
    prisma.commande.findMany({ where: { id: { in: ids } }, select: { id: true, client: { select: { nom: true } }, pointVente: { select: selectPv } } }),
    prisma.facture.findMany({ where: { commandeId: { in: ids } }, select: { commandeId: true, numero: true } }),
  ]);
  const { numeroFacture } = await import("@/lib/utils/documents");

  return rows.map((r) => {
    const c = commandes.find((x) => x.id === r.commandeId);
    const f = factures.find((x) => x.commandeId === r.commandeId);
    const lignes = (r.lignes as unknown as { source: LigneSource }[]) ?? [];
    return {
      id: r.id,
      type,
      numero: type === "AVOIR" ? numeroAvoir(r.numero) : numeroRetour(r.numero),
      date: r.createdAt.toISOString(),
      commandeId: r.commandeId,
      factureOrigine: f ? numeroFacture(f.numero) : null,
      client: c ? versClient(c.pointVente, c.client?.nom) : { nom: "—", ville: null, quartier: null, repere: null, telephone: null },
      motif: r.motif,
      destination: "destination" in r ? (r as { destination: string }).destination : undefined,
      montant: num(r.montant),
      sources: lignes.map((l) => l.source),
    };
  });
}
