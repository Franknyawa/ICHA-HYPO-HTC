import "server-only";
import { redirect } from "next/navigation";
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

/**
 * Garde pour les pages admin rendues côté serveur. Le middleware ne vérifie
 * que la signature du jeton (Edge, sans accès base) : il ne voit ni une
 * session révoquée, ni un compte désactivé ou rétrogradé. Cette garde, à
 * appeler en tête de chaque page admin, fait la vérification complète
 * (session en base + rôle actuel) avant de lire la moindre donnée.
 */
export async function requireAdminPage(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") redirect("/dashboard");
  return session;
}

/** Toute personne connectée, quel que soit le rôle (admin ou commercial). */
export async function requireAuth(): Promise<SessionPayload> {
  return requireSession();
}
