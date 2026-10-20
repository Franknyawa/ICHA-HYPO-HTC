import { NextRequest, NextResponse } from "next/server";
import { requireModule } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";
import { getMouvements, type CategorieMouvement } from "@/lib/queries/stock";

export const runtime = "nodejs";

const CATEGORIES = ["ENTREE", "VENTE", "AVARIE", "ECHANTILLON", "GIFT", "AJUSTEMENT"];
const JOUR = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: NextRequest) {
  try {
    await requireModule("stock");
    const sp = req.nextUrl.searchParams;
    const du = sp.get("du") ?? undefined;
    const au = sp.get("au") ?? undefined;
    const categorie = sp.get("categorie") ?? undefined;
    const result = await getMouvements({
      du: du && JOUR.test(du) ? du : undefined,
      au: au && JOUR.test(au) ? au : undefined,
      produitId: sp.get("produitId") ?? undefined,
      categorie: categorie && CATEGORIES.includes(categorie) ? (categorie as CategorieMouvement) : undefined,
      limit: Number(sp.get("limit")) || 200,
    });
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
