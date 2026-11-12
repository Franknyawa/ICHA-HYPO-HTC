/** Libellé clair d'un produit : « HYPO » + sa description (eau de javel, nettoyant toilettes). */
const DESCRIPTIONS: Record<string, string> = {
  HYPO: "Eau de javel",
  HTC: "Nettoyant toilettes",
};

export function descriptionProduit(code: string): string {
  return DESCRIPTIONS[code.toUpperCase()] ?? "";
}
