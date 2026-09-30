import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";
import { getMouvementsRecentsTous } from "@/lib/queries/stock";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireAuth();
    const data = await getMouvementsRecentsTous();
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}
