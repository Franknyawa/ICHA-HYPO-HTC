import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";

export const runtime = "nodejs";

const schema = z.object({ versQuartierId: z.string() });

// Fusionne ce quartier (params.id) dans un autre (versQuartierId) : tous
// les points de vente rattachés au premier sont réassignés au second,
// puis le premier est désactivé (jamais supprimé — l'historique des
// visites/ventes qui le référencent indirectement via PointVente reste
// intact, cohérent avec le reste de l'app).
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin();
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Quartier cible manquant." }, { status: 400 });
    }
    if (parsed.data.versQuartierId === params.id) {
      return NextResponse.json({ error: "Impossible de fusionner un quartier avec lui-même." }, { status: 400 });
    }

    const [source, cible] = await Promise.all([
      prisma.quartier.findUnique({ where: { id: params.id } }),
      prisma.quartier.findUnique({ where: { id: parsed.data.versQuartierId } }),
    ]);
    if (!source || !cible) {
      return NextResponse.json({ error: "Quartier introuvable." }, { status: 404 });
    }
    if (source.villeId !== cible.villeId) {
      return NextResponse.json(
        { error: "Les deux quartiers doivent appartenir à la même ville." },
        { status: 400 }
      );
    }

    const nbPointsVente = await prisma.pointVente.count({ where: { quartierId: params.id } });

    await prisma.$transaction([
      prisma.pointVente.updateMany({
        where: { quartierId: params.id },
        data: { quartierId: parsed.data.versQuartierId },
      }),
      prisma.quartier.update({ where: { id: params.id }, data: { actif: false } }),
    ]);

    return NextResponse.json({ ok: true, pointsVenteDeplaces: nbPointsVente });
  } catch (error) {
    return handleApiError(error);
  }
}
