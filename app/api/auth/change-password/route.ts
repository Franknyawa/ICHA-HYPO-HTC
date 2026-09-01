import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

export const runtime = "nodejs";

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6, "Au moins 6 caractères."),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();

    const json = await req.json().catch(() => null);
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Données invalides." },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUniqueOrThrow({ where: { id: session.userId } });
    const valid = await verifyPassword(parsed.data.currentPassword, user.passwordHash);

    if (!valid) {
      return NextResponse.json(
        { error: "Mot de passe actuel incorrect." },
        { status: 401 }
      );
    }

    const passwordHash = await hashPassword(parsed.data.newPassword);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
