import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";
import { uploadPhoto } from "@/lib/services/storage";

export const runtime = "nodejs";

// Les photos sont déjà compressées côté client (voir lib/utils/image) avant
// envoi ; une limite serveur généreuse mais bornée évite qu'un client
// malveillant (ou un bug côté client) n'envoie une charge démesurée
// (coût de stockage, mémoire du serveur lors du décodage base64).
const MAX_DATA_URL_LENGTH = 8 * 1024 * 1024; // ~8 Mo de base64 (~6 Mo réels)

// Seuls png/jpeg sont produits par la compression côté client
// (lib/utils/image.ts, canvas.toDataURL("image/jpeg", ...)) — on borne le
// serveur au même allowlist plutôt que d'accepter n'importe quel type MIME
// (ex: image/svg+xml, vecteur d'XSS stocké si jamais affiché tel quel).
const DATA_URL_RE = /^data:image\/(png|jpe?g);base64,/;

const uploadSchema = z.object({
  dataUrl: z
    .string()
    .max(MAX_DATA_URL_LENGTH, "Image trop volumineuse.")
    .regex(DATA_URL_RE, "Format d'image non supporté."),
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
