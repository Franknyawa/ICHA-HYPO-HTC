import "server-only";
import { SignJWT } from "jose";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifySessionToken, type SessionPayload } from "./edge";

const COOKIE_NAME = "icha_session";
const DUREE_SESSION_DEFAUT_MINUTES = 12 * 60;

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
 * Durée de session configurable depuis le back office, en minutes
 * (ParametreSysteme, clé "duree_session_minutes") — 12h (720 min) par
 * défaut si jamais réglée. Anciennement en heures entières uniquement ;
 * passé en minutes pour permettre des réglages plus fins (ex: 30 min).
 */
export async function getDureeSessionMinutes(): Promise<number> {
  const param = await prisma.parametreSysteme.findUnique({
    where: { cle: "duree_session_minutes" },
  });
  const minutes = param ? Number(param.valeur) : NaN;
  return Number.isFinite(minutes) && minutes > 0 ? minutes : DUREE_SESSION_DEFAUT_MINUTES;
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
// lastSeenAt n'est réécrit que si la valeur connue a plus de 5 minutes :
// l'écrire à chaque requête ajoutait une écriture en base à chaque appel
// d'API et chaque page.
const INTERVALLE_LAST_SEEN_MS = 5 * 60 * 1000;

export async function getSession(): Promise<SessionPayload | null> {
  const store = cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = await verifySessionToken(token);
  if (!payload) return null;

  // Une seule requête : la session ET l'état actuel de l'utilisateur. Le
  // rôle, l'état actif et le binôme viennent de la base, pas du JWT — sinon
  // un compte désactivé, rétrogradé ou changé de binôme garderait ses
  // anciens droits jusqu'à l'expiration naturelle du jeton.
  const session = await prisma.session.findUnique({
    where: { id: payload.sessionId },
    include: {
      user: {
        select: {
          actif: true,
          role: true,
          nom: true,
          prenom: true,
          binomeId: true,
          binome: { select: { nom: true } },
        },
      },
    },
  });

  if (
    !session ||
    session.revoked ||
    session.expiresAt < new Date() ||
    session.userId !== payload.userId ||
    !session.user.actif
  ) {
    return null;
  }

  if (Date.now() - session.lastSeenAt.getTime() > INTERVALLE_LAST_SEEN_MS) {
    // Best-effort, ne bloque pas la réponse si ça échoue.
    prisma.session
      .update({ where: { id: session.id }, data: { lastSeenAt: new Date() } })
      .catch(() => {});
  }

  return {
    ...payload,
    role: session.user.role,
    nom: session.user.nom,
    prenom: session.user.prenom,
    binomeId: session.user.binomeId,
    binomeNom: session.user.binome?.nom ?? null,
  };
}

/**
 * Révoque les sessions actives d'un utilisateur (désactivation du compte,
 * changement de rôle, changement ou réinitialisation de mot de passe).
 * `sauf` permet de garder la session courante, par exemple quand
 * l'utilisateur change lui-même son mot de passe.
 */
export async function revoquerSessionsUtilisateur(userId: string, sauf?: string) {
  await prisma.session.updateMany({
    where: { userId, revoked: false, ...(sauf ? { id: { not: sauf } } : {}) },
    data: { revoked: true },
  });
}

export { COOKIE_NAME };
