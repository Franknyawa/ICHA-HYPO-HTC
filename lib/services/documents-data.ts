// Données des documents imprimés (facture, bon de livraison). La numérotation
// passe par la base (compteur auto-incrémenté) : deux documents ne peuvent
// jamais recevoir le même numéro, même si deux admins impriment en même temps.

import { prisma } from "@/lib/prisma";
import {
  libelleModePaiement,
  numeroBonLivraison,
  numeroFacture,
  type AdresseClient,
  type LigneSource,
} from "@/lib/utils/documents";

export type TypeDocument = "VENTE" | "COMMANDE";

export type FactureJson = {
  numero: string;
  date: string;
  agentId: string | null;
  agentNom: string | null;
  client: AdresseClient;
  sources: LigneSource[];
  montantTotal: number;
  modePaiement: string | null;
  modePaiementLabel: string;
  dejaRegle: number;
};

export type BonLivraisonJson = {
  numero: string;
  date: string;
  agentNom: string | null;
  client: AdresseClient;
  sources: LigneSource[];
};

const num = (x: unknown) => Number(x ?? 0);

const selectLigne = {
  nbSachets: true,
  nbFilets: true,
  nbCartons: true,
  prixSachet: true,
  prixFilet: true,
  prixCarton: true,
  montant: true,
  produit: { select: { code: true, nom: true, designation: true, sachetsParCarton: true, volumeMl: true } },
} as const;

const selectPointVente = {
  nom: true,
  repere: true,
  telephoneVendeur: true,
  vendeur: true,
  ville: { select: { nom: true } },
  quartier: { select: { nom: true } },
} as const;

type LigneBrute = {
  nbSachets: number;
  nbFilets: number;
  nbCartons: number;
  prixSachet: unknown;
  prixFilet: unknown;
  prixCarton: unknown;
  montant: unknown;
  produit: { code: string; nom: string; designation: string | null; sachetsParCarton: number; volumeMl: number | null };
};

function versSources(lignes: LigneBrute[]): LigneSource[] {
  return lignes.map((l) => ({
    produitCode: l.produit.code,
    produitNom: l.produit.nom,
    designation: l.produit.designation,
    sachetsParCarton: l.produit.sachetsParCarton,
    volumeMl: l.produit.volumeMl,
    nbSachets: l.nbSachets,
    nbFilets: l.nbFilets,
    nbCartons: l.nbCartons,
    prixSachet: l.prixSachet == null ? null : num(l.prixSachet),
    prixFilet: l.prixFilet == null ? null : num(l.prixFilet),
    prixCarton: l.prixCarton == null ? null : num(l.prixCarton),
    montant: num(l.montant),
  }));
}

type PointVenteBrut = {
  nom: string;
  repere: string | null;
  telephoneVendeur: string | null;
  ville: { nom: string } | null;
  quartier: { nom: string } | null;
};

function versClient(pv: PointVenteBrut): AdresseClient {
  return {
    nom: pv.nom,
    ville: pv.ville?.nom ?? null,
    quartier: pv.quartier?.nom ?? null,
    repere: pv.repere,
    telephone: pv.telephoneVendeur,
  };
}

async function agentParDefaut() {
  const agents = await prisma.agentFacturation.findMany({ where: { actif: true }, orderBy: { createdAt: "asc" } });
  return agents.find((a) => a.nom.toUpperCase() === "NSINZE SABA") ?? agents[0] ?? null;
}

/** Crée la facture au premier appel (numéro attribué) puis la retrouve ; l'agent peut être changé. */
export async function obtenirFacture(type: TypeDocument, id: string, agentId?: string | null): Promise<FactureJson | null> {
  let doc: {
    montantTotal: unknown;
    modePaiement: string | null;
    pointVente: PointVenteBrut;
    lignes: LigneBrute[];
    paiements: { montant: unknown; modePaiement: string }[];
  } | null;

  if (type === "VENTE") {
    doc = await prisma.vente.findUnique({
      where: { id },
      select: {
        montantTotal: true,
        modePaiement: true,
        pointVente: { select: selectPointVente },
        lignes: { select: selectLigne },
        paiements: { select: { montant: true, modePaiement: true }, orderBy: { datePaiement: "desc" } },
      },
    });
  } else {
    doc = await prisma.commande.findUnique({
      where: { id },
      select: {
        montantTotal: true,
        modePaiement: true,
        pointVente: { select: selectPointVente },
        lignes: { select: selectLigne },
        paiements: { select: { montant: true, modePaiement: true }, orderBy: { datePaiement: "desc" } },
      },
    });
  }
  if (!doc) return null;

  const cle = type === "VENTE" ? { venteId: id } : { commandeId: id };
  let facture = await prisma.facture.findUnique({ where: cle, include: { agent: true } });
  if (!facture) {
    const agent = agentId
      ? await prisma.agentFacturation.findUnique({ where: { id: agentId } })
      : await agentParDefaut();
    try {
      facture = await prisma.facture.create({ data: { ...cle, agentId: agent?.id ?? null }, include: { agent: true } });
    } catch {
      // Deux impressions simultanées : on reprend celle qui a gagné.
      facture = await prisma.facture.findUnique({ where: cle, include: { agent: true } });
    }
  } else if (agentId && agentId !== facture.agentId) {
    const agent = await prisma.agentFacturation.findUnique({ where: { id: agentId } });
    if (agent) facture = await prisma.facture.update({ where: { id: facture.id }, data: { agentId }, include: { agent: true } });
  }
  if (!facture) return null;

  const sources = versSources(doc.lignes);
  const sommeLignes = sources.reduce((s, l) => s + (l.montant ?? 0), 0);
  const montantTotal = num(doc.montantTotal) > 0 ? num(doc.montantTotal) : sommeLignes;
  const mode = doc.modePaiement ?? doc.paiements[0]?.modePaiement ?? null;

  return {
    numero: numeroFacture(facture.numero),
    date: facture.createdAt.toISOString(),
    agentId: facture.agentId,
    agentNom: facture.agent?.nom ?? null,
    client: versClient(doc.pointVente),
    sources,
    montantTotal,
    modePaiement: mode,
    modePaiementLabel: libelleModePaiement(mode),
    dejaRegle: doc.paiements.reduce((s, p) => s + num(p.montant), 0),
  };
}

export async function obtenirBonLivraison(commandeId: string): Promise<BonLivraisonJson | null> {
  const c = await prisma.commande.findUnique({
    where: { id: commandeId },
    select: {
      pointVente: { select: selectPointVente },
      lignes: { select: selectLigne },
    },
  });
  if (!c) return null;

  let bon = await prisma.bonLivraison.findUnique({ where: { commandeId } });
  if (!bon) {
    try {
      bon = await prisma.bonLivraison.create({ data: { commandeId } });
    } catch {
      bon = await prisma.bonLivraison.findUnique({ where: { commandeId } });
    }
  }
  if (!bon) return null;
  const agent = await agentParDefaut();
  return {
    numero: numeroBonLivraison(bon.numero),
    date: bon.createdAt.toISOString(),
    agentNom: agent?.nom ?? null,
    client: versClient(c.pointVente),
    sources: versSources(c.lignes),
  };
}
