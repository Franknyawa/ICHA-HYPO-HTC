import { requireAdminPage } from "@/lib/auth/rbac";
import { peutModifier } from "@/lib/auth/permissions";
import StockView from "./StockView";

export const dynamic = "force-dynamic";

export default async function StockPage() {
  const session = await requireAdminPage("stock");
  return <StockView lectureSeule={!peutModifier(session.role)} />;
}
