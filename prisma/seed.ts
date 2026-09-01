import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Référentiels de base — extensibles depuis l'admin, jamais codés en dur
  // dans l'application (§31 CDC). Villes fixées par Victor pour le
  // lancement ; d'autres pourront être ajoutées depuis l'admin plus tard.
  const villes = [
    "Douala",
    "Yaoundé",
    "Bafoussam",
    "Edéa",
    "Kribi",
    "Limbé",
    "Buea",
  ];
  for (const nom of villes) {
    await prisma.ville.upsert({ where: { nom }, update: {}, create: { nom } });
  }

  const douala = await prisma.ville.findUniqueOrThrow({ where: { nom: "Douala" } });
  await prisma.quartier.upsert({
    where: { villeId_nom: { villeId: douala.id, nom: "Akwa" } },
    update: {},
    create: { nom: "Akwa", villeId: douala.id },
  });

  // Types de point de vente — liste précise donnée par Victor
  const types = [
    "Boutique du quartier",
    "Mini super marché / Supérette",
    "Table Call Box / Kiosque",
    "Grossiste",
    "Vendeur ambulant",
  ];
  for (const nom of types) {
    await prisma.typePointVente.upsert({
      where: { nom },
      update: {},
      create: { nom },
    });
  }

  // Produits — conversions et prix issus du cahier des charges
  await prisma.produit.upsert({
    where: { code: "HYPO" },
    update: { prixSachet: 75, prixCarton: 8400 },
    create: {
      code: "HYPO",
      nom: "Eau de Javel HYPO 75ml",
      volumeMl: 75,
      sachetsParCarton: 112,
      prixSachet: 75,
      prixCarton: 8400,
    },
  });

  await prisma.produit.upsert({
    where: { code: "HTC" },
    update: { prixSachet: 75, prixFilet: 750, prixCarton: 9000 },
    create: {
      code: "HTC",
      nom: "Nettoyant toilettes HTC 60ml",
      volumeMl: 60,
      sachetsParFilet: 10,
      filetsParCarton: 12,
      sachetsParCarton: 120,
      prixSachet: 75,
      prixFilet: 750,
      prixCarton: 9000,
    },
  });

  // Fiche stock initiale par produit — sans ça, aucune vente n'est possible
  // (la déduction de stock exige une ligne Stock existante, cf. §18 CDC).
  for (const code of ["HYPO", "HTC"]) {
    const produit = await prisma.produit.findUniqueOrThrow({ where: { code } });
    await prisma.stock.upsert({
      where: { produitId: produit.id },
      update: {},
      create: { produitId: produit.id, quantiteSachets: 10000, seuilAlerte: 500 },
    });
  }

  // 3 binômes de lancement (§1 CDC — configuration initiale, pas une limite codée en dur)
  for (let i = 1; i <= 3; i++) {
    await prisma.binome.upsert({
      where: { id: `seed-binome-${i}` },
      update: {},
      create: { id: `seed-binome-${i}`, nom: `Binôme ${i}` },
    });
  }

  // Objectifs commerciaux : 42 cartons/jour et 2500 cartons/semaine par
  // binôme (chiffres donnés par Victor). Objectifs "aujourd'hui" et
  // "cette semaine" pour que le dashboard affiche une progression dès le
  // lancement — un job périodique (à prévoir) devra régénérer ces lignes
  // chaque jour/semaine plutôt que de les coder en dur indéfiniment.
  const now = new Date();
  const debutJour = new Date(now);
  debutJour.setHours(0, 0, 0, 0);
  const finJour = new Date(now);
  finJour.setHours(23, 59, 59, 999);

  const jourSemaine = (now.getDay() + 6) % 7; // 0 = lundi
  const debutSemaine = new Date(now);
  debutSemaine.setDate(now.getDate() - jourSemaine);
  debutSemaine.setHours(0, 0, 0, 0);
  const finSemaine = new Date(debutSemaine);
  finSemaine.setDate(debutSemaine.getDate() + 6);
  finSemaine.setHours(23, 59, 59, 999);

  for (let i = 1; i <= 3; i++) {
    const binomeId = `seed-binome-${i}`;

    await prisma.objectif.upsert({
      where: { id: `seed-obj-jour-${i}` },
      update: {},
      create: {
        id: `seed-obj-jour-${i}`,
        binomeId,
        periode: "JOURNALIER",
        valeurCartons: 42,
        dateDebut: debutJour,
        dateFin: finJour,
      },
    });

    await prisma.objectif.upsert({
      where: { id: `seed-obj-semaine-${i}` },
      update: {},
      create: {
        id: `seed-obj-semaine-${i}`,
        binomeId,
        periode: "HEBDOMADAIRE",
        valeurCartons: 2500,
        dateDebut: debutSemaine,
        dateFin: finSemaine,
      },
    });
  }

  // Un admin de démo
  const passwordHash = await bcrypt.hash("changeme123", 10);
  await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      passwordHash,
      role: Role.ADMIN,
      nom: "Admin",
      prenom: "ICHA",
    },
  });

  // Un commercial de démo par binôme, pour tester le parcours PWA
  const commerciaux = [
    { username: "commercial1", nom: "Terrain", prenom: "Jean", binomeId: "seed-binome-1" },
    { username: "commercial2", nom: "Terrain", prenom: "Awa", binomeId: "seed-binome-1" },
    { username: "commercial3", nom: "Terrain", prenom: "Paul", binomeId: "seed-binome-2" },
  ];
  for (const c of commerciaux) {
    await prisma.user.upsert({
      where: { username: c.username },
      update: {},
      create: { ...c, passwordHash, role: Role.COMMERCIAL },
    });
  }

  console.log("Seed terminé.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
