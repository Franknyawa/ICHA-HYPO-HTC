"use client";

/**
 * Petit wrapper fetch pour les pages client de l'admin (Stock, Utilisateurs,
 * Paramètres, ...). Corrige une classe de bugs observée sur ces pages :
 * les appels `fetch(...).then(r => r.json())` sans `.catch()` échouaient
 * silencieusement (session expirée -> 401, timeout réseau, réponse non-JSON
 * après un cold start Vercel/pooler Supabase) et laissaient la page dans un
 * état "vide" sans aucun message — perçu par l'utilisateur comme "la page
 * ne s'affiche pas".
 *
 * Comportement :
 *  - 401 (session expirée / non authentifié) -> redirection vers /login
 *    plutôt qu'un écran vide.
 *  - Autres erreurs (réseau, JSON invalide, 4xx/5xx) -> levée d'une
 *    ApiError avec un message affichable, à charge de l'appelant de
 *    montrer un état d'erreur + bouton "Réessayer" au lieu de rester vide.
 */
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function apiFetch<T = unknown>(input: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(input, init);
  } catch {
    throw new ApiError(0, "Connexion impossible. Vérifiez votre réseau et réessayez.");
  }

  if (res.status === 401) {
    if (typeof window !== "undefined") {
      const from = encodeURIComponent(window.location.pathname);
      window.location.href = `/login?from=${from}`;
    }
    throw new ApiError(401, "Session expirée, redirection vers la connexion...");
  }

  let body: unknown = null;
  try {
    // Certaines réponses (204, erreurs de plateforme) peuvent être vides.
    const text = await res.text();
    body = text ? JSON.parse(text) : null;
  } catch {
    throw new ApiError(res.status, "Réponse invalide du serveur. Réessayez dans un instant.");
  }

  if (!res.ok) {
    const message =
      (body as { error?: string } | null)?.error ?? "Une erreur est survenue. Réessayez.";
    throw new ApiError(res.status, message);
  }

  return body as T;
}
