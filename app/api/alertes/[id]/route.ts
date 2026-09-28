import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";

export const runtime = "nodejs";

export async function PATCH(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin();
    const alerte = await prisma.alerte.update({
      where: { id: params.id },
      data: { resolue: true },
    });
    return NextResponse.json(alerte);
  } catch (error) {
    return handleApiError(error);
  }
}
