import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";

export const runtime = "nodejs";

/** Lignes de la commande avec ce qui peut encore être crédité / retourné (pour la fenêtre Avoir / Retour). */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireModule("factures");
    const [commande, retours, avoirs] = await Promise.all([
      prisma.commande.findUnique({
        where: { id: params.id },
        select: {
          montantTotal: true,
          lignes: {
            select: {
              id: true, nbCartons: true, nbFilets: true, nbSachets: true,
              produit: { select: { nom: true, code: true } },
            },
          },
        },
      }),
      prisma.factureRetour.findMany({ where: { commandeId: params.id }, select: { lignes: true } }),
      prisma.factureAvoir.aggregate({ where: { commandeId: params.id }, _sum: { montant: true } }),
    ]);
    if (!commande) return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });

    const rendu = new Map<string, { c: number; f: number; s: number }>();
    for (const r of retours) {
      for (const l of (r.lignes as unknown as { ligneId: string; source: { nbCartons: number; nbFilets: number; nbSachets: number } }[]) ?? []) {
        const cur = rendu.get(l.ligneId) ?? { c: 0, f: 0, s: 0 };
        cur.c += l.source.nbCartons; cur.f += l.source.nbFilets; cur.s += l.source.nbSachets;
        rendu.set(l.ligneId, cur);
      }
    }
    return NextResponse.json({
      montantTotal: Number(commande.montantTotal),
      dejaCredite: Number(avoirs._sum.montant ?? 0),
      lignes: commande.lignes.map((l) => {
        const r = rendu.get(l.id) ?? { c: 0, f: 0, s: 0 };
        return {
          id: l.id, nom: l.produit.nom, code: l.produit.code,
          cartons: l.nbCartons - r.c, filets: l.nbFilets - r.f, sachets: l.nbSachets - r.s,
        };
      }),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
