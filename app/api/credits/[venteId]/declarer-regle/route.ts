import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";

export const runtime = "nodejs";

const schema = z.object({
  commentaire: z.string().trim().max(300).optional(),
});

/**
 * Déclaration par le commercial ("j'ai encaissé ce crédit sur le terrain")
 * — ne crée AUCUN paiement, c'est une déclaration administrative qui passe
 * l'alerte CREDIT_RETARD associée en EN_ATTENTE_VERIFICATION. Un admin doit
 * ensuite confirmer (voir PATCH /api/alertes/[id]) pour qu'elle soit
 * définitivement écartée du dashboard.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { venteId: string } }
) {
  try {
    const session = await requireAuth();

    const json = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Commentaire invalide." }, { status: 400 });
    }

    const vente = await prisma.vente.findUnique({
      where: { id: params.venteId },
      select: {
        id: true,
        commercialId: true,
        montantTotal: true,
        paiements: { select: { montant: true } },
      },
    });

    if (!vente) {
      return NextResponse.json({ error: "Vente introuvable." }, { status: 404 });
    }
    // Un commercial ne déclare que ses propres crédits — un admin peut
    // toujours résoudre n'importe quelle alerte directement depuis
    // /admin/alertes sans passer par cette déclaration.
    if (vente.commercialId !== session.userId) {
      return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
    }

    const paye = vente.paiements.reduce((s, p) => s + Number(p.montant), 0);
    const montantDu = Number(vente.montantTotal) - paye;
    if (montantDu <= 0) {
      return NextResponse.json(
        { error: "Ce crédit est déjà soldé." },
        { status: 409 }
      );
    }

    const existante = await prisma.alerte.findFirst({
      where: { type: "CREDIT_RETARD", entiteType: "Vente", entiteId: vente.id },
    });

    if (existante?.statut === "EN_ATTENTE_VERIFICATION") {
      return NextResponse.json(
        { error: "Déjà déclaré — en attente de vérification par un admin." },
        { status: 409 }
      );
    }
    if (existante?.statut === "RESOLUE") {
      return NextResponse.json(
        { error: "Ce crédit a déjà été validé comme réglé." },
        { status: 409 }
      );
    }

    const donneesDeclaration = {
      statut: "EN_ATTENTE_VERIFICATION" as const,
      declareeParId: session.userId,
      declareeAt: new Date(),
      commentaireDeclaration: parsed.data.commentaire || null,
    };

    const alerte = existante
      ? await prisma.alerte.update({ where: { id: existante.id }, data: donneesDeclaration })
      : await prisma.alerte.create({
          data: {
            type: "CREDIT_RETARD",
            message: `Crédit déclaré réglé par le commercial : ${montantDu.toLocaleString("fr-FR")} FCFA.`,
            entiteType: "Vente",
            entiteId: vente.id,
            ...donneesDeclaration,
          },
        });

    return NextResponse.json(alerte);
  } catch (error) {
    return handleApiError(error);
  }
}
