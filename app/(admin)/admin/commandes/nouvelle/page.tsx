import { requireAdminPage } from "@/lib/auth/rbac";
import { chargerReferentielsCommande } from "@/lib/queries/form-commande";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { NouvelleCommandeForm } from "@/components/admin/NouvelleCommandeForm";

export const dynamic = "force-dynamic";

export default async function NouvelleCommandePage() {
  // Le superviseur peut passer une commande depuis son ordinateur (mais pas la valider).
  await requireAdminPage("commandes");
  const ref = await chargerReferentielsCommande();

  return (
    <main>
      <AdminPageHeader title="Nouvelle commande" subtitle="Saisie au bureau — même traitement qu'une commande terrain" />
      <div className="p-4 md:p-6">
        <NouvelleCommandeForm {...ref} />
      </div>
    </main>
  );
}
