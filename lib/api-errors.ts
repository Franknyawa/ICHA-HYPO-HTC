import { NextResponse } from "next/server";
import { UnauthorizedError, ForbiddenError } from "./auth/rbac";

/** À utiliser dans un catch au sommet de chaque route API. */
export function handleApiError(error: unknown): NextResponse {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  if (error instanceof ForbiddenError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  console.error(error);
  return NextResponse.json(
    { error: "Erreur serveur inattendue." },
    { status: 500 }
  );
}
