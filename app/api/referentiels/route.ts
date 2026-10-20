import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";
import { assurerVilles } from "@/lib/geo/synchro-villes";

export const runtime = "nodejs";

// Référentiels peu modifiés (villes, types de point de vente, prix) —
// candidats naturels au cache, §19 doc scalabilité. Cache navigateur/CDN
// court (5 min) : assez pour limiter les requêtes répétées. Les villes sont
// une liste fixe (lib/geo/cameroun.ts) ; le quartier est saisi librement.
export async function GET(_req: NextRequest) {
  try {
    await requireAuth();
    await assurerVilles();

    const [villes, types, binomes, produits, prixParType, paliers] = await Promise.all([
      prisma.ville.findMany({ where: { actif: true }, orderBy: { nom: "asc" } }),
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
          designation: true,
          sachetsParCarton: true,
          volumeMl: true,
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
      // Grille tarifaire : prix du carton selon la quantité commandée.
      prisma.palierPrix.findMany({
        orderBy: [{ produitId: "asc" }, { minCartons: "asc" }],
        select: { produitId: true, minCartons: true, maxCartons: true, prixCarton: true },
      }),
    ]);

    // Prisma sérialise les champs Decimal en texte (ex: "75.00"), pas en
    // nombre JS — laissé tel quel, ça fausse .toLocaleString() côté
    // formulaire (comportement de tri de chaînes, pas de formatage
    // numérique) même si les opérateurs arithmétiques *, - tolèrent la
    // coercition implicite.
    const produitsNormalises = produits.map((p) => ({
      ...p,
      prixSachet: Number(p.prixSachet),
      prixFilet: p.prixFilet !== null ? Number(p.prixFilet) : null,
      prixCarton: Number(p.prixCarton),
    }));
    const prixParTypeNormalise = prixParType.map((pt) => ({
      ...pt,
      prixSachet: Number(pt.prixSachet),
      prixFilet: pt.prixFilet !== null ? Number(pt.prixFilet) : null,
      prixCarton: Number(pt.prixCarton),
    }));

    const paliersNormalises = paliers.map((p) => ({ ...p, prixCarton: Number(p.prixCarton) }));

    return NextResponse.json(
      {
        villes,
        types,
        binomes,
        produits: produitsNormalises,
        prixParType: prixParTypeNormalise,
        paliers: paliersNormalises,
      },
      { headers: { "Cache-Control": "private, max-age=300" } }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
