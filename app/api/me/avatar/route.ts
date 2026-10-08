import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";
import { isTrustedPhotoUrl } from "@/lib/services/storage";

export const runtime = "nodejs";

// https uniquement et sous le domaine de stockage configuré : empêche de
// pointer le profil vers une URL arbitraire (suivi externe, schéma
// `javascript:`...).
const schema = z.object({
  avatarUrl: z.string().url("URL invalide.").refine(isTrustedPhotoUrl, "URL non autorisée."),
});

export async function PATCH(req: NextRequest) {
  try {
    const session = await requireAuth();

    const json = await req.json().catch(() => null);
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "URL invalide." }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: session.userId },
      data: { avatarUrl: parsed.data.avatarUrl },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
