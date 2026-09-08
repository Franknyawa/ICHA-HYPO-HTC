import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";

export const runtime = "nodejs";

// Volontairement restreint aux prix et à l'activation — le "code" (HYPO/HTC)
// est utilisé comme identifiant dans toute la logique métier (calcul de
// prix, conversions, formulaires) ; le renommer casserait l'application.
const schema = z.object({
  prixSachet: z.number().min(0).optional(),
  prixFilet: z.number().min(0).optional().nullable(),
  prixCarton: z.number().min(0).optional(),
  actif: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin();
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Données invalides." }, { status: 400 });
    }
    const produit = await prisma.produit.update({ where: { id: params.id }, data: parsed.data });
    return NextResponse.json(produit);
  } catch (error) {
    return handleApiError(error);
  }
}
