import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";
import { getPaginationParams, buildPaginatedResponse } from "@/lib/pagination";
import { createClientSchema } from "@/lib/validations/point-vente";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    await requireAuth();

    const searchParams = req.nextUrl.searchParams;
    const { page, pageSize, skip, take } = getPaginationParams(searchParams);
    const search = searchParams.get("search") ?? undefined;
    const pointVenteId = searchParams.get("pointVenteId") ?? undefined;
    const statut = searchParams.get("statut") ?? undefined;

    const where: Prisma.ClientWhereInput = {
      ...(pointVenteId ? { pointVenteId } : {}),
      ...(statut ? { statut: statut as never } : {}),
      ...(search
        ? {
            OR: [
              { nom: { contains: search, mode: "insensitive" } },
              { telephone: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [data, total] = await prisma.$transaction([
      prisma.client.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: { pointVente: { select: { id: true, nom: true } } },
      }),
      prisma.client.count({ where }),
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
    const parsed = createClientSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Données invalides.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const client = await prisma.client.create({ data: parsed.data });
    return NextResponse.json(client, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
