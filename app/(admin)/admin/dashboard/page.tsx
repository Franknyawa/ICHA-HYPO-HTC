import { requireAdminPage } from "@/lib/auth/rbac";
import {
  getDashboardKpis,
  getCaParBinomeEtVendeur,
  getCommandesEnCours,
  getObservationsRecentes,
  getVisitesParJour,
} from "@/lib/queries/dashboard";
import { getCaisseResume } from "@/lib/queries/caisse";
import { debutJour, finJour, jourDouala } from "@/lib/utils/periode";
import { Suspense } from "react";
import { peutAcceder } from "@/lib/auth/permissions";
import { TerritoiresSection, TerritoiresSkeleton } from "@/components/admin/TerritoiresSection";
import { DashboardView } from "@/components/admin/DashboardView";
import { VentesParProduitSection, VentesParProduitSkeleton } from "@/components/admin/VentesParProduitSection";

// Données live (base de données) : jamais pré-généré statiquement au build
// (évite d'épuiser le pool de connexions Prisma pendant `next build`, et
// une page admin ne doit de toute façon jamais servir de données figées).
export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const session = await requireAdminPage("dashboard");
  const jour = jourDouala();
  // Deux lots de requêtes en parallèle plutôt qu'un seul gros : reste sous le
  // nombre de connexions du pool Prisma.
  const [kpis, visites] = await Promise.all([getDashboardKpis(), getVisitesParJour(30)]);
  const [caisse, { parBinome, parVendeur }, observations, enCours] = await Promise.all([
    getCaisseResume(debutJour(jour), finJour(jour)),
    getCaParBinomeEtVendeur(),
    getObservationsRecentes(6),
    getCommandesEnCours(),
  ]);

  const dateLongue = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Africa/Douala",
  });

  return (
    <DashboardView
      prenom={session?.prenom ?? ""}
      peutCaisse={peutAcceder(session.role, "caisse")}
      peutStock={peutAcceder(session.role, "stock")}
      dateLongue={dateLongue}
      jour={jour}
      kpis={kpis}
      enCours={enCours}
      visites={visites}
      caisse={caisse}
      parBinome={parBinome}
      parVendeur={parVendeur}
      observations={observations}
      territoiresSlot={
        <Suspense fallback={<TerritoiresSkeleton />}>
          <TerritoiresSection />
        </Suspense>
      }
      ventesSlot={
        <Suspense fallback={<VentesParProduitSkeleton />}>
          <VentesParProduitSection />
        </Suspense>
      }
    />
  );
}
