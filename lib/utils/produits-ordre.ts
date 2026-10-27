/** Ordre d'affichage des produits dans les formulaires : HYPO d'abord, puis HTC (puis les autres par code). */
export function trierProduits<T extends { code: string }>(produits: T[]): T[] {
  const rang = (c: string) => (c === "HYPO" ? 0 : c === "HTC" ? 1 : 2);
  return [...produits].sort((a, b) => rang(a.code) - rang(b.code) || a.code.localeCompare(b.code));
}
