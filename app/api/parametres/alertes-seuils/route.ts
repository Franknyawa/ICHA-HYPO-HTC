import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";
import { getSeuilsAlertes, CLES_SEUILS } from "@/lib/jobs/alertes";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireAdmin();
    const seuils = await getSeuilsAlertes();
    return NextResponse.json(seuils);
  } catch (error) {
    return handleApiError(error);
  }
}

const schema = z.object({
  cle: z.enum([
    "joursCreditRetard",
    "joursProspectARelancer",
    "joursClientInactif",
    "joursLivraisonProche",
  ]),
  valeur: z.number().int().min(1).max(365),
});

export async function PATCH(req: NextRequest) {
  try {
    await requireAdmin();
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Données invalides." }, { status: 400 });
    }
    const cleStockage = CLES_SEUILS[parsed.data.cle];
    await prisma.parametreSysteme.upsert({
      where: { cle: cleStockage },
      update: { valeur: String(parsed.data.valeur) },
      create: { cle: cleStockage, valeur: String(parsed.data.valeur) },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
