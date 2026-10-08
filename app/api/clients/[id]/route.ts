import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";
import { getClientDetail } from "@/lib/queries/clients";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin();

    const client = await getClientDetail(params.id);
    if (!client) {
      return NextResponse.json({ error: "Client introuvable." }, { status: 404 });
    }

    return NextResponse.json(client);
  } catch (error) {
    return handleApiError(error);
  }
}

const updateClientSchema = z.object({
  nom: z.string().min(2).optional(),
  telephone: z.string().optional().nullable(),
  statut: z.enum(["ACTIF", "INACTIF"]).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin();

    const json = await req.json().catch(() => null);
    const parsed = updateClientSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Données invalides." }, { status: 400 });
    }

    const client = await prisma.client.update({
      where: { id: params.id },
      data: parsed.data,
      select: { id: true, nom: true, telephone: true, statut: true },
    });

    return NextResponse.json(client);
  } catch (error) {
    return handleApiError(error);
  }
}
