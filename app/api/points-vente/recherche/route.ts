import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";
import { rechercherPointsVente } from "@/lib/queries/points-vente-recherche";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const sp = req.nextUrl.searchParams;
    const results = await rechercherPointsVente({
      search: sp.get("search") ?? undefined,
      lat: sp.get("lat") ? Number(sp.get("lat")) : undefined,
      lng: sp.get("lng") ? Number(sp.get("lng")) : undefined,
    });
    return NextResponse.json({ data: results });
  } catch (error) {
    return handleApiError(error);
  }
}
