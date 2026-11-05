import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";
import { avecJournal } from "@/lib/services/journal";

export const runtime = "nodejs";

// Révoque une session précise (un seul appareil/navigateur).
async function DELETE_(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireModule("utilisateurs");
    await prisma.session.update({ where: { id: params.id }, data: { revoked: true } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}

export const DELETE = avecJournal(DELETE_);
