import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";

export const runtime = "nodejs";

const schema = z.object({
  nom: z.string().trim().min(2).max(80).optional(),
  actif: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireModule("parametres");
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Données invalides." }, { status: 400 });
    const data = { ...parsed.data, ...(parsed.data.nom ? { nom: parsed.data.nom.toUpperCase() } : {}) };
    const agent = await prisma.agentFacturation.update({ where: { id: params.id }, data });
    return NextResponse.json(agent);
  } catch (error) {
    return handleApiError(error);
  }
}

/** Suppression réelle seulement si l'agent n'apparaît sur aucune facture ; sinon on propose de le désactiver. */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireModule("parametres");
    const factures = await prisma.facture.count({ where: { agentId: params.id } });
    if (factures > 0) {
      return NextResponse.json(
        { error: `Cet agent figure sur ${factures} facture(s). Désactive-le à la place pour garder l'historique.` },
        { status: 409 }
      );
    }
    await prisma.agentFacturation.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
