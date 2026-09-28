import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";
import { listStockAvecProduits } from "@/lib/queries/stock";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireAuth();
    const data = await listStockAvecProduits();
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}
