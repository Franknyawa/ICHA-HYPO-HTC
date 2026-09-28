/**
 * Nettoyage ponctuel : supprime les anciens libellés de "type de point de
 * vente" remplacés par la nouvelle liste donnée par Victor. À exécuter une
 * seule fois après avoir mis à jour prisma/seed.ts avec les nouveaux noms.
 *
 * Usage : npx tsx prisma/cleanup-old-types.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ANCIENS_LIBELLES = [
  "Boutique",
  "Supérette",
  "Kiosque",
  "Marché",
  "Boutique d'alimentation du quartier",
  "Call box/Kiosque",
  "Mini supermarché",
  "Table call box / Kiosque",
  // Libellé final conservé : "Boutique du quartier",
  // "Mini super marché / Supérette", "Table Call Box / Kiosque",
  // "Grossiste", "Vendeur ambulant"
];

async function main() {
  for (const nom of ANCIENS_LIBELLES) {
    const type = await prisma.typePointVente.findUnique({ where: { nom } });
    if (!type) {
      console.log(`- "${nom}" : déjà absent, rien à faire.`);
      continue;
    }

    const utilisePar = await prisma.pointVente.count({ where: { typeId: type.id } });

    if (utilisePar > 0) {
      // Ne jamais supprimer une référence encore utilisée par de vrais
      // points de vente — ça casserait leur fiche. On avertit plutôt que
      // de forcer la suppression.
      console.warn(
        `⚠ "${nom}" est encore utilisé par ${utilisePar} point(s) de vente — non supprimé. ` +
          `Réaffecte-les manuellement au bon type avant de relancer ce script.`
      );
      continue;
    }

    await prisma.typePointVente.delete({ where: { id: type.id } });
    console.log(`✓ "${nom}" supprimé.`);
  }

  console.log("Nettoyage terminé.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
