import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";
import { hashPassword } from "@/lib/auth/password";

export const runtime = "nodejs";

const schema = z.object({
  newPassword: z.string().min(6, "Au moins 6 caractères."),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin();

    const json = await req.json().catch(() => null);
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Mot de passe invalide." },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(parsed.data.newPassword);

    await prisma.user.update({
      where: { id: params.id },
      data: { passwordHash },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
