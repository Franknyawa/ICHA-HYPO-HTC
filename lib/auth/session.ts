import "server-only";
import { SignJWT } from "jose";
import { cookies } from "next/headers";
import { verifySessionToken, type SessionPayload } from "./edge";

const COOKIE_NAME = "icha_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 12; // 12h — journée terrain

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

/** Signe un JWT de session. Utilisé uniquement côté route API (Node runtime). */
export async function createSessionToken(
  payload: SessionPayload
): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getSecretKey());
}

// Note: `cookies()` est synchrone dans Next.js 14 (App Router).
// Si le projet est upgradé vers Next.js 15+, il faudra ajouter `await` ici
// (cookies() devient asynchrone à partir de la v15).

export function setSessionCookie(token: string) {
  const store = cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  });
}

export function clearSessionCookie() {
  const store = cookies();
  store.delete(COOKIE_NAME);
}

/** À utiliser dans les Server Components / Route Handlers (Node runtime). */
export async function getSession(): Promise<SessionPayload | null> {
  const store = cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export { COOKIE_NAME };
