import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireModule } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";
import { creerRetour, CorrectionError, InsufficientStockError } from "@/lib/services/corrections";

export const runtime = "nodejs";

const ligne = z.object({
  ligneId: z.string(),
  nbCartons: z.number().int().min(0),
  nbFilets: z.number().int().min(0),
  nbSachets: z.number().int().min(0),
});
const schema = z.object({
  commandeId: z.string(),
  motif: z.string().trim().min(2).max(300),
  lignes: z.array(ligne).min(1),
  destination: z.enum(["STOCK", "AVARIES"]),
});

/** Émet une facture retour (FR00001…), remet en stock ou en avaries, et crée l'avoir associé si demandé. */
export async function POST(req: NextRequest) {
  try {
    const session = await requireModule("factures");
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Données invalides." }, { status: 400 });
    const res = await creerRetour({ ...parsed.data, creerAvoir: false, userId: session.userId });
    return NextResponse.json(res, { status: 201 });
  } catch (error) {
    if (error instanceof CorrectionError) return NextResponse.json({ error: error.message }, { status: 400 });
    if (error instanceof InsufficientStockError) {
      return NextResponse.json({ error: "Mouvement de stock impossible." }, { status: 409 });
    }
    return handleApiError(error);
  }
}
