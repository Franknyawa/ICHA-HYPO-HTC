import { requireAdminPage } from "@/lib/auth/rbac";
import { chargerReferentielsCommande } from "@/lib/queries/form-commande";
import { getRemiseBureauPct } from "@/lib/services/remise-bureau";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { NouvelleCommandeForm } from "@/components/admin/NouvelleCommandeForm";

export const dynamic = "force-dynamic";

export default async function NouvelleCommandePage() {
  // Le superviseur peut passer une commande depuis son ordinateur (mais pas la valider).
  const session = await requireAdminPage("commandes");
  const ref = await chargerReferentielsCommande();
  const estAdmin = session.role === "ADMIN" || session.role === "SUPER_ADMIN";
  const remiseBureauPct = estAdmin ? await getRemiseBureauPct() : 0;

  return (
    <main>
      <AdminPageHeader title="Nouvelle commande" subtitle="Saisie au bureau — même traitement qu'une commande terrain" />
      <div className="p-4 md:p-6">
        <NouvelleCommandeForm {...ref} peutAntidater={estAdmin} remiseBureauPct={remiseBureauPct} />
      </div>
    </main>
  );
}
