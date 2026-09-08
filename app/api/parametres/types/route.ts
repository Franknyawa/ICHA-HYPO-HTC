import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireAdmin();
    const types = await prisma.typePointVente.findMany({ orderBy: { ordre: "asc" } });
    return NextResponse.json({ data: types });
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
    const existing = await prisma.typePointVente.findUnique({ where: { nom: parsed.data.nom } });
    if (existing) {
      return NextResponse.json({ error: "Ce type existe déjà." }, { status: 409 });
    }
    const type = await prisma.typePointVente.create({ data: { nom: parsed.data.nom } });
    return NextResponse.json(type, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
