import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { createSessionToken, setSessionCookie } from "@/lib/auth/session";

// Node runtime requis : bcrypt et Prisma ne tournent pas sur l'Edge Runtime.
export const runtime = "nodejs";

const MAX_ATTEMPTS = 5;
const WINDOW_MINUTES = 15;

const loginSchema = z.object({
  username: z.string().min(1, "Identifiant requis"),
  password: z.string().min(1, "Mot de passe / code requis"),
});

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null);
  const parsed = loginSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Identifiant et mot de passe requis." },
      { status: 400 }
    );
  }

  const { username, password } = parsed.data;
  const ip = req.headers.get("x-forwarded-for") ?? undefined;

  // Limitation des tentatives (§28 CDC) — sur les échecs récents pour cet identifiant.
  const since = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000);
  const recentFailures = await prisma.loginAttempt.count({
    where: { username, succes: false, createdAt: { gte: since } },
  });

  if (recentFailures >= MAX_ATTEMPTS) {
    return NextResponse.json(
      {
        error:
          "Trop de tentatives échouées. Réessaie dans quelques minutes.",
      },
      { status: 429 }
    );
  }

  const user = await prisma.user.findUnique({ where: { username } });
  const isValid =
    user && user.actif ? await verifyPassword(password, user.passwordHash) : false;

  await prisma.loginAttempt.create({
    data: {
      userId: user?.id,
      username,
      succes: Boolean(isValid),
      ip,
    },
  });

  if (!isValid || !user) {
    return NextResponse.json(
      { error: "Identifiant ou mot de passe incorrect." },
      { status: 401 }
    );
  }

  const token = await createSessionToken({
    userId: user.id,
    username: user.username,
    role: user.role,
    binomeId: user.binomeId,
    nom: user.nom,
    prenom: user.prenom,
  });

  setSessionCookie(token);

  return NextResponse.json({
    role: user.role,
    redirectTo: user.role === "ADMIN" ? "/admin/dashboard" : "/dashboard",
  });
}
