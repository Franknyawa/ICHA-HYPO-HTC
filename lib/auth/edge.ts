import { jwtVerify } from "jose";

export type SessionPayload = {
  userId: string;
  username: string;
  role: "ADMIN" | "COMMERCIAL";
  binomeId: string | null;
  binomeNom: string | null;
  nom: string;
  prenom: string;
  sessionId: string; // référence la table Session — permet la révocation
};

function getSecretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error(
      "AUTH_SECRET manquant. Renseigne-le dans .env (voir .env.example)."
    );
  }
  return new TextEncoder().encode(secret);
}

/** Sûr pour l'Edge Runtime (middleware) : ne dépend que de `jose`. */
export async function verifySessionToken(
  token: string
): Promise<SessionPayload | null> {
  try {
    // Algorithme épinglé : on n'accepte que HS256 (celui utilisé à la
    // signature) plutôt que de laisser le jeton choisir.
    const { payload } = await jwtVerify(token, getSecretKey(), { algorithms: ["HS256"] });
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}
