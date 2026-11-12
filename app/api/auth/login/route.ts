import { pageAccueil } from "@/lib/auth/permissions";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  createSessionToken,
  setSessionCookie,
  getDureeSessionMinutes,
} from "@/lib/auth/session";

// Node runtime requis : bcrypt et Prisma ne tournent pas sur l'Edge Runtime.
export const runtime = "nodejs";

const MAX_ATTEMPTS = 8;
const WINDOW_MINUTES = 10;
// Plafond par adresse IP, plus large que celui par identifiant : plusieurs
// commerciaux peuvent légitimement partager la même IP (même réseau mobile),
// mais une IP qui enchaîne des dizaines d'échecs sur des comptes différents
// est une tentative de devinette de mots de passe.
const MAX_ATTEMPTS_PAR_IP = 120;

// Hash factice, comparé quand l'identifiant n'existe pas (ou est
// désactivé) : le temps de réponse est ainsi le même qu'avec un vrai
// compte, ce qui empêche de deviner quels identifiants existent en
// chronométrant les réponses.
const dummyHashPromise = hashPassword(crypto.randomUUID());

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

  // Les claviers de téléphone mettent une majuscule en tête et ajoutent parfois une espace : « Marie » = « marie ».
  const username = parsed.data.username.trim();
  const password = parsed.data.password;
  // x-forwarded-for peut contenir une chaîne "client, proxy1, proxy2" : seule
  // la première adresse est celle du client.
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined;

  // Limitation des tentatives (§28 CDC) — sur les échecs récents pour cet identifiant.
  const since = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000);
  const recentFailures = await prisma.loginAttempt.count({
    where: { username: { equals: username, mode: "insensitive" }, succes: false, createdAt: { gte: since } },
  });

  const recentFailuresIp = ip
    ? await prisma.loginAttempt.count({
        where: { ip, succes: false, createdAt: { gte: since } },
      })
    : 0;

  if (recentFailures >= MAX_ATTEMPTS || recentFailuresIp >= MAX_ATTEMPTS_PAR_IP) {
    return NextResponse.json(
      {
        error: `Trop de tentatives échouées. Réessaie dans ${WINDOW_MINUTES} minutes (ou demande à l'administrateur de vérifier ton mot de passe).`,
      },
      { status: 429 }
    );
  }

  // Identifiant exact d'abord, puis sans tenir compte des majuscules.
  const user =
    (await prisma.user.findUnique({ where: { username }, include: { binome: { select: { nom: true } } } })) ??
    (await prisma.user.findFirst({
      where: { username: { equals: username, mode: "insensitive" } },
      include: { binome: { select: { nom: true } } },
    }));
  const isValid =
    user && user.actif
      ? await verifyPassword(password, user.passwordHash)
      : (await verifyPassword(password, await dummyHashPromise), false);

  await prisma.loginAttempt.create({
    data: {
      userId: user?.id,
      username: user?.username ?? username,
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

  const dureeMinutes = await getDureeSessionMinutes();
  const dureeSecondes = dureeMinutes * 60;

  const session = await prisma.session.create({
    data: {
      userId: user.id,
      userAgent: req.headers.get("user-agent") ?? undefined,
      expiresAt: new Date(Date.now() + dureeSecondes * 1000),
    },
  });

  const token = await createSessionToken(
    {
      userId: user.id,
      username: user.username,
      role: user.role,
      binomeId: user.binomeId,
      binomeNom: user.binome?.nom ?? null,
      nom: user.nom,
      prenom: user.prenom,
      sessionId: session.id,
    },
    dureeSecondes
  );

  setSessionCookie(token, dureeSecondes);

  return NextResponse.json({
    role: user.role,
    redirectTo: pageAccueil(user.role),
  });
}
