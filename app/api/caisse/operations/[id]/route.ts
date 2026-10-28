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
    const op = await prisma.operationCaisse.findUnique({ where: { id: params.id }, select: { referenceType: true, referenceId: true, type: true, canal: true, montant: true } });
    if (op?.referenceType === "DOUBLON") {
      return NextResponse.json({ error: "Cette écriture neutralise un encaissement en doublon : elle ne peut pas être supprimée." }, { status: 409 });
    }
    if (op?.referenceType === "AVOIR" || op?.referenceType === "RETOUR") {
      return NextResponse.json(
        { error: "Ce remboursement est lié à une facture d'avoir ou de retour : il ne peut pas être supprimé ici." },
        { status: 409 }
      );
    }
    if ((op?.referenceType === "TRANSFERT" || op?.referenceType === "TRANSFERT_FRAIS") && op.referenceId) {
      // Un transfert s'annule en entier (sortie + entrée + frais), sinon les comptes seraient faussés.
      const groupe = await prisma.operationCaisse.findMany({
        where: { referenceId: op.referenceId, referenceType: { in: ["TRANSFERT", "TRANSFERT_FRAIS"] } },
        select: { type: true, canal: true, montant: true, referenceType: true },
      });
      const { solde } = await getCaisse(null, null);
      const delta: Record<string, number> = { ESPECES: 0, MOBILE_MONEY: 0, BANQUE: 0 };
      for (const g of groupe) delta[g.canal] += g.type === "RECETTE" ? -Number(g.montant) : Number(g.montant);
      for (const c of Object.keys(delta)) {
        if (solde[c as "ESPECES"] + delta[c] < -0.01) {
          return NextResponse.json({ error: "Annulation impossible : le solde d'un des comptes deviendrait négatif." }, { status: 409 });
        }
      }
      await prisma.operationCaisse.deleteMany({ where: { referenceId: op.referenceId, referenceType: { in: ["TRANSFERT", "TRANSFERT_FRAIS"] } } });
      return NextResponse.json({ ok: true });
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
