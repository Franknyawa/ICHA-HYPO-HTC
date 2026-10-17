import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";

export const runtime = "nodejs";

const schema = z.object({ archive: z.boolean() });

/** Archive (ou restaure) une commande. Seules les commandes terminées (livrées ou annulées) peuvent être archivées. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireModule("archives");
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Données invalides." }, { status: 400 });

    const commande = await prisma.commande.findUnique({ where: { id: params.id }, select: { statut: true } });
    if (!commande) return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
    if (parsed.data.archive && commande.statut !== "LIVREE" && commande.statut !== "ANNULEE") {
      return NextResponse.json(
        { error: "Seule une commande livrée ou annulée peut être archivée." },
        { status: 409 }
      );
    }

    await prisma.commande.update({
      where: { id: params.id },
      data: { archivedAt: parsed.data.archive ? new Date() : null },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
