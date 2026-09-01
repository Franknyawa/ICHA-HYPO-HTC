import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";
import { listPointsVente } from "@/lib/queries/points-vente";
import { createPointVenteSchema } from "@/lib/validations/point-vente";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    await requireAuth();

    const sp = req.nextUrl.searchParams;
    const result = await listPointsVente({
      page: sp.get("page") ? Number(sp.get("page")) : undefined,
      pageSize: sp.get("pageSize") ? Number(sp.get("pageSize")) : undefined,
      search: sp.get("search") ?? undefined,
      villeId: sp.get("villeId") ?? undefined,
      quartierId: sp.get("quartierId") ?? undefined,
      typeId: sp.get("typeId") ?? undefined,
      triCommandes: (sp.get("triCommandes") as "asc" | "desc" | null) ?? undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();

    const json = await req.json().catch(() => null);
    const parsed = createPointVenteSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Données invalides.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { uuidClient, ...rest } = parsed.data;

    // PointVente n'a pas de colonne uuidClient dédiée (contrairement à
    // Visite/Vente/Commande/Paiement/Photo) : on utilise directement l'UUID
    // généré côté PWA comme clé primaire. Ça suffit pour l'idempotence ici
    // car un point de vente n'est jamais "rejoué" avec un id différent.
    if (uuidClient) {
      const existing = await prisma.pointVente.findUnique({
        where: { id: uuidClient },
      });
      if (existing) {
        return NextResponse.json(existing, { status: 200 });
      }
    }

    const pointVente = await prisma.pointVente.create({
      data: {
        ...rest,
        ...(uuidClient ? { id: uuidClient } : {}),
        createdById: session.userId,
      },
    });

    return NextResponse.json(pointVente, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
