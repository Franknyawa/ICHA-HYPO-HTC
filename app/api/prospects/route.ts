import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";
import { getPaginationParams, buildPaginatedResponse } from "@/lib/pagination";
import { createProspectSchema } from "@/lib/validations/point-vente";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    await requireAuth();

    const searchParams = req.nextUrl.searchParams;
    const { page, pageSize, skip, take } = getPaginationParams(searchParams);
    const pointVenteId = searchParams.get("pointVenteId") ?? undefined;
    const statut = searchParams.get("statut") ?? undefined;

    const where = {
      ...(pointVenteId ? { pointVenteId } : {}),
      ...(statut ? { statut: statut as never } : {}),
    };

    const [data, total] = await prisma.$transaction([
      prisma.prospect.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: { pointVente: { select: { id: true, nom: true } } },
      }),
      prisma.prospect.count({ where }),
    ]);

    return NextResponse.json(buildPaginatedResponse(data, total, page, pageSize));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth();

    const json = await req.json().catch(() => null);
    const parsed = createProspectSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Données invalides.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const prospect = await prisma.prospect.create({ data: parsed.data });
    return NextResponse.json(prospect, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
