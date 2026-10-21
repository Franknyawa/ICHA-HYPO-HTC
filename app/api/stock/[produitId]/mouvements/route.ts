import { NextResponse } from "next/server";
import { requireModule } from "@/lib/auth/rbac";
import { peutModifier } from "@/lib/auth/permissions";
import { handleApiError } from "@/lib/api-errors";
import { getMouvementsRecents } from "@/lib/queries/stock";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: { produitId: string } }
) {
  try {
    const session = await requireModule("stock");
    // Le superviseur voit l'état du stock uniquement, pas les mouvements.
    if (!peutModifier(session.role)) return NextResponse.json({ error: "Accès réservé aux administrateurs." }, { status: 403 });
    const data = await getMouvementsRecents(params.produitId);
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}
