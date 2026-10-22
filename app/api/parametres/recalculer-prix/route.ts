import { NextResponse } from "next/server";
import { requireModule } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";
import { recalculerMontants } from "@/lib/services/recalcul-prix";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  try {
    await requireModule("parametres");
    return NextResponse.json(await recalculerMontants(false));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST() {
  try {
    await requireModule("parametres");
    return NextResponse.json(await recalculerMontants(true));
  } catch (error) {
    return handleApiError(error);
  }
}
