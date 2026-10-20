import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";

export const runtime = "nodejs";

const schema = z.object({ modePaiement: z.enum(["ESPECES", "MOBILE_MONEY", "CREDIT_PARTIEL", "CREDIT_TOTAL"]) });

/**
 * Corrige le mode de paiement (ex. annoncé OM/MOMO sur le terrain, finalement
 * réglé en espèces à la livraison). Les paiements déjà validés gardent leur
 * canal d'origine : seule l'information affichée sur la commande et la
 * facture change.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireModule("commandes");
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Mode de paiement invalide." }, { status: 400 });
    const existe = await prisma.commande.findUnique({ where: { id: params.id }, select: { id: true } });
    if (!existe) return NextResponse.json({ error: "Introuvable." }, { status: 404 });
    await prisma.commande.update({ where: { id: params.id }, data: { modePaiement: parsed.data.modePaiement } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
