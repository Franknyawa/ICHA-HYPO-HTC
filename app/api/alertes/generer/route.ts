import { NextResponse } from "next/server";
import { requireModule } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";
import { genererAlertesManuelles } from "@/lib/jobs/alertes";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST() {
  try {
    await requireModule("alertes");
    await genererAlertesManuelles();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
