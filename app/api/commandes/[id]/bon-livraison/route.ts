import { NextResponse } from "next/server";
import { requireModule } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";
import { obtenirBonLivraison } from "@/lib/services/documents-data";

export const runtime = "nodejs";

/** Donne (et crée au besoin) le bon de livraison numéroté de cette commande. */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireModule("commandes");
    const bon = await obtenirBonLivraison(params.id);
    if (!bon) return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
    return NextResponse.json(bon);
  } catch (error) {
    return handleApiError(error);
  }
}
