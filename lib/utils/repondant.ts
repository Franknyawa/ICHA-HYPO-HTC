// Libellés du champ « Qui nous répond ? » du recensement.
const LIBELLES: Record<string, string> = {
  PATRON: "Patron",
  GERANT: "Gérant",
  EMPLOYE: "Employé",
  AUTRE: "Autre",
};

/** « Gérant », « Autre (fils du patron) »… ; null si le rôle n'est pas connu. */
export function libelleRepondant(role?: string | null, fonction?: string | null): string | null {
  if (!role) return null;
  const base = LIBELLES[role] ?? role;
  return role === "AUTRE" && fonction ? `${base} (${fonction})` : base;
}
