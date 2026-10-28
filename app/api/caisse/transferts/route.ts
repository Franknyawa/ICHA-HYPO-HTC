import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";
import { getCaisse } from "@/lib/queries/caisse";

export const runtime = "nodejs";

const CANAUX = ["ESPECES", "MOBILE_MONEY", "BANQUE"] as const;
const LIBELLE = { ESPECES: "Espèces", MOBILE_MONEY: "OM/MoMo", BANQUE: "Banque" } as const;

const schema = z.object({
  de: z.enum(CANAUX),
  vers: z.enum(CANAUX),
  montant: z.number().positive().max(1_000_000_000),
  /** Frais retenus par l'opérateur ou la banque (facultatif) : une dépense en plus. */
  frais: z.number().min(0).max(1_000_000_000).optional(),
  note: z.string().trim().max(300).optional(),
});

/**
 * Transfert d'argent d'un compte à un autre (ex. espèces versées sur OM/MoMo,
 * OM/MoMo versé en banque). Deux écritures liées : une sortie du compte source,
 * une entrée sur le compte destination. Ce n'est ni une recette ni une dépense.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireModule("caisse");
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Données invalides." }, { status: 400 });
    const { de, vers, montant, note } = parsed.data;
    const frais = parsed.data.frais ?? 0;
    if (de === vers) return NextResponse.json({ error: "Choisissez deux comptes différents." }, { status: 400 });

    const { solde } = await getCaisse(null, null);
    if (montant + frais > solde[de] + 0.01) {
      return NextResponse.json(
        { error: `Solde insuffisant sur ${LIBELLE[de]} (disponible : ${Math.round(solde[de]).toLocaleString("fr-FR")} FCFA).` },
        { status: 409 }
      );
    }

    const ref = randomUUID();
    const titre = `${LIBELLE[de]} → ${LIBELLE[vers]}`;
    const detail = note ? `${titre} — ${note}` : titre;
    await prisma.$transaction([
      prisma.operationCaisse.create({
        data: { type: "DEPENSE", canal: de, montant, categorie: `Transfert ${titre}`, note: detail, referenceType: "TRANSFERT", referenceId: ref, createdById: session.userId },
      }),
      prisma.operationCaisse.create({
        data: { type: "RECETTE", canal: vers, montant, categorie: `Transfert ${titre}`, note: detail, referenceType: "TRANSFERT", referenceId: ref, createdById: session.userId },
      }),
      ...(frais > 0
        ? [
            prisma.operationCaisse.create({
              data: { type: "DEPENSE", canal: de, montant: frais, categorie: "Frais de transfert", note: detail, referenceType: "TRANSFERT_FRAIS", referenceId: ref, createdById: session.userId },
            }),
          ]
        : []),
    ]);
    return NextResponse.json({ ok: true, reference: ref }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
