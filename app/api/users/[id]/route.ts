import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";

export const runtime = "nodejs";

const updateUserSchema = z.object({
  nom: z.string().min(1).optional(),
  prenom: z.string().min(1).optional(),
  role: z.enum(["ADMIN", "COMMERCIAL"]).optional(),
  binomeId: z.string().optional().nullable(),
  actif: z.boolean().optional(),
  avatarUrl: z.string().optional().nullable(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin();

    const json = await req.json().catch(() => null);
    const parsed = updateUserSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Données invalides." }, { status: 400 });
    }

    const data = parsed.data;
    const user = await prisma.user.update({
      where: { id: params.id },
      data: {
        ...data,
        // Un admin n'a pas de binôme — évite une incohérence si le rôle
        // change de COMMERCIAL vers ADMIN sans qu'on y pense côté client.
        ...(data.role === "ADMIN" ? { binomeId: null } : {}),
      },
      select: {
        id: true,
        username: true,
        nom: true,
        prenom: true,
        role: true,
        actif: true,
        avatarUrl: true,
        binome: { select: { id: true, nom: true } },
      },
    });

    return NextResponse.json(user);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin();

    // Désactivation plutôt que suppression physique : un commercial ayant
    // déjà des visites/ventes est lié à cet historique (créateur,
    // commercial responsable...) — le supprimer casserait ces données.
    // Désactivé = ne peut plus se connecter, historique intact.
    const user = await prisma.user.update({
      where: { id: params.id },
      data: { actif: false },
      select: { id: true, username: true },
    });

    return NextResponse.json({ ok: true, user });
  } catch (error) {
    return handleApiError(error);
  }
}
