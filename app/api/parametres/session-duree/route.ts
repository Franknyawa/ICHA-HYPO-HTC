import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";
import { getDureeSessionMinutes } from "@/lib/auth/session";
import { avecJournal } from "@/lib/services/journal";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireModule("parametres");
    const minutes = await getDureeSessionMinutes();
    return NextResponse.json({ minutes });
  } catch (error) {
    return handleApiError(error);
  }
}

// Jusqu'à 30 jours (43200 min) — largement suffisant, évite les valeurs
// absurdes tout en permettant des réglages fins (ex: 30 min).
const schema = z.object({ minutes: z.number().int().min(5).max(43200) });

async function PATCH_(req: NextRequest) {
  try {
    await requireModule("parametres");
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Valeur invalide." }, { status: 400 });
    }
    await prisma.parametreSysteme.upsert({
      where: { cle: "duree_session_minutes" },
      update: { valeur: String(parsed.data.minutes) },
      create: { cle: "duree_session_minutes", valeur: String(parsed.data.minutes) },
    });
    return NextResponse.json({ ok: true, minutes: parsed.data.minutes });
  } catch (error) {
    return handleApiError(error);
  }
}

export const PATCH = avecJournal(PATCH_);
