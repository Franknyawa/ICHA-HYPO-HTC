import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";

export const runtime = "nodejs";

const schema = z.object({
  statut: z.enum(["EN_ATTENTE", "LIVREE", "ANNULEE"]),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Seul un admin marque une commande comme livrée/annulée — décision de
    // gestion, pas une action terrain du commercial.
    await requireAdmin();

    const json = await req.json().catch(() => null);
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Statut invalide." }, { status: 400 });
    }

    const commande = await prisma.commande.update({
      where: { id: params.id },
      data: { statut: parsed.data.statut },
      select: { id: true, statut: true },
    });

    return NextResponse.json(commande);
  } catch (error) {
    return handleApiError(error);
  }
}
