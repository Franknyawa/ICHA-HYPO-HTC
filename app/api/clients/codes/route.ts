import { NextResponse } from "next/server";
import { requireModule } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";
import { attribuerCodesManquants } from "@/lib/services/code-client";

export const runtime = "nodejs";

/** Attribue un code client (CLI-0001…) à tous les clients qui n'en ont pas encore. */
export async function POST() {
  try {
    const session = await requireModule("clients");
    if (session.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Réservé au super administrateur." }, { status: 403 });
    const nb = await attribuerCodesManquants();
    return NextResponse.json({ nb });
  } catch (error) {
    return handleApiError(error);
  }
}
