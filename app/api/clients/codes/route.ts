import { NextResponse } from "next/server";
import { requireModule } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";
import { attribuerCodesManquants } from "@/lib/services/code-client";

export const runtime = "nodejs";

/** Attribue un code client (CLI-0001…) à tous les clients qui n'en ont pas encore. */
export async function POST() {
  try {
    const session = await requireModule("clients");
    if (session.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Réservé au super administrateur." }, { status: 403 });
    // Désactivé pour l'instant : les codes clients seront attribués après la fusion des doublons.
    void attribuerCodesManquants;
    return NextResponse.json({ error: "Attribution des codes désactivée pour l'instant." }, { status: 409 });
  } catch (error) {
    return handleApiError(error);
  }
}
