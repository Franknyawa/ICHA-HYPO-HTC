import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireModule } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";
import { fusionnerClients, FusionError } from "@/lib/services/fusion-clients";

export const runtime = "nodejs";

const schema = z.object({
  principalId: z.string().uuid(),
  doublonIds: z.array(z.string().uuid()).min(1),
  nom: z.string().min(2),
});

/** Fusion de clients en doublon (super administrateur uniquement). */
export async function POST(req: NextRequest) {
  try {
    const session = await requireModule("clients");
    if (session.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Réservé au super administrateur." }, { status: 403 });
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Données invalides." }, { status: 400 });
    const resume = await fusionnerClients(parsed.data);
    return NextResponse.json({ ok: true, ...resume });
  } catch (error) {
    if (error instanceof FusionError) return NextResponse.json({ error: error.message }, { status: 400 });
    return handleApiError(error);
  }
}
