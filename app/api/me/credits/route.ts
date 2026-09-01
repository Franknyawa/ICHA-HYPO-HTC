import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";
import { getCreditsCommercial } from "@/lib/queries/credits";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await requireAuth();
    const credits = await getCreditsCommercial(session.userId);
    return NextResponse.json(credits);
  } catch (error) {
    return handleApiError(error);
  }
}
