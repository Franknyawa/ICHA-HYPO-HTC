import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";

export const runtime = "nodejs";

const schema = z.object({
  type: z.enum(["VENTE", "COMMANDE"]).default("VENTE"),
  id: z.string().uuid(),
  montant: z.number().positive().max(1_000_000_000),
  canal: z.enum(["ESPECES", "MOBILE_MONEY", "BANQUE"]).default("ESPECES"),
});

/**
 * Valide l'argent reçu (espèces ou OM/MOMO) pour une vente ou une commande : crée un vrai paiement.
 * Le reste dû diminue ; quand il atteint zéro, l'alerte de retard liée est
 * résolue. L'argent entre en caisse automatiquement (la caisse additionne
 * tous les paiements).
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireModule("caisse");
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Données invalides." }, { status: 400 });
    const { type, id, montant, canal } = parsed.data;

    const resultat = await prisma.$transaction(async (tx) => {
      // Verrou de ligne : deux encaissements simultanés sur la même commande se font
      // l'un après l'autre (sinon le client pourrait être encaissé deux fois).
      if (type === "COMMANDE") await tx.$queryRaw`SELECT id FROM commandes WHERE id = ${id} FOR UPDATE`;
      else await tx.$queryRaw`SELECT id FROM ventes WHERE id = ${id} FOR UPDATE`;
      const doc =
        type === "VENTE"
          ? await tx.vente.findUnique({
              where: { id },
              select: { montantTotal: true, paiements: { select: { montant: true } } },
            })
          : await tx.commande.findUnique({
              where: { id },
              select: { montantTotal: true, statut: true, paiements: { select: { montant: true } } },
            });
      if (!doc) return { erreur: "Commande introuvable.", statut: 404 } as const;
      if (type === "COMMANDE" && "statut" in doc && !["EN_LIVRAISON", "LIVREE"].includes(String(doc.statut))) {
        return { erreur: "Cette commande n'est pas validée : validez-la avant d'encaisser.", statut: 409 } as const;
      }

      const paye = doc.paiements.reduce((s, p) => s + Number(p.montant), 0);
      // Les factures d'avoir réduisent ce que le client doit encore payer.
      const avoirs =
        type === "COMMANDE"
          ? Number((await tx.factureAvoir.aggregate({ where: { commandeId: id }, _sum: { montant: true } }))._sum.montant ?? 0)
          : 0;
      const du = Number(doc.montantTotal) - avoirs - paye;
      if (du <= 0.5) return { erreur: "Cette commande est déjà soldée.", statut: 409 } as const;
      if (montant > du + 0.01) {
        return { erreur: `Le montant dépasse le reste dû (${Math.round(du)} FCFA).`, statut: 400 } as const;
      }

      await tx.paiement.create({
        data: {
          uuidClient: crypto.randomUUID(),
          ...(type === "VENTE" ? { venteId: id } : { commandeId: id }),
          montant,
          modePaiement: canal,
          estCredit: false,
          encaisseParId: session.userId,
        },
      });

      const reste = du - montant;
      if (reste <= 0.5) {
        // Soldée : le mode réellement utilisé devient celui de la commande.
        if (type === "VENTE") await tx.vente.update({ where: { id }, data: { modePaiement: canal } });
        else await tx.commande.update({ where: { id }, data: { modePaiement: canal } });
        if (type === "VENTE") {
          await tx.alerte.updateMany({
            where: { type: "CREDIT_RETARD", entiteType: "Vente", entiteId: id, statut: { not: "RESOLUE" } },
            data: { statut: "RESOLUE", verifieeParId: session.userId, verifieeAt: new Date() },
          });
        }
      }
      return { reste } as const;
    });

    if ("erreur" in resultat) return NextResponse.json({ error: resultat.erreur }, { status: resultat.statut });
    return NextResponse.json({ ok: true, reste: resultat.reste });
  } catch (error) {
    return handleApiError(error);
  }
}
