/** Libellé « Boutique, Supérette, Autre précision » à partir des types cochés. */
export function libelleTypes(
  pv: { type?: { nom: string } | null; typesIds?: string[] | null; typeAutre?: string | null },
  tousTypes: { id: string; nom: string }[]
): string {
  const noms = (pv.typesIds ?? [])
    .map((id) => tousTypes.find((t) => t.id === id)?.nom)
    .filter((n): n is string => Boolean(n));
  if (noms.length === 0 && pv.type?.nom) noms.push(pv.type.nom);
  if (pv.typeAutre) noms.push(pv.typeAutre);
  return noms.length > 0 ? noms.join(", ") : "—";
}
