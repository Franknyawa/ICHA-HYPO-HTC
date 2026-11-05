/**
 * Identifiants stables d'un formulaire de saisie : tant que l'envoi n'a pas abouti, un nouvel appui sur « Valider »
 * (ou un rechargement de la page) réutilise les MÊMES identifiants. Le serveur reconnaît alors l'envoi déjà
 * enregistré au lieu de le créer une seconde fois (anti-doublon).
 */
function nouveau(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

const cle = (form: string) => `icha-ids:${form}`;

export function idStable(form: string, nom: string): string {
  let table: Record<string, string> = {};
  try {
    table = JSON.parse(sessionStorage.getItem(cle(form)) ?? "{}");
  } catch {
    /* stockage indisponible : identifiants non conservés */
  }
  if (!table[nom]) {
    table[nom] = nouveau();
    try {
      sessionStorage.setItem(cle(form), JSON.stringify(table));
    } catch {
      /* ignoré */
    }
  }
  return table[nom];
}

/** À appeler quand l'envoi a réussi (ou a été mis en file d'attente) : le prochain formulaire repart à neuf. */
export function viderIds(form: string) {
  try {
    sessionStorage.removeItem(cle(form));
  } catch {
    /* ignoré */
  }
}
