import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";

export const runtime = "nodejs";

const schema = z.object({
  nom: z.string().trim().min(2).max(80).optional(),
  actif: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireModule("parametres");
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Données invalides." }, { status: 400 });
    const data = { ...parsed.data, ...(parsed.data.nom ? { nom: parsed.data.nom.toUpperCase() } : {}) };
    const agent = await prisma.agentFacturation.update({ where: { id: params.id }, data });
    return NextResponse.json(agent);
  } catch (error) {
    return handleApiError(error);
  }
}
