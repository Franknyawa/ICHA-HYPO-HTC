import { NextResponse } from "next/server";
import { requireModule } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";
import { recalculerMontants } from "@/lib/services/recalcul-prix";
import { avecJournal } from "@/lib/services/journal";

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

async function POST_() {
  try {
    await requireModule("parametres");
    return NextResponse.json(await recalculerMontants(true));
  } catch (error) {
    return handleApiError(error);
  }
}

export const POST = avecJournal(POST_);
