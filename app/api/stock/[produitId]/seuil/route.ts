import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/auth/rbac";
import { peutModifier } from "@/lib/auth/permissions";
import { handleApiError } from "@/lib/api-errors";
import { avecJournal } from "@/lib/services/journal";

export const runtime = "nodejs";

const schema = z.object({ seuilAlerte: z.number().int().min(0) });

async function PATCH_(
  req: NextRequest,
  { params }: { params: { produitId: string } }
) {
  try {
    const session = await requireModule("stock");
    if (!peutModifier(session.role)) {
      return NextResponse.json({ error: "Réservé aux administrateurs." }, { status: 403 });
    }
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Valeur invalide." }, { status: 400 });
    }
    await prisma.stock.update({
      where: { produitId: params.produitId },
      data: { seuilAlerte: parsed.data.seuilAlerte },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}

export const PATCH = avecJournal(PATCH_);
