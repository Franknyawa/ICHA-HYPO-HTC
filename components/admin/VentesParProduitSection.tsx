import { getDonneesVentesProduit } from "@/lib/queries/ventes-produit";
import { VentesParProduit } from "./VentesParProduit";

// Composant serveur : calcule les données de la section, affichées en
// streaming (Suspense dans la page) pour ne pas retarder le reste du tableau
// de bord.
export async function VentesParProduitSection() {
  const donnees = await getDonneesVentesProduit();
  return <VentesParProduit donnees={donnees} />;
}

export function VentesParProduitSkeleton() {
  return (
    <div className="mt-6 animate-pulse">
      <div className="mb-3 h-4 w-40 rounded bg-slate-200 dark:bg-slate-800" />
      <div className="mb-3 h-24 rounded-2xl bg-slate-100 dark:bg-slate-900" />
      <div className="grid gap-3 lg:grid-cols-[5fr_6fr]">
        <div className="h-72 rounded-2xl bg-slate-100 dark:bg-slate-900" />
        <div className="h-72 rounded-2xl bg-slate-100 dark:bg-slate-900" />
      </div>
    </div>
  );
}
