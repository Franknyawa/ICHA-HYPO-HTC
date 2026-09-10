import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireAdmin();
    const rows = await prisma.prixParType.findMany({
      include: {
        produit: { select: { code: true, nom: true } },
        type: { select: { nom: true } },
      },
      orderBy: [{ produit: { code: "asc" } }, { type: { ordre: "asc" } }],
    });
    // Même conversion que /api/parametres/produits — Decimal → nombre.
    const data = rows.map((r) => ({
      ...r,
      prixSachet: Number(r.prixSachet),
      prixFilet: r.prixFilet !== null ? Number(r.prixFilet) : null,
      prixCarton: Number(r.prixCarton),
    }));
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}

const schema = z.object({
  produitId: z.string(),
  typeId: z.string(),
  prixSachet: z.number().min(0),
  prixFilet: z.number().min(0).optional().nullable(),
  prixCarton: z.number().min(0),
});

// Crée ou remplace le prix spécifique pour cette combinaison
// (produit, type) — upsert sur la contrainte unique.
export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Données invalides." }, { status: 400 });
    }
    const { produitId, typeId, ...prix } = parsed.data;

    const entry = await prisma.prixParType.upsert({
      where: { produitId_typeId: { produitId, typeId } },
      update: prix,
      create: { produitId, typeId, ...prix },
    });

    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
