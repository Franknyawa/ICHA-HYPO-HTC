import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";
import { avecJournal } from "@/lib/services/journal";

export const runtime = "nodejs";

const schema = z.object({
  nbSachets: z.number().int().min(0).max(100000),
  nbFilets: z.number().int().min(0).max(100000),
  lieu: z.string().trim().max(200).nullish(),
});

type Params = { params: { id: string; oid: string } };

/**
 * Corrige (ou supprime) une ligne du détail « CLIENT DIVERS » d'une commerciale : la ligne d'origine, la ligne
 * cumulée de la facture, le total de la commande et — pour une vente terrain — la vente (statistiques) sont recalculés.
 * Interdit une fois la commande livrée (stock et caisse déjà touchés) ou annulée.
 */
async function appliquer(params: Params["params"], nouveau: { nbSachets: number; nbFilets: number; lieu?: string | null } | null) {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const commande = await tx.commande.findUnique({ where: { id: params.id }, select: { id: true, statut: true } });
    if (!commande) return { status: 404, error: "Commande introuvable." };
    if (commande.statut === "LIVREE" || commande.statut === "ANNULEE")
      return { status: 409, error: "Cette commande est déjà livrée ou annulée : le détail ne peut plus être modifié." };

    const o = await tx.commandeDetailOrigine.findFirst({ where: { id: params.oid, commandeId: params.id } });
    if (!o) return { status: 404, error: "Ligne introuvable." };

    const cible = nouveau ?? { nbSachets: 0, nbFilets: 0 };
    const ancienMontant = Number(o.montant);

    // Prix unitaires : ceux de la ligne cumulée correspondante (celle dont le montant colle, sinon la première).
    const lignes = await tx.commandeLigne.findMany({ where: { commandeId: params.id, produitId: o.produitId, detail: true } });
    if (lignes.length === 0) return { status: 409, error: "Ligne de facture introuvable pour ce produit." };
    const colle = lignes.find((l) => Number(l.prixSachet ?? 0) * o.nbSachets + Number(l.prixFilet ?? 0) * o.nbFilets === ancienMontant);
    const ligne = colle ?? lignes[0];
    const montant = Math.round(Number(ligne.prixSachet ?? 0) * cible.nbSachets + Number(ligne.prixFilet ?? 0) * cible.nbFilets);

    const dS = cible.nbSachets - o.nbSachets;
    const dF = cible.nbFilets - o.nbFilets;
    const dM = montant - ancienMontant;

    const restS = ligne.nbSachets + dS;
    const restF = ligne.nbFilets + dF;
    if (restS <= 0 && restF <= 0) await tx.commandeLigne.delete({ where: { id: ligne.id } });
    else
      await tx.commandeLigne.update({
        where: { id: ligne.id },
        data: { nbSachets: Math.max(0, restS), nbFilets: Math.max(0, restF), montant: Math.max(0, Number(ligne.montant) + dM) },
      });

    if (nouveau) {
      await tx.commandeDetailOrigine.update({
        where: { id: o.id },
        data: { nbSachets: cible.nbSachets, nbFilets: cible.nbFilets, montant, ...(nouveau.lieu !== undefined ? { lieu: nouveau.lieu || null } : {}) },
      });
    } else {
      await tx.commandeDetailOrigine.delete({ where: { id: o.id } });
    }

    // Statistiques : la vente terrain d'origine suit la correction.
    if (o.venteId) {
      const vl = await tx.venteLigne.findFirst({ where: { venteId: o.venteId, produitId: o.produitId, detail: true } });
      if (vl) {
        const s = Math.max(0, vl.nbSachets + dS);
        const f = Math.max(0, vl.nbFilets + dF);
        if (s === 0 && f === 0) await tx.venteLigne.delete({ where: { id: vl.id } });
        else await tx.venteLigne.update({ where: { id: vl.id }, data: { nbSachets: s, nbFilets: f, montant: Math.max(0, Number(vl.montant) + dM) } });
      }
      await tx.vente.update({ where: { id: o.venteId }, data: { montantTotal: { increment: dM } } });
    }

    const total = await tx.commandeLigne.aggregate({ where: { commandeId: params.id }, _sum: { montant: true } });
    await tx.commande.update({ where: { id: params.id }, data: { montantTotal: total._sum.montant ?? 0 } });
    return { status: 200, ok: true, montantTotal: Number(total._sum.montant ?? 0) };
  });
}

async function PATCH_(req: NextRequest, { params }: Params) {
  try {
    await requireModule("commandes");
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Données invalides." }, { status: 400 });
    if (parsed.data.nbSachets === 0 && parsed.data.nbFilets === 0)
      return NextResponse.json({ error: "Quantité nulle : utilisez « Supprimer »." }, { status: 400 });
    const r = await appliquer(params, parsed.data);
    return NextResponse.json(r, { status: r.status });
  } catch (error) {
    return handleApiError(error);
  }
}

async function DELETE_(_req: NextRequest, { params }: Params) {
  try {
    await requireModule("commandes");
    const r = await appliquer(params, null);
    return NextResponse.json(r, { status: r.status });
  } catch (error) {
    return handleApiError(error);
  }
}

export const PATCH = avecJournal(PATCH_);
export const DELETE = avecJournal(DELETE_);
