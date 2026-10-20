import { NextResponse } from "next/server";
import { requireModule } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";
import { listerVilles } from "@/lib/geo/synchro-villes";

export const runtime = "nodejs";

/** Liste fixe des villes (lecture seule) pour les écrans de paramétrage. */
export async function GET() {
  try {
    await requireModule("parametres");
    const villes = await listerVilles();
    return NextResponse.json({ data: villes.map((v) => ({ id: v.id, nom: v.nom, region: v.region })) });
  } catch (error) {
    return handleApiError(error);
  }
}
