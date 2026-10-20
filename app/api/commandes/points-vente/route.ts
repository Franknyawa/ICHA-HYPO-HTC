import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";

export const runtime = "nodejs";

/** Recherche légère d'un point de vente existant (nom, contact, repère) pour créer une commande au bureau. */
export async function GET(req: NextRequest) {
  try {
    await requireModule("commandes");
    const q = (req.nextUrl.searchParams.get("search") ?? "").trim();
    if (q.length < 2) return NextResponse.json({ data: [] });
    const data = await prisma.pointVente.findMany({
      where: {
        archivedAt: null,
        OR: [
          { nom: { contains: q, mode: "insensitive" } },
          { vendeur: { contains: q, mode: "insensitive" } },
          { telephoneVendeur: { contains: q } },
        ],
      },
      take: 8,
      orderBy: { nom: "asc" },
      select: {
        id: true,
        nom: true,
        vendeur: true,
        telephoneVendeur: true,
        typeId: true,
        ville: { select: { nom: true } },
        quartier: { select: { nom: true } },
      },
    });
    return NextResponse.json({
      data: data.map((p) => ({
        id: p.id,
        nom: p.nom,
        vendeur: p.vendeur,
        telephoneVendeur: p.telephoneVendeur,
        typeId: p.typeId,
        villeNom: p.ville?.nom ?? null,
        quartierNom: p.quartier?.nom ?? null,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
