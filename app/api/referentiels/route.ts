import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";

export const runtime = "nodejs";

// Référentiels peu modifiés (villes, quartiers, types de point de vente) —
// candidats naturels au cache, §19 doc scalabilité. Cache navigateur/CDN
// court (5 min) : assez pour limiter les requêtes répétées sans bloquer
// l'ajout d'une nouvelle ville depuis l'admin.
export async function GET(req: NextRequest) {
  try {
    await requireAuth();

    const villeId = req.nextUrl.searchParams.get("villeId") ?? undefined;

    const [villes, quartiers, types, binomes, produits, prixParType] = await Promise.all([
      prisma.ville.findMany({ where: { actif: true }, orderBy: { nom: "asc" } }),
      prisma.quartier.findMany({
        where: villeId ? { villeId } : undefined,
        orderBy: { nom: "asc" },
      }),
      prisma.typePointVente.findMany({ where: { actif: true }, orderBy: { ordre: "asc" } }),
      prisma.binome.findMany({ where: { actif: true }, orderBy: { nom: "asc" } }),
      prisma.produit.findMany({
        where: { actif: true },
        select: {
          id: true,
          code: true,
          nom: true,
          prixSachet: true,
          prixFilet: true,
          prixCarton: true,
        },
      }),
      // Surcharges de prix par (produit, type de boutique) — le formulaire
      // terrain les applique automatiquement dès que le type est choisi,
      // en repli sur le prix de base du produit si rien n'est défini pour
      // cette combinaison précise.
      prisma.prixParType.findMany({
        select: {
          produitId: true,
          typeId: true,
          prixSachet: true,
          prixFilet: true,
          prixCarton: true,
        },
      }),
    ]);

    return NextResponse.json(
      { villes, quartiers, types, binomes, produits, prixParType },
      { headers: { "Cache-Control": "private, max-age=300" } }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
