import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireModule("parametres");
    const data = await prisma.agentFacturation.findMany({ orderBy: { nom: "asc" } });
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}

const schema = z.object({ nom: z.string().trim().min(2).max(80) });

export async function POST(req: NextRequest) {
  try {
    await requireModule("parametres");
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Nom invalide." }, { status: 400 });
    const agent = await prisma.agentFacturation.create({ data: { nom: parsed.data.nom.toUpperCase() } });
    return NextResponse.json(agent, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
