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

// Les identifiants survivent à la fermeture de l'application (localStorage) : une saisie recommencée après
// une coupure, une expiration de session ou un redémarrage du téléphone retombe sur les MÊMES identifiants,
// donc le serveur reconnaît l'envoi déjà reçu. Au bout de 12 h ils sont renouvelés (formulaire abandonné).
const VALIDITE_MS = 12 * 60 * 60 * 1000;

type Stock = { at: number; ids: Record<string, string> };

function lireStock(form: string): Stock {
  try {
    const brut = localStorage.getItem(cle(form)) ?? sessionStorage.getItem(cle(form));
    const s = brut ? (JSON.parse(brut) as Partial<Stock>) : null;
    if (s && typeof s.at === "number" && s.ids && Date.now() - s.at < VALIDITE_MS) return { at: s.at, ids: s.ids };
  } catch {
    /* stockage indisponible : identifiants non conservés */
  }
  return { at: Date.now(), ids: {} };
}

export function idStable(form: string, nom: string): string {
  const stock = lireStock(form);
  if (!stock.ids[nom]) {
    stock.ids[nom] = nouveau();
    try {
      localStorage.setItem(cle(form), JSON.stringify(stock));
    } catch {
      /* ignoré */
    }
  }
  return stock.ids[nom];
}

/** À appeler quand l'envoi a réussi (ou a été mis en file d'attente) : le prochain formulaire repart à neuf. */
export function viderIds(form: string) {
  try {
    localStorage.removeItem(cle(form));
    sessionStorage.removeItem(cle(form));
  } catch {
    /* ignoré */
  }
}
