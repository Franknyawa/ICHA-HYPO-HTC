import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";

export const runtime = "nodejs";

/** Sert une photo stockée en data URL (ancien repli) comme une vraie image, avec cache navigateur. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireAuth();
    const photo = await prisma.photo.findUnique({ where: { id: params.id }, select: { url: true } });
    if (!photo) return new NextResponse(null, { status: 404 });
    const m = /^data:(image\/(?:png|jpe?g));base64,([\s\S]*)$/.exec(photo.url);
    if (!m) return NextResponse.redirect(photo.url);
    return new NextResponse(Buffer.from(m[2], "base64"), {
      headers: { "Content-Type": m[1], "Cache-Control": "private, max-age=86400" },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
