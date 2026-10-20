import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";
import { NOMS_REGIONS } from "@/lib/geo/cameroun";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireModule("parametres");
    const data = await prisma.objectifTerritoire.findMany({ orderBy: [{ niveau: "asc" }, { cle: "asc" }] });
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}

const schema = z.object({
  niveau: z.enum(["REGION", "VILLE"]),
  cle: z.string().min(1).max(80),
  periode: z.enum(["JOURNALIER", "HEBDOMADAIRE", "MENSUEL"]),
  /** null ou 0 = pas d'objectif (supprime la ligne). */
  valeurCartons: z.number().int().min(0).max(10_000_000).nullable(),
});

export async function PUT(req: NextRequest) {
  try {
    await requireModule("parametres");
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Données invalides." }, { status: 400 });
    const { niveau, cle, periode, valeurCartons } = parsed.data;

    if (niveau === "REGION" && !NOMS_REGIONS.includes(cle)) {
      return NextResponse.json({ error: "Région inconnue." }, { status: 400 });
    }
    if (niveau === "VILLE") {
      const ville = await prisma.ville.findUnique({ where: { id: cle }, select: { id: true } });
      if (!ville) return NextResponse.json({ error: "Ville inconnue." }, { status: 400 });
    }

    if (!valeurCartons) {
      await prisma.objectifTerritoire.deleteMany({ where: { niveau, cle, periode } });
    } else {
      await prisma.objectifTerritoire.upsert({
        where: { niveau_cle_periode: { niveau, cle, periode } },
        update: { valeurCartons },
        create: { niveau, cle, periode, valeurCartons },
      });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
