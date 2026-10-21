import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";

export const runtime = "nodejs";

const schema = z.object({
  nom: z.string().min(2).optional(),
  actif: z.boolean().optional(),
  ordre: z.number().int().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireModule("parametres");
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Données invalides." }, { status: 400 });
    }
    const type = await prisma.typePointVente.update({ where: { id: params.id }, data: parsed.data });
    return NextResponse.json(type);
  } catch (error) {
    return handleApiError(error);
  }
}

/** Suppression réelle seulement si le type n'est utilisé par aucun point de vente ; sinon on propose de le désactiver. */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireModule("parametres");
    const utilise = await prisma.pointVente.count({
      where: { OR: [{ typeId: params.id }, { typesIds: { has: params.id } }] },
    });
    if (utilise > 0) {
      return NextResponse.json(
        { error: `Ce type est utilisé par ${utilise} point(s) de vente. Désactive-le à la place pour garder l'historique.` },
        { status: 409 }
      );
    }
    await prisma.$transaction([
      prisma.prixParType.deleteMany({ where: { typeId: params.id } }),
      prisma.typePointVente.delete({ where: { id: params.id } }),
    ]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
