import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";
import { getMouvementsRecents } from "@/lib/queries/stock";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: { produitId: string } }
) {
  try {
    await requireAuth();
    const data = await getMouvementsRecents(params.produitId);
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}
