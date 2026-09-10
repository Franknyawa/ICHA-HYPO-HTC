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

// Suppression réelle — mais seulement si le produit n'a JAMAIS été vendu
// ni commandé (aucune ligne historique ne doit disparaître). Dans le cas
// contraire, on refuse clairement plutôt que de casser des ventes passées
// et on suggère la désactivation, cohérent avec le reste de l'app
// (villes/types/binômes : jamais de suppression physique si déjà utilisé).
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin();

    const [nbVentes, nbCommandes] = await Promise.all([
      prisma.venteLigne.count({ where: { produitId: params.id } }),
      prisma.commandeLigne.count({ where: { produitId: params.id } }),
    ]);

    if (nbVentes > 0 || nbCommandes > 0) {
      return NextResponse.json(
        {
          error:
            "Ce produit a déjà été vendu ou commandé — il ne peut pas être supprimé sans casser l'historique. Désactive-le à la place.",
        },
        { status: 409 }
      );
    }

    await prisma.$transaction([
      prisma.prixParType.deleteMany({ where: { produitId: params.id } }),
      prisma.stock.deleteMany({ where: { produitId: params.id } }),
      prisma.produit.delete({ where: { id: params.id } }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
