import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/auth/rbac";
import { chargerReferentielsCommande } from "@/lib/queries/form-commande";
import { cartonsEq } from "@/lib/utils/cartons-equiv";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { NouvelleCommandeForm } from "@/components/admin/NouvelleCommandeForm";

export const dynamic = "force-dynamic";

export default async function ModifierCommandePage({ params }: { params: { id: string } }) {
  await requireAdminPage("commandes");
  const [ref, c] = await Promise.all([
    chargerReferentielsCommande(),
    prisma.commande.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        statut: true,
        modePaiement: true,
        dateLivraisonPrevue: true,
        commercialId: true,
        pointVente: { select: { id: true, nom: true, vendeur: true, telephoneVendeur: true, typeId: true, ville: { select: { nom: true } }, quartier: { select: { nom: true } } } },
        lignes: { select: { nbSachets: true, nbFilets: true, nbCartons: true, detail: true, produit: { select: { code: true, sachetsParCarton: true, filetsParCarton: true } } } },
      },
    }),
  ]);
  if (!c) notFound();

  const quantites: Record<string, { sachets: number; filets: number; cartons: number }> = {};
  const quantitesDetail: typeof quantites = {};
  for (const l of c.lignes) {
    if (l.detail) {
      const q = quantitesDetail[l.produit.code] ?? { sachets: 0, filets: 0, cartons: 0 };
      quantitesDetail[l.produit.code] = { sachets: q.sachets + l.nbSachets, filets: q.filets + l.nbFilets, cartons: 0 };
    } else {
      const q = quantites[l.produit.code] ?? { sachets: 0, filets: 0, cartons: 0 };
      // Les demi-cartons sont stockés en sachets / filets : on les remet en cartons pour l'édition.
      quantites[l.produit.code] = { sachets: 0, filets: 0, cartons: q.cartons + Math.round(cartonsEq(l, l.produit) * 2) / 2 };
    }
  }

  return (
    <main>
      <AdminPageHeader title="Modifier la commande" subtitle={`${c.pointVente.nom} — les prix sont recalculés à l'enregistrement`} />
      <div className="p-4 md:p-6">
        <NouvelleCommandeForm
          {...ref}
          modif={{
            id: c.id,
            pv: {
              id: c.pointVente.id,
              nom: c.pointVente.nom,
              vendeur: c.pointVente.vendeur,
              telephoneVendeur: c.pointVente.telephoneVendeur,
              typeId: c.pointVente.typeId,
              villeNom: c.pointVente.ville?.nom ?? null,
              quartierNom: c.pointVente.quartier?.nom ?? null,
            },
            quantites,
            quantitesDetail,
            modePaiement: c.modePaiement,
            livraison: c.dateLivraisonPrevue ? c.dateLivraisonPrevue.toISOString().slice(0, 10) : "",
            commercialId: c.commercialId,
          }}
        />
      </div>
    </main>
  );
}
