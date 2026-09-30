import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";
import { getNotificationsCommercial } from "@/lib/queries/notifications";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await requireAuth();
    const result = await getNotificationsCommercial(session.userId);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
