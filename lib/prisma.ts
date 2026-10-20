import { PrismaClient } from "@prisma/client";

// En serverless (Vercel), chaque invocation peut créer une nouvelle instance
// PrismaClient si on n'y prend pas garde -> saturation des connexions Postgres.
// On réutilise une instance globale en dev, et on s'appuie sur une DATABASE_URL
// poolée (pgbouncer=true) en production.

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Nettoie DATABASE_URL : un espace, des guillemets ou « DATABASE_URL= » collés
// par erreur dans Vercel font échouer la connexion (« the URL must start with
// the protocol postgresql:// »). On extrait simplement l'adresse postgres.
function urlBase(): string | undefined {
  const brut = process.env.DATABASE_URL ?? "";
  const m = /postgres(?:ql)?:\/\/[^\s"']+/i.exec(brut);
  if (!m) {
    if (brut) console.error("DATABASE_URL invalide : elle doit commencer par postgresql://");
    return undefined;
  }
  return m[0];
}

const urlNettoyee = urlBase();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(urlNettoyee ? { datasources: { db: { url: urlNettoyee } } } : {}),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
