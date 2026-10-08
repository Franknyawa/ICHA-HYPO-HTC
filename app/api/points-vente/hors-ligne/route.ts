import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";

export const runtime = "nodejs";

// Liste compacte des points de vente, téléchargée par l'app terrain pour
// permettre la recherche d'une boutique sans réseau (rotation, réassort).
// Volontairement légère : pas de photos, seulement l'identité et la position.
const MAX_POINTS = 5000;

export async function GET() {
  try {
    await requireAuth();

    const points = await prisma.pointVente.findMany({
      take: MAX_POINTS,
      orderBy: { nom: "asc" },
      select: {
        id: true,
        nom: true,
        vendeur: true,
        telephoneVendeur: true,
        typeId: true,
        latitude: true,
        longitude: true,
        ville: { select: { nom: true } },
        quartier: { select: { nom: true } },
      },
    });

    const data = points.map((p) => ({
      id: p.id,
      nom: p.nom,
      vendeur: p.vendeur,
      telephoneVendeur: p.telephoneVendeur,
      villeNom: p.ville?.nom ?? null,
      quartierNom: p.quartier?.nom ?? null,
      typeId: p.typeId,
      latitude: p.latitude !== null ? Number(p.latitude) : null,
      longitude: p.longitude !== null ? Number(p.longitude) : null,
      photoUrl: null,
    }));

    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}
