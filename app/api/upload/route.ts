import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";
import { uploadPhoto } from "@/lib/services/storage";

export const runtime = "nodejs";

const uploadSchema = z.object({
  dataUrl: z.string(),
  uuidClient: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();

    const json = await req.json().catch(() => null);
    const parsed = uploadSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Données invalides." }, { status: 400 });
    }

    const { dataUrl, uuidClient } = parsed.data;
    const extension = dataUrl.includes("image/png") ? "png" : "jpg";
    const key = `photos/${session.userId}/${uuidClient}.${extension}`;

    const url = await uploadPhoto(dataUrl, key);

    return NextResponse.json({ url });
  } catch (error) {
    // Erreur de configuration (variables STORAGE_* absentes) : message
    // clair plutôt qu'un 500 générique, pour que le diagnostic soit rapide.
    if (error instanceof Error && error.message.includes("non configuré")) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return handleApiError(error);
  }
}
