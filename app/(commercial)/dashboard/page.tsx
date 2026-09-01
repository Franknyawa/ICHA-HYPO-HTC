import { getSession } from "@/lib/auth/session";
import Link from "next/link";
import { SyncStatusBanner } from "@/components/SyncStatusBanner";

export default async function CommercialDashboardPage() {
  // Le middleware garantit déjà qu'on arrive ici uniquement authentifié
  // en tant que COMMERCIAL — cet appel sert à afficher les infos de session.
  const session = await getSession();

  return (
    <main className="min-h-screen bg-slate-50 p-4">
      <div className="mb-4">
        <SyncStatusBanner />
      </div>
      <h1 className="text-lg font-semibold text-blue-800">
        Bonjour {session?.prenom} {session?.nom}
      </h1>
      <p className="mb-4 text-sm text-slate-500">
        Objectifs, statistiques et historique arrivent dans un prochain module.
      </p>
      <Link
        href="/visites/new"
        className="block w-full rounded-xl bg-blue-700 py-4 text-center text-base font-medium text-white"
      >
        + Nouvelle visite
      </Link>
      <Link
        href="/profil"
        className="mt-3 block text-center text-sm font-medium text-slate-500"
      >
        Changer mon mot de passe
      </Link>
    </main>
  );
}
