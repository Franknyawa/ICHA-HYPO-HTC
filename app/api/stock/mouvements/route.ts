import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";
import { getMouvementsRecentsTous } from "@/lib/queries/stock";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireAdmin();
    const data = await getMouvementsRecentsTous();
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}
