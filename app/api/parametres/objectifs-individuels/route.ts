import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";

export const runtime = "nodejs";

// Valeurs de référence données par Victor si jamais rien n'est encore
// configuré en base.
const DEFAUTS: Record<string, number> = {
  JOURNALIER: 42,
  HEBDOMADAIRE: 192,
  MENSUEL: 768,
};

export async function GET() {
  try {
    await requireAdmin();
    const rows = await prisma.objectifIndividuel.findMany();
    const parPeriode = new Map(rows.map((r) => [r.periode, r.valeurCartons]));
    const data = (["JOURNALIER", "HEBDOMADAIRE", "MENSUEL"] as const).map((periode) => ({
      periode,
      valeurCartons: parPeriode.get(periode) ?? DEFAUTS[periode],
    }));
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}

const schema = z.object({
  periode: z.enum(["JOURNALIER", "HEBDOMADAIRE", "MENSUEL"]),
  valeurCartons: z.number().int().min(0),
});

export async function PATCH(req: NextRequest) {
  try {
    await requireAdmin();
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Données invalides." }, { status: 400 });
    }
    const { periode, valeurCartons } = parsed.data;
    const objectif = await prisma.objectifIndividuel.upsert({
      where: { periode },
      update: { valeurCartons },
      create: { periode, valeurCartons },
    });
    return NextResponse.json(objectif);
  } catch (error) {
    return handleApiError(error);
  }
}
