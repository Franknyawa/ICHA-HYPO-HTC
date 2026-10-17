import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";

export const runtime = "nodejs";

/** Supprime une opération manuelle de la caisse (erreur de saisie). */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireAdmin();
    const res = await prisma.operationCaisse.deleteMany({ where: { id: params.id } });
    if (res.count === 0) return NextResponse.json({ error: "Opération introuvable." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
