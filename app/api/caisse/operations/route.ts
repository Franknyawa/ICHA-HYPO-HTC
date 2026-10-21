import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";
import { getCaisse } from "@/lib/queries/caisse";

export const runtime = "nodejs";

const schema = z.object({
  type: z.enum(["DEPENSE", "RECETTE"]),
  canal: z.enum(["ESPECES", "MOBILE_MONEY", "BANQUE"]).default("ESPECES"),
  montant: z.number().positive().max(1_000_000_000),
  categorie: z.string().trim().max(80).optional(),
  note: z.string().trim().max(300).optional(),
});

/** Enregistre une dépense ou une autre recette dans la caisse. */
export async function POST(req: NextRequest) {
  try {
    const session = await requireModule("caisse");
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Données invalides." }, { status: 400 });

    if (parsed.data.type === "DEPENSE") {
      const { solde } = await getCaisse(null, null);
      const dispo = solde[parsed.data.canal];
      if (parsed.data.montant > dispo + 0.01) {
        return NextResponse.json(
          { error: `Solde insuffisant sur ce canal (disponible : ${Math.round(dispo).toLocaleString("fr-FR")} FCFA).` },
          { status: 409 }
        );
      }
    }

    const operation = await prisma.operationCaisse.create({
      data: { ...parsed.data, createdById: session.userId },
    });
    return NextResponse.json({ ok: true, id: operation.id }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
