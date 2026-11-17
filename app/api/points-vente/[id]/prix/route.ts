import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";
import { avecJournal } from "@/lib/services/journal";
import { chargerPrixClient, enregistrerPrixClient, prixClientSchema, verifierPrixClient } from "@/lib/services/prix-client";

export const runtime = "nodejs";

// Prix négociés d'un client (grossiste) : prix du carton fixe et/ou grille par quantité, par produit.
// Lecture et modification : super admin, admin et superviseur (module « points-vente »). Un commercial
// n'a aucun accès : il subit les prix appliqués par le serveur.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireModule("points-vente");
    const pv = await prisma.pointVente.findUnique({ where: { id: params.id }, select: { id: true } });
    if (!pv) return NextResponse.json({ error: "Introuvable." }, { status: 404 });
    const { prixClient, paliersClient } = await chargerPrixClient(prisma, params.id);
    const produits = await prisma.produit.findMany({ where: { actif: true }, orderBy: { code: "asc" }, select: { id: true, code: true, nom: true, prixCarton: true } });
    return NextResponse.json({
      produits: produits.map((p) => ({ ...p, prixCarton: Number(p.prixCarton) })),
      prixClient: prixClient.map((p) => ({ produitId: p.produitId, prixCarton: Number(p.prixCarton) })),
      paliersClient: paliersClient.map((p) => ({
        produitId: p.produitId,
        minCartons: p.minCartons,
        maxCartons: p.maxCartons,
        prixCarton: Number(p.prixCarton),
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

async function PUT_(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireModule("points-vente");
    const parsed = prixClientSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Données invalides.", details: parsed.error.flatten() }, { status: 400 });

    const erreur = verifierPrixClient(parsed.data);
    if (erreur) return NextResponse.json({ error: erreur }, { status: 400 });

    const pv = await prisma.pointVente.findUnique({ where: { id: params.id }, select: { id: true } });
    if (!pv) return NextResponse.json({ error: "Introuvable." }, { status: 404 });

    const ids = Array.from(new Set(parsed.data.produits.map((p) => p.produitId)));
    const existants = await prisma.produit.count({ where: { id: { in: ids } } });
    if (existants !== ids.length) return NextResponse.json({ error: "Produit inconnu." }, { status: 400 });
    if (ids.length !== parsed.data.produits.length) return NextResponse.json({ error: "Produit en double." }, { status: 400 });

    await prisma.$transaction((tx) => enregistrerPrixClient(tx, params.id, parsed.data, session.userId));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}

export const PUT = avecJournal(PUT_);
