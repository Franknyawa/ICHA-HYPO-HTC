import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";

export const runtime = "nodejs";

/** Seuils d'alerte de stock par produit (en sachets), modifiés depuis Paramètres. */
export async function GET() {
  try {
    await requireModule("parametres");
    const stocks = await prisma.stock.findMany({
      select: { produitId: true, seuilAlerte: true, produit: { select: { nom: true, code: true, sachetsParCarton: true } } },
      orderBy: { produit: { nom: "asc" } },
    });
    return NextResponse.json({
      data: stocks.map((s) => ({
        produitId: s.produitId,
        nom: s.produit.nom,
        code: s.produit.code,
        sachetsParCarton: s.produit.sachetsParCarton,
        seuilAlerte: s.seuilAlerte,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
