import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";
import { applyStockMovement, InsufficientStockError } from "@/lib/services/stock";

export const runtime = "nodejs";

const schema = z.object({
  type: z.enum(["ENTREE", "SORTIE"]),
  quantiteSachets: z.number().int().min(1),
  motif: z.string().optional(),
});

// Ajustement manuel du stock — réassort (ENTREE) ou correction/perte
// (SORTIE). Réutilise le même service que la déduction automatique lors
// d'une vente, avec le même verrou optimiste (§18 CDC).
export async function POST(
  req: NextRequest,
  { params }: { params: { produitId: string } }
) {
  try {
    await requireAdmin();
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Données invalides." }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      await applyStockMovement(tx, {
        uuidClient: crypto.randomUUID(),
        produitId: params.produitId,
        type: parsed.data.type,
        quantiteSachets: parsed.data.quantiteSachets,
        referenceType: "AJUSTEMENT_MANUEL",
        referenceId: parsed.data.motif || undefined,
      });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof InsufficientStockError) {
      return NextResponse.json({ error: "Stock insuffisant pour cette sortie." }, { status: 409 });
    }
    return handleApiError(error);
  }
}
