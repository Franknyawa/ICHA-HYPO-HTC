import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";

export const runtime = "nodejs";

const schema = z.object({
  nom: z.string().min(1).optional(),
  actif: z.boolean().optional(),
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
    const binome = await prisma.binome.update({ where: { id: params.id }, data: parsed.data });
    return NextResponse.json(binome);
  } catch (error) {
    return handleApiError(error);
  }
}

/** Suppression réelle seulement si le binôme n'a ni membre, ni visite, ni objectif ; sinon on propose de le désactiver. */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireModule("parametres");
    const [membres, visites, objectifs] = await Promise.all([
      prisma.user.count({ where: { binomeId: params.id } }),
      prisma.visite.count({ where: { binomeId: params.id } }),
      prisma.objectif.count({ where: { binomeId: params.id } }),
    ]);
    if (membres + visites + objectifs > 0) {
      return NextResponse.json(
        { error: "Ce binôme est lié à des utilisateurs, des visites ou des objectifs. Désactive-le à la place pour garder l'historique." },
        { status: 409 }
      );
    }
    await prisma.binome.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
