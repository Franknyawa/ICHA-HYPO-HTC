import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireModule } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";
import { obtenirFacture } from "@/lib/services/documents-data";

export const runtime = "nodejs";

const schema = z.object({ agentId: z.string().uuid().optional().nullable() });

/** Donne (et crée au besoin) la facture numérotée de ce document ; l'agent de facturation peut être choisi. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireModule("commandes");
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: "Données invalides." }, { status: 400 });
    const facture = await obtenirFacture("COMMANDE", params.id, parsed.data.agentId);
    if (!facture) return NextResponse.json({ error: "Document introuvable." }, { status: 404 });
    return NextResponse.json(facture);
  } catch (error) {
    return handleApiError(error);
  }
}
