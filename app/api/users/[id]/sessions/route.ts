import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin();
    const sessions = await prisma.session.findMany({
      where: { userId: params.id, revoked: false, expiresAt: { gt: new Date() } },
      orderBy: { lastSeenAt: "desc" },
    });
    return NextResponse.json({ data: sessions });
  } catch (error) {
    return handleApiError(error);
  }
}

// Déconnecte l'utilisateur de partout d'un coup.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin();
    await prisma.session.updateMany({
      where: { userId: params.id, revoked: false },
      data: { revoked: true },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
