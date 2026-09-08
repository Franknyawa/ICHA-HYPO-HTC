import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/rbac";
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
    await requireAdmin();
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
