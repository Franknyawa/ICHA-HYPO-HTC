import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";
import { countAlertesActives } from "@/lib/queries/alertes";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireAdmin();
    const count = await countAlertesActives();
    return NextResponse.json({ count });
  } catch (error) {
    return handleApiError(error);
  }
}
