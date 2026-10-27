import { prisma } from "@/lib/prisma";
import { listerVilles } from "@/lib/geo/synchro-villes";

/** Données de référence du formulaire de commande du bureau (nouvelle commande et modification). HYPO avant HTC. */
export async function chargerReferentielsCommande() {
  const [villes, types, produits, prixParType, paliers, commerciaux] = await Promise.all([
    listerVilles(),
    prisma.typePointVente.findMany({ where: { actif: true }, orderBy: { ordre: "asc" }, select: { id: true, nom: true } }),
    prisma.produit.findMany({ where: { actif: true }, orderBy: { code: "desc" } }),
    prisma.prixParType.findMany(),
    prisma.palierPrix.findMany(),
    prisma.user.findMany({
      where: { role: "COMMERCIAL", actif: true },
      orderBy: { nom: "asc" },
      select: { id: true, nom: true, prenom: true },
    }),
  ]);
  return {
    villes: villes.map((v) => ({ id: v.id, nom: v.nom })),
    types,
    commerciaux,
    produits: produits.map((p) => ({
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
    })),
    prixParType: prixParType.map((x) => ({
      produitId: x.produitId,
      typeId: x.typeId,
      prixSachet: Number(x.prixSachet),
      prixFilet: x.prixFilet === null ? null : Number(x.prixFilet),
      prixCarton: Number(x.prixCarton),
    })),
    paliers: paliers.map((x) => ({
      produitId: x.produitId,
      minCartons: x.minCartons,
      maxCartons: x.maxCartons,
      prixCarton: Number(x.prixCarton),
    })),
  };
}
