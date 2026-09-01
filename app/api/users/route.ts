import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";
import { hashPassword } from "@/lib/auth/password";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireAdmin();

    const users = await prisma.user.findMany({
      orderBy: [{ role: "asc" }, { nom: "asc" }],
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

    return NextResponse.json({ data: users });
  } catch (error) {
    return handleApiError(error);
  }
}

const createUserSchema = z.object({
  username: z
    .string()
    .min(3, "Au moins 3 caractères.")
    .regex(/^[a-z0-9._-]+$/i, "Lettres, chiffres, points, tirets uniquement."),
  password: z.string().min(6, "Au moins 6 caractères."),
  nom: z.string().min(1),
  prenom: z.string().min(1),
  role: z.enum(["ADMIN", "COMMERCIAL"]),
  binomeId: z.string().optional().nullable(),
});

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();

    const json = await req.json().catch(() => null);
    const parsed = createUserSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Données invalides." },
        { status: 400 }
      );
    }

    const { username, password, nom, prenom, role, binomeId } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      return NextResponse.json(
        { error: "Cet identifiant est déjà utilisé." },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        username,
        passwordHash,
        nom,
        prenom,
        role,
        binomeId: role === "COMMERCIAL" ? binomeId || null : null,
      },
      select: {
        id: true,
        username: true,
        nom: true,
        prenom: true,
        role: true,
        actif: true,
        binome: { select: { id: true, nom: true } },
      },
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
