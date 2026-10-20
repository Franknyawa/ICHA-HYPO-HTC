import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";
import { validerGrille } from "@/lib/utils/tarifs";

export const runtime = "nodejs";

const schema = z.object({
  paliers: z
    .array(
      z.object({
        minCartons: z.number().int().min(0).max(1_000_000),
        maxCartons: z.number().int().min(0).max(1_000_000).nullable(),
        prixCarton: z.number().min(0).max(1_000_000_000),
      })
    )
    .max(30),
});

/** Remplace d'un coup toute la grille tarifaire d'un produit (liste vide = pas de grille). */
export async function PUT(req: NextRequest, { params }: { params: { produitId: string } }) {
  try {
    await requireModule("parametres");
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Grille invalide." }, { status: 400 });

    const erreur = validerGrille(parsed.data.paliers);
    if (erreur) return NextResponse.json({ error: erreur }, { status: 400 });

    const produit = await prisma.produit.findUnique({ where: { id: params.produitId }, select: { id: true } });
    if (!produit) return NextResponse.json({ error: "Produit introuvable." }, { status: 404 });

    await prisma.$transaction([
      prisma.palierPrix.deleteMany({ where: { produitId: params.produitId } }),
      prisma.palierPrix.createMany({
        data: parsed.data.paliers.map((p) => ({ ...p, produitId: params.produitId })),
      }),
    ]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
