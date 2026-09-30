import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";

export const runtime = "nodejs";

export async function PATCH(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAuth();

    // updateMany plutôt que update : si la notification n'appartient pas à
    // l'appelant, la condition where ne matche rien (0 ligne modifiée) au
    // lieu de renvoyer une erreur Prisma "not found" — comportement identique
    // pour un id inexistant ou un id d'un autre utilisateur, sans fuite
    // d'information sur l'existence de la ressource.
    const { count } = await prisma.notification.updateMany({
      where: { id: params.id, userId: session.userId },
      data: { lu: true },
    });

    if (count === 0) {
      return NextResponse.json({ error: "Notification introuvable." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
