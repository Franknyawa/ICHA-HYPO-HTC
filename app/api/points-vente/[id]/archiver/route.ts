import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";

export const runtime = "nodejs";

const schema = z.object({ archive: z.boolean() });

/** Archive (ou restaure) un point de vente : il disparaît des listes et de la recherche terrain, son historique reste intact. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireModule("archives");
    if (session.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Réservé au super administrateur." }, { status: 403 });
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Données invalides." }, { status: 400 });

    const res = await prisma.pointVente.updateMany({
      where: { id: params.id },
      data: { archivedAt: parsed.data.archive ? new Date() : null },
    });
    if (res.count === 0) return NextResponse.json({ error: "Point de vente introuvable." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
