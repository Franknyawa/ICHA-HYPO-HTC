import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";
import { avecJournal } from "@/lib/services/journal";

export const runtime = "nodejs";

const schema = z.object({
  nom: z.string().min(2).optional(),
  actif: z.boolean().optional(),
});

async function PATCH_(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireModule("parametres");
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Données invalides." }, { status: 400 });
    }
    const quartier = await prisma.quartier.update({ where: { id: params.id }, data: parsed.data });
    return NextResponse.json(quartier);
  } catch (error) {
    return handleApiError(error);
  }
}

export const PATCH = avecJournal(PATCH_);
