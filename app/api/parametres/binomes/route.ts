import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireAdmin();
    const binomes = await prisma.binome.findMany({
      orderBy: { nom: "asc" },
      include: { membres: { select: { id: true, nom: true, prenom: true } } },
    });
    return NextResponse.json({ data: binomes });
  } catch (error) {
    return handleApiError(error);
  }
}

const schema = z.object({ nom: z.string().min(1) });

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Nom invalide." }, { status: 400 });
    }
    const binome = await prisma.binome.create({ data: { nom: parsed.data.nom } });
    return NextResponse.json(binome, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
