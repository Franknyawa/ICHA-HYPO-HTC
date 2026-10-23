import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * Bulles de notification de l'admin : nouvelles commandes et nouveaux prospects indécis
 * créés depuis la dernière visite de la rubrique (dates passées en paramètres, ISO).
 */
export async function GET(req: Request) {
  try {
    await requireAdmin();
    const u = new URL(req.url);
    const date = (k: string) => {
      const d = new Date(u.searchParams.get(k) ?? "");
      return isNaN(d.getTime()) ? new Date() : d;
    };
    const [commandes, prospects] = await Promise.all([
      prisma.commande.count({ where: { createdAt: { gt: date("commandes") }, archivedAt: null, statut: { not: "ANNULEE" } } }),
      prisma.prospectIndecis.count({ where: { createdAt: { gt: date("prospects") }, statut: "A_RELANCER" } }),
    ]);
    return NextResponse.json({ commandes, prospects });
  } catch (error) {
    return handleApiError(error);
  }
}
