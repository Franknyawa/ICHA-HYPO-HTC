import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/auth/edge";
import { estPersonnel, moduleDePath, peutAcceder, peutModifier } from "@/lib/auth/permissions";

const COOKIE_NAME = "icha_session";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Le Superviseur consulte seulement : toute écriture (POST, PATCH, PUT,
  // DELETE) sur une rubrique d'administration est refusée côté serveur.
  if (pathname.startsWith("/api/") && !["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    if (moduleDePath(pathname)) {
      const tk = req.cookies.get(COOKIE_NAME)?.value;
      const sess = tk ? await verifySessionToken(tk) : null;
      if (sess && estPersonnel(sess.role) && !peutModifier(sess.role)) {
        return NextResponse.json(
          { error: "Ton rôle permet de consulter uniquement, pas de modifier." },
          { status: 403 }
        );
      }
    }
    return NextResponse.next();
  }

  const isAdminRoute = pathname.startsWith("/admin");
  const isCommercialRoute =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/visites") ||
    pathname.startsWith("/historique") ||
    pathname.startsWith("/profil");

  if (!isAdminRoute && !isCommercialRoute) {
    return NextResponse.next();
  }

  const token = req.cookies.get(COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAdminRoute && !estPersonnel(session.role)) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // Rubrique non autorisée pour ce rôle : retour au tableau de bord.
  if (isAdminRoute) {
    const module = moduleDePath(pathname);
    if (module && !peutAcceder(session.role, module)) {
      return NextResponse.redirect(new URL("/admin/dashboard", req.url));
    }
  }

  if (isCommercialRoute && session.role !== "COMMERCIAL") {
    return NextResponse.redirect(new URL("/admin/dashboard", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/dashboard/:path*",
    "/visites/:path*",
    "/historique/:path*",
    "/profil/:path*",
    "/api/:path*",
  ],
};
