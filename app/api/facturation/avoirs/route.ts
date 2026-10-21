import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireModule } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";
import { creerAvoir, CorrectionError } from "@/lib/services/corrections";

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
  lignes: z.array(ligne).default([]),
  montantLibre: z.number().min(0).max(1_000_000_000).optional(),
  // Canal du remboursement si le client avait déjà payé.
  canal: z.enum(["ESPECES", "MOBILE_MONEY", "BANQUE"]).default("ESPECES"),
});

/** Émet une facture d'avoir (FA00001…). Réservé Admin / Super Admin (module « factures »). */
export async function POST(req: NextRequest) {
  try {
    const session = await requireModule("factures");
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Données invalides." }, { status: 400 });
    const avoir = await creerAvoir({ ...parsed.data, userId: session.userId });
    return NextResponse.json(avoir, { status: 201 });
  } catch (error) {
    if (error instanceof CorrectionError) return NextResponse.json({ error: error.message }, { status: 400 });
    return handleApiError(error);
  }
}
