import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";

export const runtime = "nodejs";

const schema = z.object({ valeurCartons: z.number().int().min(0) });

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin();
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Valeur invalide." }, { status: 400 });
    }
    const objectif = await prisma.objectif.update({
      where: { id: params.id },
      data: { valeurCartons: parsed.data.valeurCartons },
    });
    return NextResponse.json(objectif);
  } catch (error) {
    return handleApiError(error);
  }
}
