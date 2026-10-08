import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";
import { revoquerSessionsUtilisateur } from "@/lib/auth/session";
import { isTrustedPhotoUrl } from "@/lib/services/storage";

export const runtime = "nodejs";

const updateUserSchema = z.object({
  nom: z.string().min(1).optional(),
  prenom: z.string().min(1).optional(),
  role: z.enum(["ADMIN", "COMMERCIAL"]).optional(),
  binomeId: z.string().optional().nullable(),
  actif: z.boolean().optional(),
  avatarUrl: z.string().url().refine(isTrustedPhotoUrl, "URL non autorisée.").optional().nullable(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await requireAdmin();

    const json = await req.json().catch(() => null);
    const parsed = updateUserSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Données invalides." }, { status: 400 });
    }

    const data = parsed.data;

    // Garde-fou : un admin ne peut pas se désactiver ni se rétrograder
    // lui-même (risque de verrouiller définitivement l'accès admin).
    if (
      params.id === admin.userId &&
      (data.actif === false || (data.role && data.role !== "ADMIN"))
    ) {
      return NextResponse.json(
        { error: "Tu ne peux pas désactiver ou rétrograder ton propre compte." },
        { status: 400 }
      );
    }

    const avant = await prisma.user.findUnique({
      where: { id: params.id },
      select: { role: true },
    });

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

    // Désactivation ou changement de rôle : les connexions en cours ne
    // doivent pas survivre à la décision (sinon elles gardent leurs
    // anciens droits jusqu'à expiration).
    if (data.actif === false || (data.role !== undefined && data.role !== avant?.role)) {
      await revoquerSessionsUtilisateur(params.id);
    }

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
    const admin = await requireAdmin();

    if (params.id === admin.userId) {
      return NextResponse.json(
        { error: "Tu ne peux pas désactiver ton propre compte." },
        { status: 400 }
      );
    }

    // Désactivation plutôt que suppression physique : un commercial ayant
    // déjà des visites/ventes est lié à cet historique (créateur,
    // commercial responsable...) — le supprimer casserait ces données.
    // Désactivé = ne peut plus se connecter, historique intact.
    const user = await prisma.user.update({
      where: { id: params.id },
      data: { actif: false },
      select: { id: true, username: true },
    });
    await revoquerSessionsUtilisateur(params.id);

    return NextResponse.json({ ok: true, user });
  } catch (error) {
    return handleApiError(error);
  }
}
