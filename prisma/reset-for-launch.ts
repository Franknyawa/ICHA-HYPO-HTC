import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Remise à zéro de l'application avant lancement réel.
 * ======================================================
 *
 * Vide TOUTES les données de test/démo (activité terrain, ventes,
 * commandes, comptes utilisateurs — y compris les comptes de démo créés
 * par prisma/seed.ts : admin/changeme123, commercial1/2/3) pour repartir
 * sur une base propre avant d'insérer les vraies données et de créer les
 * vrais comptes.
 *
 * CONSERVÉ (référentiel / configuration, pas des "données de test") :
 *   - Villes, Quartiers, Types de point de vente
 *   - Produits (HYPO / HTC) et leurs prix (y compris prix par type de boutique)
 *   - Paramètres système (durée de session, seuils d'alertes, objectifs
 *     individuels globaux)
 *   - La ligne Stock de chaque produit (remise à 0, pas supprimée — pour
 *     que la page Stock affiche immédiatement HYPO/HTC prêts à recevoir le
 *     premier réassort réel)
 *
 * SUPPRIMÉ (tout le reste — activité de test) :
 *   - Tous les comptes utilisateurs (admin ET commerciaux de démo inclus)
 *   - Tous les binômes, sessions, tentatives de connexion
 *   - Tous les points de vente, prospects, clients
 *   - Toutes les visites, ventes, commandes, paiements, photos
 *   - Tout l'historique de mouvements de stock
 *   - Toutes les alertes, notifications, logs de synchronisation
 *   - Toutes les données agrégées (rapports/dashboard)
 *
 * SÉCURITÉ — pour éviter une exécution accidentelle contre la prod :
 *   1. Le script REFUSE de s'exécuter sans la variable d'environnement
 *      CONFIRM_RESET=OUI-JE-VEUX-TOUT-EFFACER (à passer explicitement sur
 *      la ligne de commande, jamais dans un .env qu'on pourrait committer).
 *   2. Il affiche d'abord un état des lieux (nombre de lignes par table)
 *      avant de supprimer quoi que ce soit.
 *
 * Utilisation (en local, avec le DATABASE_URL de PRODUCTION dans .env) :
 *
 *   CONFIRM_RESET=OUI-JE-VEUX-TOUT-EFFACER npm run reset:launch
 *
 * ou directement :
 *
 *   CONFIRM_RESET=OUI-JE-VEUX-TOUT-EFFACER npx tsx prisma/reset-for-launch.ts
 */

const PHRASE_CONFIRMATION = "OUI-JE-VEUX-TOUT-EFFACER";

async function etatDesLieux() {
  const [
    users,
    binomes,
    sessions,
    pointsVente,
    prospects,
    clients,
    visites,
    photos,
    ventes,
    commandes,
    paiements,
    mouvementsStock,
    alertes,
    notifications,
    syncLogs,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.binome.count(),
    prisma.session.count(),
    prisma.pointVente.count(),
    prisma.prospect.count(),
    prisma.client.count(),
    prisma.visite.count(),
    prisma.photo.count(),
    prisma.vente.count(),
    prisma.commande.count(),
    prisma.paiement.count(),
    prisma.mouvementStock.count(),
    prisma.alerte.count(),
    prisma.notification.count(),
    prisma.syncLog.count(),
  ]);

  console.log("\nÉtat actuel de la base :");
  console.table({
    users,
    binomes,
    sessions,
    pointsVente,
    prospects,
    clients,
    visites,
    photos,
    ventes,
    commandes,
    paiements,
    mouvementsStock,
    alertes,
    notifications,
    syncLogs,
  });
}

async function main() {
  if (process.env.CONFIRM_RESET !== PHRASE_CONFIRMATION) {
    console.error(
      `\n⛔ Reset annulé par sécurité.\n\n` +
        `Ce script efface DÉFINITIVEMENT toutes les données de test/démo ` +
        `(y compris TOUS les comptes utilisateurs) de la base pointée par ` +
        `DATABASE_URL dans .env.\n\n` +
        `Pour confirmer que tu veux bien faire ça, relance avec :\n\n` +
        `  CONFIRM_RESET=${PHRASE_CONFIRMATION} npm run reset:launch\n`
    );
    process.exit(1);
  }

  console.log("Base ciblée (DATABASE_URL) :", maskDatabaseUrl(process.env.DATABASE_URL));
  await etatDesLieux();

  console.log("\nSuppression en cours (ordre respectant les contraintes de clé étrangère)...");

  await prisma.$transaction(
    async (tx) => {
      // 1) Feuilles les plus profondes de l'arbre des dépendances.
      await tx.paiement.deleteMany();
      await tx.venteLigne.deleteMany();
      await tx.commandeLigne.deleteMany();
      await tx.photo.deleteMany();

      // 2) Ventes / commandes elles-mêmes.
      await tx.vente.deleteMany();
      await tx.commande.deleteMany();

      // 3) Historique de stock (référence Produit uniquement, pas de blocage).
      await tx.mouvementStock.deleteMany();

      // 4) Visites, puis prospects/clients rattachés aux points de vente.
      await tx.visite.deleteMany();
      await tx.prospect.deleteMany();
      await tx.client.deleteMany();

      // 5) Notifications, logs de sync, alertes, agrégats — aucune
      //    contrainte ne bloque, mais on les vide avant les comptes
      //    utilisateurs auxquels certaines font référence.
      await tx.notification.deleteMany();
      await tx.syncLog.deleteMany();
      await tx.alerte.deleteMany();
      await tx.ventesJournalieres.deleteMany();
      await tx.performanceBinome.deleteMany();

      // 6) Objectifs par binôme (référence Binome).
      await tx.objectif.deleteMany();

      // 7) Points de vente — maintenant que plus rien n'y fait référence
      //    (prospects/clients/visites/photos/ventes/commandes déjà vidés).
      await tx.pointVente.deleteMany();

      // 8) Authentification : tentatives de connexion puis sessions actives.
      await tx.loginAttempt.deleteMany();
      await tx.session.deleteMany();

      // 9) Comptes utilisateurs — TOUS, y compris l'admin et les
      //    commerciaux de démo (admin/changeme123, commercial1/2/3) créés
      //    par prisma/seed.ts. Les vrais comptes seront recréés depuis le
      //    back office après ce reset.
      await tx.user.deleteMany();

      // 10) Binômes — n'ont plus aucun membre ni objectif à ce stade.
      await tx.binome.deleteMany();

      // 11) Stock : remis à 0 plutôt que supprimé, pour que HYPO/HTC
      //     restent visibles sur la page Stock, prêts pour le premier
      //     réassort réel.
      await tx.stock.updateMany({ data: { quantiteSachets: 0 } });
    },
    { timeout: 60000, maxWait: 15000 }
  );

  console.log("\n✅ Reset terminé. Données conservées : villes, quartiers, types de");
  console.log("   point de vente, produits (HYPO/HTC) et leurs prix, paramètres");
  console.log("   système (durée de session, seuils d'alertes, objectifs individuels).");
  console.log("\n⚠️  Il n'existe plus AUCUN compte utilisateur, y compris admin.");
  console.log("   Prochaine étape : créer le ou les premiers comptes admin réels");
  console.log("   directement en base (voir prisma/create-first-admin.ts) puisque");
  console.log("   la page de connexion ne permet pas de s'auto-créer un compte.");
}

function maskDatabaseUrl(url: string | undefined): string {
  if (!url) return "(DATABASE_URL non défini)";
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.username ? u.username + ":***@" : ""}${u.host}${u.pathname}`;
  } catch {
    return "(URL illisible)";
  }
}

main()
  .catch((e) => {
    console.error("\n❌ Échec du reset :", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
