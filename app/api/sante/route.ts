import { NextResponse } from "next/server";
import { prisma, trouverUrlBase } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Diagnostic de la connexion à la base, sans aucun secret : indique quelle
 * variable est utilisée, le serveur et le port visés, et si une requête passe.
 * À ouvrir dans le navigateur : /api/sante
 */
export async function GET() {
  const brut = process.env.DATABASE_URL ?? "";
  const trouvee = trouverUrlBase();
  let hote: string | null = null;
  let port: string | null = null;
  let utilisateur: string | null = null;
  let motDePasseVide = false;
  if (trouvee) {
    try {
      const u = new URL(trouvee.url);
      hote = u.hostname;
      port = u.port || "5432";
      utilisateur = u.username;
      motDePasseVide = u.password === "";
    } catch {
      /* URL illisible : le détail reste à null */
    }
  }

  let connexion: "ok" | "echec" = "echec";
  let erreur: string | null = null;
  const t0 = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    connexion = "ok";
  } catch (e) {
    erreur = (e instanceof Error ? e.message : String(e)).split("\n").filter(Boolean).slice(-2).join(" | ").replace(/:[^:@/\s]+@/g, ":***@");
  }

  return NextResponse.json({
    DATABASE_URL_definie: brut.length > 0,
    DATABASE_URL_longueur: brut.length,
    DATABASE_URL_debut_ok: /^\s*["']?postgres(ql)?:\/\//i.test(brut),
    variable_utilisee: trouvee?.nom ?? null,
    hote,
    port,
    utilisateur,
    motDePasseVide,
    pgbouncer: trouvee ? /pgbouncer=true/i.test(trouvee.url) : null,
    connexion,
    duree_ms: Date.now() - t0,
    erreur,
  });
}
