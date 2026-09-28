import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireAdmin();
    const produits = await prisma.produit.findMany({ orderBy: { code: "asc" } });
    // Prisma sérialise les champs Decimal en texte (ex: "75.00"), pas en
    // nombre JS — sans cette conversion, un champ jamais retapé par
    // l'admin (donc resté à sa valeur pré-remplie) échoue la validation
    // zod côté serveur ailleurs dans l'app (z.number() refuse une string).
    const data = produits.map((p) => ({
      ...p,
      prixSachet: Number(p.prixSachet),
      prixFilet: p.prixFilet !== null ? Number(p.prixFilet) : null,
      prixCarton: Number(p.prixCarton),
    }));
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}

const createSchema = z.object({
  code: z
    .string()
    .min(2)
    .max(20)
    .regex(/^[A-Z0-9_]+$/, "Majuscules, chiffres, underscore uniquement (ex: HYPO2)"),
  nom: z.string().min(2),
  volumeMl: z.number().int().min(1),
  sachetsParCarton: z.number().int().min(1),
  filetsParCarton: z.number().int().min(1).optional().nullable(),
  sachetsParFilet: z.number().int().min(1).optional().nullable(),
  prixSachet: z.number().min(0).default(0),
  prixFilet: z.number().min(0).optional().nullable(),
  prixCarton: z.number().min(0).default(0),
});

// Permet d'ajouter de nouveaux produits au-delà de HYPO/HTC — ils
// apparaissent automatiquement dans les formulaires qui les récupèrent
// dynamiquement via /api/referentiels (Visite de réassort notamment).
// Limitation connue : le formulaire "Nouveau recensement" garde encore un
// affichage figé à deux colonnes HYPO/HTC — un nouveau produit y sera
// disponible côté données mais pas encore affiché là, voir README.
export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const parsed = createSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Données invalides." },
        { status: 400 }
      );
    }
    const existing = await prisma.produit.findUnique({ where: { code: parsed.data.code } });
    if (existing) {
      return NextResponse.json({ error: "Ce code produit existe déjà." }, { status: 409 });
    }

    const produit = await prisma.produit.create({ data: parsed.data });
    // Fiche stock initiale à zéro — l'admin devra faire un réassort pour
    // que ce produit soit vendable (cf. limitation §18 déjà documentée :
    // une vente exige une ligne Stock existante).
    await prisma.stock.create({ data: { produitId: produit.id, quantiteSachets: 0 } });

    return NextResponse.json(produit, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
