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
// Pool de connexions : « connection_limit=3 » (valeur conseillée à l'origine) est trop juste dès que plusieurs
// requêtes arrivent en même temps sur une même instance (pages admin = beaucoup de requêtes en parallèle) :
// erreur P2024 « Timed out fetching a new connection ». On relève le plafond et le délai d'attente, sauf si
// l'URL ou les variables PRISMA_CONNECTION_LIMIT / PRISMA_POOL_TIMEOUT en décident autrement.
function avecPool(url: string | undefined) {
  if (!url) return url;
  try {
    const u = new URL(url);
    const limite = Number(process.env.PRISMA_CONNECTION_LIMIT) || 10;
    const delai = Number(process.env.PRISMA_POOL_TIMEOUT) || 30;
    const actuelle = Number(u.searchParams.get("connection_limit")) || 0;
    if (process.env.PRISMA_CONNECTION_LIMIT || actuelle < limite) u.searchParams.set("connection_limit", String(limite));
    if (process.env.PRISMA_POOL_TIMEOUT || !u.searchParams.has("pool_timeout")) u.searchParams.set("pool_timeout", String(delai));
    return u.toString();
  } catch {
    return url;
  }
}
const urlNettoyee = avecPool(trouvee?.url);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(urlNettoyee ? { datasources: { db: { url: urlNettoyee } } } : {}),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
