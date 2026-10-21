import { requireAdminPage } from "@/lib/auth/rbac";
import { peutModifier } from "@/lib/auth/permissions";
import StockView from "./StockView";
import EtatStock from "./EtatStock";

export const dynamic = "force-dynamic";

export default async function StockPage() {
  const session = await requireAdminPage("stock");
  // Le superviseur ne voit que l'état du stock (initial + disponible).
  if (!peutModifier(session.role)) return <EtatStock />;
  return <StockView lectureSeule={false} />;
}
