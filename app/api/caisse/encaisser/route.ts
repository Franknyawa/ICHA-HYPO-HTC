import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";

export const runtime = "nodejs";

const schema = z.object({
  venteId: z.string().uuid(),
  montant: z.number().positive().max(1_000_000_000),
  canal: z.enum(["ESPECES", "MOBILE_MONEY"]).default("ESPECES"),
});

/**
 * Encaisse tout ou partie d'un crédit : crée un vrai paiement sur la vente.
 * Le reste dû diminue ; quand il atteint zéro, l'alerte de retard liée est
 * résolue. L'argent entre en caisse automatiquement (la caisse additionne
 * tous les paiements).
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Données invalides." }, { status: 400 });
    const { venteId, montant, canal } = parsed.data;

    const resultat = await prisma.$transaction(async (tx) => {
      const vente = await tx.vente.findUnique({
        where: { id: venteId },
        select: { montantTotal: true, paiements: { select: { montant: true } } },
      });
      if (!vente) return { erreur: "Vente introuvable.", statut: 404 } as const;

      const paye = vente.paiements.reduce((s, p) => s + Number(p.montant), 0);
      const du = Number(vente.montantTotal) - paye;
      if (du <= 0) return { erreur: "Ce crédit est déjà soldé.", statut: 409 } as const;
      if (montant > du) {
        return { erreur: `Le montant dépasse le reste dû (${Math.round(du)} FCFA).`, statut: 400 } as const;
      }

      await tx.paiement.create({
        data: { uuidClient: crypto.randomUUID(), venteId, montant, modePaiement: canal, estCredit: false },
      });

      const reste = du - montant;
      if (reste <= 0) {
        await tx.alerte.updateMany({
          where: { type: "CREDIT_RETARD", entiteType: "Vente", entiteId: venteId, statut: { not: "RESOLUE" } },
          data: { statut: "RESOLUE", verifieeParId: session.userId, verifieeAt: new Date() },
        });
      }
      return { reste } as const;
    });

    if ("erreur" in resultat) return NextResponse.json({ error: resultat.erreur }, { status: resultat.statut });
    return NextResponse.json({ ok: true, reste: resultat.reste });
  } catch (error) {
    return handleApiError(error);
  }
}
