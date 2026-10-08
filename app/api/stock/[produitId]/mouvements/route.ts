import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";
import { getMouvementsRecents } from "@/lib/queries/stock";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: { produitId: string } }
) {
  try {
    await requireAdmin();
    const data = await getMouvementsRecents(params.produitId);
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}
