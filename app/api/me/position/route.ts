import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";

export const runtime = "nodejs";

const schema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Position invalide." }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: session.userId },
      data: {
        dernierePositionLat: parsed.data.lat,
        dernierePositionLng: parsed.data.lng,
        dernierePositionAt: new Date(),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
