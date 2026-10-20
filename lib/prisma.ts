import { PrismaClient } from "@prisma/client";

// En serverless (Vercel), chaque invocation peut créer une nouvelle instance
// PrismaClient si on n'y prend pas garde -> saturation des connexions Postgres.
// On réutilise une instance globale en dev, et on s'appuie sur une DATABASE_URL
// poolée (pgbouncer=true) en production.

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Cherche une adresse postgres valide : DATABASE_URL d'abord (nettoyée des
// espaces, guillemets ou « DATABASE_URL= » collés par erreur), puis les autres
// variables que Vercel/Supabase peuvent fournir. Sans cela, une seule variable
// mal saisie fait tomber toute l'application.
const VARIABLES_URL = ["DATABASE_URL", "POSTGRES_PRISMA_URL", "POSTGRES_URL", "DIRECT_URL", "POSTGRES_URL_NON_POOLING"];

export function trouverUrlBase(): { nom: string; url: string } | null {
  for (const nom of VARIABLES_URL) {
    const brut = process.env[nom] ?? "";
    const m = /postgres(?:ql)?:\/\/[^\s"']+/i.exec(brut);
    if (m) return { nom, url: m[0] };
  }
  return null;
}

const trouvee = trouverUrlBase();
if (!trouvee) console.error("Aucune adresse de base valide (DATABASE_URL doit commencer par postgresql://).");
const urlNettoyee = trouvee?.url;

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(urlNettoyee ? { datasources: { db: { url: urlNettoyee } } } : {}),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
