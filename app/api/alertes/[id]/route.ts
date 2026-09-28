import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";

export const runtime = "nodejs";

// "resoudre" : résolution directe (comportement historique — utilisé par
// tous les types d'alerte, y compris CREDIT_RETARD quand il n'y a pas eu
// de déclaration préalable côté commercial : l'admin peut toujours
// résoudre directement sans attendre une déclaration terrain).
// "rejeter"  : uniquement valable sur une alerte EN_ATTENTE_VERIFICATION —
// écarte la déclaration du commercial, l'alerte redevient ACTIVE.
const schema = z.object({
  action: z.enum(["resoudre", "rejeter"]).default("resoudre"),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await requireAdmin();

    const json = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Action invalide." }, { status: 400 });
    }

    if (parsed.data.action === "rejeter") {
      const existante = await prisma.alerte.findUnique({ where: { id: params.id } });
      if (!existante || existante.statut !== "EN_ATTENTE_VERIFICATION") {
        return NextResponse.json(
          { error: "Cette alerte n'a pas de déclaration en attente de vérification." },
          { status: 409 }
        );
      }

      const alerte = await prisma.alerte.update({
        where: { id: params.id },
        data: {
          statut: "ACTIVE",
          declareeParId: null,
          declareeAt: null,
          commentaireDeclaration: null,
          verifieeParId: admin.userId,
          verifieeAt: new Date(),
        },
      });
      return NextResponse.json(alerte);
    }

    const alerte = await prisma.alerte.update({
      where: { id: params.id },
      data: {
        statut: "RESOLUE",
        verifieeParId: admin.userId,
        verifieeAt: new Date(),
      },
    });
    return NextResponse.json(alerte);
  } catch (error) {
    return handleApiError(error);
  }
}
