import "server-only";
import { getSession, type SessionPayload } from "./session";

export class UnauthorizedError extends Error {
  constructor(message = "Non authentifié") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "Accès refusé") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/** Récupère la session ou lève une erreur si l'utilisateur n'est pas connecté. */
export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) throw new UnauthorizedError();
  return session;
}

/** Récupère la session et vérifie que le rôle correspond. */
export async function requireRole(
  role: "ADMIN" | "COMMERCIAL"
): Promise<SessionPayload> {
  const session = await requireSession();
  if (session.role !== role) throw new ForbiddenError();
  return session;
}

export async function requireAdmin(): Promise<SessionPayload> {
  return requireRole("ADMIN");
}

export async function requireCommercial(): Promise<SessionPayload> {
  return requireRole("COMMERCIAL");
}

/** Toute personne connectée, quel que soit le rôle (admin ou commercial). */
export async function requireAuth(): Promise<SessionPayload> {
  return requireSession();
}
