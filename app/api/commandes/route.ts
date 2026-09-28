import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";
import { listCommandes } from "@/lib/queries/commandes";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    await requireAuth();

    const sp = req.nextUrl.searchParams;
    const result = await listCommandes({
      page: sp.get("page") ? Number(sp.get("page")) : undefined,
      pageSize: sp.get("pageSize") ? Number(sp.get("pageSize")) : undefined,
      statut: (sp.get("statut") as "EN_ATTENTE" | "LIVREE" | "ANNULEE" | null) ?? undefined,
      villeId: sp.get("villeId") ?? undefined,
      commercialId: sp.get("commercialId") ?? undefined,
      dateFrom: sp.get("dateFrom") ?? undefined,
      dateTo: sp.get("dateTo") ?? undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
