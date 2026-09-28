import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";
import { updatePointVenteSchema } from "@/lib/validations/point-vente";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth();

    const pointVente = await prisma.pointVente.findUnique({
      where: { id: params.id },
      include: {
        ville: { select: { id: true, nom: true } },
        quartier: { select: { id: true, nom: true } },
        type: { select: { id: true, nom: true } },
        prospects: { orderBy: { createdAt: "desc" }, take: 20 },
        clients: { orderBy: { createdAt: "desc" }, take: 20 },
      },
    });

    if (!pointVente) {
      return NextResponse.json({ error: "Introuvable." }, { status: 404 });
    }

    return NextResponse.json(pointVente);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth();

    const json = await req.json().catch(() => null);
    const parsed = updatePointVenteSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Données invalides.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const pointVente = await prisma.pointVente.update({
      where: { id: params.id },
      data: parsed.data,
    });

    return NextResponse.json(pointVente);
  } catch (error) {
    return handleApiError(error);
  }
}
