import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireAdmin();
    const villes = await prisma.ville.findMany({ orderBy: { nom: "asc" } });
    return NextResponse.json({ data: villes });
  } catch (error) {
    return handleApiError(error);
  }
}

const schema = z.object({ nom: z.string().min(2) });

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Nom invalide." }, { status: 400 });
    }
    const existing = await prisma.ville.findUnique({ where: { nom: parsed.data.nom } });
    if (existing) {
      return NextResponse.json({ error: "Cette ville existe déjà." }, { status: 409 });
    }
    const ville = await prisma.ville.create({ data: { nom: parsed.data.nom } });
    return NextResponse.json(ville, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
