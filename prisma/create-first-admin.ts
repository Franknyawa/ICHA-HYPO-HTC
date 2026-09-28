import "dotenv/config";
import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import readline from "node:readline/promises";

const prisma = new PrismaClient();

/**
 * Crée le premier compte administrateur réel, après un reset (voir
 * prisma/reset-for-launch.ts) qui supprime tous les comptes existants
 * (y compris l'admin de démo admin/changeme123 créé par prisma/seed.ts).
 *
 * Nécessaire car la page de connexion ne permet pas de s'auto-créer un
 * compte — une fois ce premier admin réel créé, tous les autres comptes
 * (admins et commerciaux) se créent normalement depuis le back office
 * (Paramètres > Utilisateurs), qui hash déjà les mots de passe
 * correctement (voir app/api/users/route.ts).
 *
 * Utilisation interactive (recommandé — le mot de passe n'apparaît jamais
 * dans l'historique du terminal) :
 *
 *   npx tsx prisma/create-first-admin.ts
 *
 * Utilisation non interactive (CI / script) :
 *
 *   ADMIN_USERNAME=victor ADMIN_PASSWORD='...' ADMIN_NOM=Nyawa ADMIN_PRENOM=Victor \
 *     npx tsx prisma/create-first-admin.ts
 */

async function prompt(rl: readline.Interface, question: string): Promise<string> {
  const answer = await rl.question(question);
  return answer.trim();
}

async function main() {
  const existingAdmin = await prisma.user.findFirst({ where: { role: Role.ADMIN } });
  if (existingAdmin) {
    console.log(
      `\nUn compte admin existe déjà (${existingAdmin.username}). ` +
        `Ce script ne sert qu'à créer le tout premier admin après un reset ; ` +
        `pour ajouter d'autres comptes, utilise le back office (Paramètres > Utilisateurs).`
    );
    return;
  }

  let username = process.env.ADMIN_USERNAME ?? "";
  let password = process.env.ADMIN_PASSWORD ?? "";
  let nom = process.env.ADMIN_NOM ?? "";
  let prenom = process.env.ADMIN_PRENOM ?? "";

  if (!username || !password || !nom || !prenom) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    console.log("Création du premier compte administrateur réel :\n");
    if (!username) username = await prompt(rl, "Identifiant (lettres/chiffres/./-) : ");
    if (!nom) nom = await prompt(rl, "Nom : ");
    if (!prenom) prenom = await prompt(rl, "Prénom : ");
    if (!password) password = await prompt(rl, "Mot de passe (min. 8 caractères recommandé) : ");
    rl.close();
  }

  if (!/^[a-z0-9._-]+$/i.test(username)) {
    throw new Error("Identifiant invalide : lettres, chiffres, points, tirets uniquement.");
  }
  if (password.length < 6) {
    throw new Error("Mot de passe trop court (6 caractères minimum, 8+ recommandé).");
  }
  if (!nom || !prenom) {
    throw new Error("Nom et prénom requis.");
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const admin = await prisma.user.create({
    data: { username, passwordHash, role: Role.ADMIN, nom, prenom },
    select: { id: true, username: true, nom: true, prenom: true },
  });

  console.log(`\n✅ Compte admin créé : ${admin.prenom} ${admin.nom} (${admin.username}).`);
  console.log("   Connecte-toi puis crée les autres comptes depuis Paramètres > Utilisateurs.");
}

main()
  .catch((e) => {
    console.error("\n❌", e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
