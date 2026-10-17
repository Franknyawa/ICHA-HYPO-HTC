import { requireAdminPage } from "@/lib/auth/rbac";
import { getCaisse } from "@/lib/queries/caisse";
import { resoudrePeriode } from "@/lib/utils/periode";
import { CaisseView } from "@/components/admin/caisse/CaisseView";

export const dynamic = "force-dynamic";

export default async function CaissePage({
  searchParams,
}: {
  searchParams: { periode?: string; du?: string; au?: string };
}) {
  await requireAdminPage("caisse");
  const periode = resoudrePeriode(searchParams);
  const c = await getCaisse(periode.debut, periode.fin);
  return <CaisseView c={c} periode={periode} />;
}
