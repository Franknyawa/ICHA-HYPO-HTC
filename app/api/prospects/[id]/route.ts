import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";
import { z } from "zod";

export const runtime = "nodejs";

const updateProspectSchema = z.object({
  statut: z.enum(["NOUVEAU", "A_RELANCER", "CONVERTI", "ABANDONNE"]),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth();

    const json = await req.json().catch(() => null);
    const parsed = updateProspectSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json({ error: "Statut invalide." }, { status: 400 });
    }

    const prospect = await prisma.prospect.update({
      where: { id: params.id },
      data: { statut: parsed.data.statut },
    });

    // Un prospect converti devient un client — création automatique si
    // aucun client n'existe déjà pour ce point de vente/nom.
    if (parsed.data.statut === "CONVERTI") {
      const existingClient = await prisma.client.findFirst({
        where: { pointVenteId: prospect.pointVenteId, nom: prospect.nom },
      });

      if (!existingClient) {
        await prisma.client.create({
          data: {
            pointVenteId: prospect.pointVenteId,
            nom: prospect.nom,
            telephone: prospect.telephone,
          },
        });
      }
    }

    return NextResponse.json(prospect);
  } catch (error) {
    return handleApiError(error);
  }
}
