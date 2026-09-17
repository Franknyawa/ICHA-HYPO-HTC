import { prisma } from "@/lib/prisma";
import type { TypeAlerte } from "@prisma/client";

// Seuils par défaut si jamais réglés en back office — voir
// /admin/parametres, section "Seuils des alertes".
const SEUILS_DEFAUT = {
  joursCreditRetard: 7,
  joursProspectARelancer: 5,
  joursClientInactif: 30,
  joursLivraisonProche: 2,
};

const CLES_SEUILS: Record<keyof typeof SEUILS_DEFAUT, string> = {
  joursCreditRetard: "seuil_jours_credit_retard",
  joursProspectARelancer: "seuil_jours_prospect_a_relancer",
  joursClientInactif: "seuil_jours_client_inactif",
  joursLivraisonProche: "seuil_jours_livraison_proche",
};

export async function getSeuilsAlertes() {
  const rows = await prisma.parametreSysteme.findMany({
    where: { cle: { in: Object.values(CLES_SEUILS) } },
  });
  const parCle = new Map(rows.map((r) => [r.cle, Number(r.valeur)]));

  return {
    joursCreditRetard: parCle.get(CLES_SEUILS.joursCreditRetard) ?? SEUILS_DEFAUT.joursCreditRetard,
    joursProspectARelancer:
      parCle.get(CLES_SEUILS.joursProspectARelancer) ?? SEUILS_DEFAUT.joursProspectARelancer,
    joursClientInactif: parCle.get(CLES_SEUILS.joursClientInactif) ?? SEUILS_DEFAUT.joursClientInactif,
    joursLivraisonProche:
      parCle.get(CLES_SEUILS.joursLivraisonProche) ?? SEUILS_DEFAUT.joursLivraisonProche,
  };
}

export { CLES_SEUILS };

/**
 * Crée une alerte si aucune alerte NON RÉSOLUE identique (même type + même
 * entité) n'existe déjà — évite d'empiler des doublons à chaque exécution
 * du job pour un problème qui persiste simplement d'un jour sur l'autre.
 */
async function creerAlerteSiAbsente(params: {
  type: TypeAlerte;
  message: string;
  entiteType: string;
  entiteId: string;
}) {
  const existante = await prisma.alerte.findFirst({
    where: {
      type: params.type,
      entiteType: params.entiteType,
      entiteId: params.entiteId,
      resolue: false,
    },
  });
  if (existante) return;

  await prisma.alerte.create({
    data: {
      type: params.type,
      message: params.message,
      entiteType: params.entiteType,
      entiteId: params.entiteId,
    },
  });
}

async function genererAlertesStock() {
  const stocks = await prisma.stock.findMany({
    where: { seuilAlerte: { gt: 0 } },
    include: { produit: { select: { id: true, code: true, nom: true } } },
  });

  for (const s of stocks) {
    if (s.quantiteSachets < s.seuilAlerte) {
      await creerAlerteSiAbsente({
        type: "STOCK_FAIBLE",
        message: `Stock ${s.produit.code} faible : ${s.quantiteSachets} sachets restants (seuil : ${s.seuilAlerte}).`,
        entiteType: "Produit",
        entiteId: s.produit.id,
      });
    }
  }
}

async function genererAlertesCommandes(joursLivraisonProche: number) {
  const maintenant = new Date();
  const dansXJours = new Date(maintenant.getTime() + joursLivraisonProche * 24 * 3600 * 1000);

  const commandes = await prisma.commande.findMany({
    where: { statut: "EN_ATTENTE" },
    select: {
      id: true,
      dateLivraisonPrevue: true,
      pointVente: { select: { nom: true } },
    },
  });

  for (const c of commandes) {
    if (!c.dateLivraisonPrevue) continue;

    if (c.dateLivraisonPrevue < maintenant) {
      await creerAlerteSiAbsente({
        type: "LIVRAISON_RETARD",
        message: `Livraison en retard pour ${c.pointVente.nom} (prévue le ${c.dateLivraisonPrevue.toLocaleDateString("fr-FR")}).`,
        entiteType: "Commande",
        entiteId: c.id,
      });
    } else if (c.dateLivraisonPrevue <= dansXJours) {
      await creerAlerteSiAbsente({
        type: "COMMANDE_EN_ATTENTE",
        message: `Livraison à venir pour ${c.pointVente.nom} (prévue le ${c.dateLivraisonPrevue.toLocaleDateString("fr-FR")}).`,
        entiteType: "Commande",
        entiteId: c.id,
      });
    }
  }
}

async function genererAlertesCredits(joursCreditRetard: number) {
  const seuil = new Date();
  seuil.setDate(seuil.getDate() - joursCreditRetard);

  const ventes = await prisma.vente.findMany({
    where: { createdAt: { lte: seuil }, paiements: { some: { estCredit: true } } },
    select: {
      id: true,
      montantTotal: true,
      pointVente: { select: { nom: true } },
      paiements: { select: { montant: true } },
    },
  });

  for (const v of ventes) {
    const paye = v.paiements.reduce((s, p) => s + Number(p.montant), 0);
    const du = Number(v.montantTotal) - paye;
    if (du > 0) {
      await creerAlerteSiAbsente({
        type: "CREDIT_RETARD",
        message: `Crédit en retard chez ${v.pointVente.nom} : ${du.toLocaleString("fr-FR")} FCFA dû depuis plus de ${joursCreditRetard} jours.`,
        entiteType: "Vente",
        entiteId: v.id,
      });
    }
  }
}

async function genererAlertesProspects(joursProspectARelancer: number) {
  const seuil = new Date();
  seuil.setDate(seuil.getDate() - joursProspectARelancer);

  const prospects = await prisma.prospect.findMany({
    where: {
      OR: [
        { statut: "A_RELANCER" },
        { statut: "NOUVEAU", createdAt: { lte: seuil } },
      ],
    },
    select: { id: true, nom: true, pointVente: { select: { nom: true } } },
  });

  for (const p of prospects) {
    await creerAlerteSiAbsente({
      type: "PROSPECT_A_RELANCER",
      message: `Prospect à relancer : ${p.nom} (${p.pointVente.nom}).`,
      entiteType: "Prospect",
      entiteId: p.id,
    });
  }
}

async function genererAlertesClientsInactifs(joursClientInactif: number) {
  const seuil = new Date();
  seuil.setDate(seuil.getDate() - joursClientInactif);

  const clients = await prisma.client.findMany({
    where: {
      statut: "ACTIF",
      ventes: { none: { createdAt: { gte: seuil } } },
      commandes: { none: { createdAt: { gte: seuil } } },
    },
    select: { id: true, nom: true, pointVente: { select: { nom: true } } },
  });

  for (const c of clients) {
    await creerAlerteSiAbsente({
      type: "CLIENT_INACTIF",
      message: `Client inactif depuis plus de ${joursClientInactif} jours : ${c.nom} (${c.pointVente.nom}).`,
      entiteType: "Client",
      entiteId: c.id,
    });
  }
}

/**
 * Objectif journalier NON atteint pour un binôme — à appeler après
 * l'agrégation de la veille (le job d'agrégation nocturne connaît déjà
 * "hier" comme journée terminée, donc évaluable).
 */
async function genererAlertesObjectifs(dateReference: Date) {
  const debut = new Date(dateReference);
  debut.setHours(0, 0, 0, 0);
  const fin = new Date(dateReference);
  fin.setHours(23, 59, 59, 999);

  const binomes = await prisma.binome.findMany({ where: { actif: true } });

  for (const b of binomes) {
    const objectif = await prisma.objectif.findFirst({
      where: {
        binomeId: b.id,
        periode: "JOURNALIER",
        dateDebut: { lte: fin },
        dateFin: { gte: debut },
      },
    });
    if (!objectif) continue;

    const agg = await prisma.ventesJournalieres.findMany({
      where: { date: debut, binomeId: b.id },
      select: { cartonsVendus: true },
    });
    const realise = agg.reduce((s, a) => s + a.cartonsVendus, 0);

    if (realise < objectif.valeurCartons) {
      await creerAlerteSiAbsente({
        type: "OBJECTIF_NON_ATTEINT",
        message: `${b.nom} n'a pas atteint son objectif du ${debut.toLocaleDateString("fr-FR")} : ${realise}/${objectif.valeurCartons} cartons.`,
        entiteType: "Binome",
        entiteId: `${b.id}-${debut.toISOString().slice(0, 10)}`,
      });
    }
  }
}

/** Point d'entrée unique, appelé par le cron nocturne. */
export async function genererToutesLesAlertes(dateVeille: Date) {
  const seuils = await getSeuilsAlertes();
  await genererAlertesStock();
  await genererAlertesCommandes(seuils.joursLivraisonProche);
  await genererAlertesCredits(seuils.joursCreditRetard);
  await genererAlertesProspects(seuils.joursProspectARelancer);
  await genererAlertesClientsInactifs(seuils.joursClientInactif);
  await genererAlertesObjectifs(dateVeille);
}

/**
 * Génération manuelle depuis l'admin (bouton "Générer maintenant") — tout
 * sauf le contrôle d'objectifs, qui a besoin des données agrégées de la
 * veille (uniquement disponibles après le passage du cron nocturne).
 */
export async function genererAlertesManuelles() {
  const seuils = await getSeuilsAlertes();
  await genererAlertesStock();
  await genererAlertesCommandes(seuils.joursLivraisonProche);
  await genererAlertesCredits(seuils.joursCreditRetard);
  await genererAlertesProspects(seuils.joursProspectARelancer);
  await genererAlertesClientsInactifs(seuils.joursClientInactif);
}
