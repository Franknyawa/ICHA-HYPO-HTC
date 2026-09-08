import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { clearSessionCookie, verifySessionToken, COOKIE_NAME } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function POST() {
  const store = cookies();
  const token = store.get(COOKIE_NAME)?.value;

  if (token) {
    const payload = await verifySessionToken(token);
    if (payload?.sessionId) {
      // Révocation réelle côté serveur — pas seulement suppression du
      // cookie local, qui laisserait la session valide ailleurs si le
      // token avait été copié.
      await prisma.session
        .update({ where: { id: payload.sessionId }, data: { revoked: true } })
        .catch(() => {});
    }
  }

  clearSessionCookie();
  return NextResponse.json({ ok: true });
}
