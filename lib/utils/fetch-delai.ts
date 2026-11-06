/** fetch avec délai maximum : sur un réseau faible, une requête peut rester suspendue indéfiniment. */
export const DELAI_ENVOI_MS = 25_000;

export async function fetchAvecDelai(url: string, init: RequestInit = {}, ms = DELAI_ENVOI_MS): Promise<Response> {
  const ctrl = new AbortController();
  const minuteur = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(minuteur);
  }
}
