import type { Produit } from "@prisma/client";

export function convertToSachets(
  produit: Pick<Produit, "sachetsParFilet" | "sachetsParCarton">,
  qty: { nbSachets: number; nbFilets: number; nbCartons: number }
): number {
  const depuisFilets = produit.sachetsParFilet
    ? qty.nbFilets * produit.sachetsParFilet
    : 0;
  const depuisCartons = qty.nbCartons * produit.sachetsParCarton;
  return qty.nbSachets + depuisFilets + depuisCartons;
}
