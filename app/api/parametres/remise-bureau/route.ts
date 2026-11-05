import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireModule } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";
import { getRemiseBureauPct, setRemiseBureauPct } from "@/lib/services/remise-bureau";
import { avecJournal } from "@/lib/services/journal";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireModule("parametres");
    return NextResponse.json({ pct: await getRemiseBureauPct() });
  } catch (error) {
    return handleApiError(error);
  }
}

const schema = z.object({ pct: z.number().min(0).max(90) });

async function PATCH_(req: NextRequest) {
  try {
    await requireModule("parametres");
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Pourcentage invalide (0 à 90)." }, { status: 400 });
    await setRemiseBureauPct(parsed.data.pct);
    return NextResponse.json({ ok: true, pct: parsed.data.pct });
  } catch (error) {
    return handleApiError(error);
  }
}

export const PATCH = avecJournal(PATCH_);
