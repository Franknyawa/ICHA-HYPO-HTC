import "server-only";
import { SignJWT } from "jose";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifySessionToken, type SessionPayload } from "./edge";

const COOKIE_NAME = "icha_session";
const DUREE_SESSION_DEFAUT_HEURES = 12;

function getSecretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error(
      "AUTH_SECRET manquant. Renseigne-le dans .env (voir .env.example)."
    );
  }
  return new TextEncoder().encode(secret);
}

export type { SessionPayload };
export { verifySessionToken };

/**
 * Durée de session configurable depuis le back office
 * (ParametreSysteme, clé "duree_session_heures"). 12h par défaut si jamais
 * réglée.
 */
export async function getDureeSessionHeures(): Promise<number> {
  const param = await prisma.parametreSysteme.findUnique({
    where: { cle: "duree_session_heures" },
  });
  const heures = param ? Number(param.valeur) : NaN;
  return Number.isFinite(heures) && heures > 0 ? heures : DUREE_SESSION_DEFAUT_HEURES;
}

/** Signe un JWT de session. Utilisé uniquement côté route API (Node runtime). */
export async function createSessionToken(
  payload: SessionPayload,
  dureeSecondes: number
): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${dureeSecondes}s`)
    .sign(getSecretKey());
}

// Note: `cookies()` est synchrone dans Next.js 14 (App Router).
// Si le projet est upgradé vers Next.js 15+, il faudra ajouter `await` ici
// (cookies() devient asynchrone à partir de la v15).

export function setSessionCookie(token: string, dureeSecondes: number) {
  const store = cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: dureeSecondes,
  });
}

export function clearSessionCookie() {
  const store = cookies();
  store.delete(COOKIE_NAME);
}

/**
 * À utiliser dans les Server Components / Route Handlers (Node runtime).
 * Vérifie le JWT ET confirme que la session n'a pas été révoquée côté
 * serveur (back office → "Déconnecter cet appareil") ni expirée en base —
 * c'est ce deuxième contrôle qui rend la révocation immédiate possible,
 * un JWT seul resterait valide jusqu'à son expiration naturelle.
 */
export async function getSession(): Promise<SessionPayload | null> {
  const store = cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = await verifySessionToken(token);
  if (!payload) return null;

  const session = await prisma.session.findUnique({ where: { id: payload.sessionId } });
  if (!session || session.revoked || session.expiresAt < new Date()) {
    return null;
  }

  // Best-effort, ne bloque pas la réponse si ça échoue.
  prisma.session
    .update({ where: { id: session.id }, data: { lastSeenAt: new Date() } })
    .catch(() => {});

  return payload;
}

export { COOKIE_NAME };
