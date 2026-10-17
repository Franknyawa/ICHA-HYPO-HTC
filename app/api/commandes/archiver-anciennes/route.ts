import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";

export const runtime = "nodejs";

const schema = z.object({ jours: z.number().int().min(7).max(730).default(30) });

/** Archive d'un coup toutes les commandes livrées ou annulées depuis plus de N jours. */
export async function POST(req: NextRequest) {
  try {
    await requireModule("archives");
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: "Données invalides." }, { status: 400 });

    const limite = new Date(Date.now() - parsed.data.jours * 86400000);
    const res = await prisma.commande.updateMany({
      where: { archivedAt: null, statut: { in: ["LIVREE", "ANNULEE"] }, dateCommande: { lt: limite } },
      data: { archivedAt: new Date() },
    });
    return NextResponse.json({ ok: true, archivees: res.count });
  } catch (error) {
    return handleApiError(error);
  }
}
