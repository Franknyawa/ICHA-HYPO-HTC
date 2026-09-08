import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";
import { getDureeSessionHeures } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireAdmin();
    const heures = await getDureeSessionHeures();
    return NextResponse.json({ heures });
  } catch (error) {
    return handleApiError(error);
  }
}

const schema = z.object({ heures: z.number().int().min(1).max(24 * 30) });

export async function PATCH(req: NextRequest) {
  try {
    await requireAdmin();
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Valeur invalide." }, { status: 400 });
    }
    await prisma.parametreSysteme.upsert({
      where: { cle: "duree_session_heures" },
      update: { valeur: String(parsed.data.heures) },
      create: { cle: "duree_session_heures", valeur: String(parsed.data.heures) },
    });
    return NextResponse.json({ ok: true, heures: parsed.data.heures });
  } catch (error) {
    return handleApiError(error);
  }
}
