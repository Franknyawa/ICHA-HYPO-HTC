import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireAdmin();
    const produits = await prisma.produit.findMany({ orderBy: { code: "asc" } });
    return NextResponse.json({ data: produits });
  } catch (error) {
    return handleApiError(error);
  }
}
