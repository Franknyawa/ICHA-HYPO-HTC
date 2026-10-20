import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireModule("parametres");
    const rows = await prisma.palierPrix.findMany({ orderBy: [{ produitId: "asc" }, { minCartons: "asc" }] });
    return NextResponse.json({
      data: rows.map((r) => ({
        produitId: r.produitId,
        minCartons: r.minCartons,
        maxCartons: r.maxCartons,
        prixCarton: Number(r.prixCarton),
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
