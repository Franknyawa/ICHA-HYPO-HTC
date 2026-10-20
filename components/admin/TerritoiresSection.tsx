import { getProgressionTerritoires } from "@/lib/queries/objectifs-territoire";
import { ProgressionTerritoiresBloc } from "@/components/admin/ProgressionTerritoires";

/** Chargé en streaming (Suspense) pour ne pas ralentir le reste de la page. */
export async function TerritoiresSection() {
  const data = await getProgressionTerritoires();
  return <ProgressionTerritoiresBloc data={data} />;
}

export function TerritoiresSkeleton() {
  return <div className="h-40 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />;
}
