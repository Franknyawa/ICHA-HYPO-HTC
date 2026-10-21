import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";
import { getCaisse } from "@/lib/queries/caisse";

export const runtime = "nodejs";

/** Supprime une opération manuelle de la caisse (erreur de saisie). */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireModule("caisse");
    const op = await prisma.operationCaisse.findUnique({ where: { id: params.id }, select: { referenceType: true, type: true, canal: true, montant: true } });
    if (op?.referenceType === "AVOIR") {
      return NextResponse.json(
        { error: "Ce remboursement est lié à une facture d'avoir : il ne peut pas être supprimé ici." },
        { status: 409 }
      );
    }
    if (op?.type === "RECETTE") {
      const { solde } = await getCaisse(null, null);
      if (Number(op.montant) > solde[op.canal] + 0.01) {
        return NextResponse.json(
          { error: "Suppression impossible : le solde de ce canal deviendrait négatif." },
          { status: 409 }
        );
      }
    }
    const res = await prisma.operationCaisse.deleteMany({ where: { id: params.id } });
    if (res.count === 0) return NextResponse.json({ error: "Opération introuvable." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
