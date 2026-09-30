import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";

export const runtime = "nodejs";

const schema = z.object({
  statut: z.enum(["EN_ATTENTE", "EN_LIVRAISON", "LIVREE", "ANNULEE"]),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Seul un admin change le statut d'une commande — décision de gestion,
    // pas une action terrain du commercial.
    await requireAdmin();

    const json = await req.json().catch(() => null);
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Statut invalide." }, { status: 400 });
    }

    const existante = await prisma.commande.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        statut: true,
        commercialId: true,
        pointVente: {
          select: {
            nom: true,
            vendeur: true,
            quartier: { select: { nom: true } },
            ville: { select: { nom: true } },
          },
        },
      },
    });

    if (!existante) {
      return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
    }

    const commande = await prisma.commande.update({
      where: { id: params.id },
      data: { statut: parsed.data.statut },
      select: { id: true, statut: true },
    });

    // Quand l'admin valide une commande (passage en livraison), le
    // commercial qui l'a enregistrée est notifié — il n'a autrement aucun
    // moyen de savoir que sa commande a été traitée avant qu'elle arrive.
    if (parsed.data.statut === "EN_LIVRAISON" && existante.statut !== "EN_LIVRAISON") {
      const nomVendeur = existante.pointVente.vendeur || existante.pointVente.nom;
      const quartier = existante.pointVente.quartier?.nom || existante.pointVente.ville?.nom || "";
      const message = quartier
        ? `Commande de ${nomVendeur} (${quartier}) : en cours de livraison.`
        : `Commande de ${nomVendeur} : en cours de livraison.`;

      await prisma.notification.create({
        data: { userId: existante.commercialId, message },
      });
    }

    return NextResponse.json(commande);
  } catch (error) {
    return handleApiError(error);
  }
}
