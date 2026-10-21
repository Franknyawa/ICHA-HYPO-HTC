import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";

export const runtime = "nodejs";

const schema = z.discriminatedUnion("action", [
  // Le prospect a été relancé : on note la relance et on fixe la suivante.
  z.object({ action: z.literal("relance"), dateRelance: z.string().datetime(), note: z.string().max(500).optional() }),
  z.object({ action: z.literal("converti") }),
  z.object({ action: z.literal("abandonne") }),
  z.object({ action: z.literal("reouvrir"), dateRelance: z.string().datetime() }),
]);

/** Met à jour un prospect indécis (Admin / Super Admin ; le superviseur consulte seulement). */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireModule("relances");
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Données invalides." }, { status: 400 });
    const d = parsed.data;

    const existant = await prisma.prospectIndecis.findUnique({ where: { id: params.id }, select: { note: true } });
    if (!existant) return NextResponse.json({ error: "Prospect introuvable." }, { status: 404 });

    if (d.action === "relance") {
      const horodatage = new Date().toLocaleDateString("fr-FR");
      const note = d.note?.trim() ? `${existant.note ? existant.note + "\n" : ""}[${horodatage}] ${d.note.trim()}` : existant.note;
      await prisma.prospectIndecis.update({
        where: { id: params.id },
        data: {
          statut: "A_RELANCER",
          dateRelance: new Date(d.dateRelance),
          nbRelances: { increment: 1 },
          derniereRelanceAt: new Date(),
          note,
        },
      });
    } else if (d.action === "converti") {
      await prisma.prospectIndecis.update({ where: { id: params.id }, data: { statut: "CONVERTI" } });
    } else if (d.action === "abandonne") {
      await prisma.prospectIndecis.update({ where: { id: params.id }, data: { statut: "ABANDONNE" } });
    } else {
      await prisma.prospectIndecis.update({
        where: { id: params.id },
        data: { statut: "A_RELANCER", dateRelance: new Date(d.dateRelance) },
      });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
