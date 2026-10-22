import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/auth/rbac";
import { listerVilles } from "@/lib/geo/synchro-villes";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { NouvelleCommandeForm } from "@/components/admin/NouvelleCommandeForm";

export const dynamic = "force-dynamic";

export default async function NouvelleCommandePage() {
  // Le superviseur peut passer une commande depuis son ordinateur (mais pas la valider).
  await requireAdminPage("commandes");

  const [villes, types, produits, prixParType, paliers, commerciaux] = await Promise.all([
    listerVilles(),
    prisma.typePointVente.findMany({ where: { actif: true }, orderBy: { ordre: "asc" }, select: { id: true, nom: true } }),
    prisma.produit.findMany({ where: { actif: true }, orderBy: { code: "asc" } }),
    prisma.prixParType.findMany(),
    prisma.palierPrix.findMany(),
    prisma.user.findMany({
      where: { role: "COMMERCIAL", actif: true },
      orderBy: { nom: "asc" },
      select: { id: true, nom: true, prenom: true },
    }),
  ]);

  return (
    <main>
      <AdminPageHeader title="Nouvelle commande" subtitle="Saisie au bureau — même traitement qu'une commande terrain" />
      <div className="p-4 md:p-6">
        <NouvelleCommandeForm
          villes={villes.map((v) => ({ id: v.id, nom: v.nom }))}
          types={types}
          commerciaux={commerciaux}
          produits={produits.map((p) => ({
            id: p.id,
            code: p.code,
            nom: p.nom,
            designation: p.designation,
            sachetsParCarton: p.sachetsParCarton,
            sachetsParFilet: p.sachetsParFilet,
            volumeMl: p.volumeMl,
            prixSachet: Number(p.prixSachet),
            prixFilet: p.prixFilet === null ? null : Number(p.prixFilet),
            prixCarton: Number(p.prixCarton),
          }))}
          prixParType={prixParType.map((x) => ({
            produitId: x.produitId,
            typeId: x.typeId,
            prixSachet: Number(x.prixSachet),
            prixFilet: x.prixFilet === null ? null : Number(x.prixFilet),
            prixCarton: Number(x.prixCarton),
          }))}
          paliers={paliers.map((x) => ({
            produitId: x.produitId,
            minCartons: x.minCartons,
            maxCartons: x.maxCartons,
            prixCarton: Number(x.prixCarton),
          }))}
        />
      </div>
    </main>
  );
}
