import { PrismaClient } from "@prisma/client";

// En serverless (Vercel), chaque invocation peut créer une nouvelle instance
// PrismaClient si on n'y prend pas garde -> saturation des connexions Postgres.
// On réutilise une instance globale en dev, et on s'appuie sur une DATABASE_URL
// poolée (pgbouncer=true) en production.

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
