import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireAdmin } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";
import { updatePointVenteSchema } from "@/lib/validations/point-vente";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAuth();
    const estAdmin = session.role === "ADMIN";

    const pointVente = await prisma.pointVente.findUnique({
      where: { id: params.id },
      include: {
        ville: { select: { id: true, nom: true } },
        quartier: { select: { id: true, nom: true } },
        type: { select: { id: true, nom: true } },
        // Prospects et clients (noms + téléphones) : réservés à l'admin.
        // L'app terrain n'a besoin que de l'identité du point de vente
        // (préremplissage de la visite de réassort).
        ...(estAdmin
          ? {
              prospects: { orderBy: { createdAt: "desc" as const }, take: 20 },
              clients: { orderBy: { createdAt: "desc" as const }, take: 20 },
            }
          : {}),
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

// Modification d'un point de vente existant : admin uniquement. Un
// commercial recense un point de vente via sa visite (création) mais ne
// peut pas réécrire la fiche d'un point de vente existant (nom, GPS...).
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin();

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
