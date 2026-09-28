import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const villeId = req.nextUrl.searchParams.get("villeId") ?? undefined;
    const quartiers = await prisma.quartier.findMany({
      where: villeId ? { villeId } : undefined,
      orderBy: [{ ville: { nom: "asc" } }, { nom: "asc" }],
      include: {
        ville: { select: { nom: true } },
        _count: { select: { pointsVente: true } },
      },
    });
    return NextResponse.json({ data: quartiers });
  } catch (error) {
    return handleApiError(error);
  }
}

const schema = z.object({ nom: z.string().min(2), villeId: z.string() });

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Données invalides." }, { status: 400 });
    }
    const existing = await prisma.quartier.findUnique({
      where: { villeId_nom: { villeId: parsed.data.villeId, nom: parsed.data.nom } },
    });
    if (existing) {
      return NextResponse.json({ error: "Ce quartier existe déjà pour cette ville." }, { status: 409 });
    }
    const quartier = await prisma.quartier.create({ data: parsed.data });
    return NextResponse.json(quartier, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
