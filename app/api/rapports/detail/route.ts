import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";
import { getApercu, type RapportVue, type RapportFilters } from "@/lib/queries/rapports";

export const runtime = "nodejs";

const VUES: RapportVue[] = ["commercial", "point_vente", "ville", "quartier", "vente", "produit", "historique"];

// Aperçu détaillé d'une ligne de rapport (fiche imprimable). Mêmes filtres que
// la page Rapports, plus la vue et la clé de la ligne cliquée.
export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const sp = req.nextUrl.searchParams;
    const vue = sp.get("vue") as RapportVue;
    const cle = sp.get("cle");
    if (!VUES.includes(vue) || !cle) {
      return NextResponse.json({ error: "Paramètres invalides." }, { status: 400 });
    }
    const g = (k: string) => sp.get(k) || undefined;
    const filters: RapportFilters = {
      commercialId: g("commercialId"),
      binomeId: g("binomeId"),
      villeId: g("villeId"),
      quartier: g("quartier"),
      typeId: g("typeId"),
      gamme: g("gamme"),
      produitCode: g("produitCode"),
      dateFrom: g("dateFrom"),
      dateTo: g("dateTo"),
    };
    return NextResponse.json(await getApercu(filters, vue, cle));
  } catch (error) {
    return handleApiError(error);
  }
}
