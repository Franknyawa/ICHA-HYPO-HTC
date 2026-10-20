// Écrit un entier en toutes lettres, en français (orthographe de 1990 non
// appliquée : « quatre-vingt-dix-sept », « deux cents »…). Utilisé pour la
// mention « Arrêter la présente facture à la somme de… ».

const UNITES = [
  "zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix",
  "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf",
];
const DIZAINES = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante"];

/** 0–99. `final` : le mot termine le nombre (« quatre-vingts » prend alors son s). */
function moinsDeCent(n: number, final: boolean): string {
  if (n < 20) return UNITES[n];
  if (n < 70) {
    const d = Math.floor(n / 10);
    const u = n % 10;
    if (u === 0) return DIZAINES[d];
    return u === 1 ? `${DIZAINES[d]} et un` : `${DIZAINES[d]}-${UNITES[u]}`;
  }
  if (n < 80) {
    // 70–79 : soixante-dix… ; 71 = soixante et onze
    return n === 71 ? "soixante et onze" : `soixante-${UNITES[n - 60]}`;
  }
  // 80–99
  if (n === 80) return final ? "quatre-vingts" : "quatre-vingt";
  return `quatre-vingt-${UNITES[n - 80]}`;
}

/** 0–999. */
function moinsDeMille(n: number, final: boolean): string {
  const c = Math.floor(n / 100);
  const r = n % 100;
  if (c === 0) return moinsDeCent(r, final);
  const centaine = c === 1 ? "cent" : `${UNITES[c]} cent`;
  if (r === 0) return c > 1 && final ? `${centaine}s` : centaine;
  return `${centaine} ${moinsDeCent(r, final)}`;
}

export function nombreEnLettres(valeur: number): string {
  const n = Math.round(Math.abs(valeur));
  if (n === 0) return "zéro";
  if (n >= 1e12) return String(n);

  const milliards = Math.floor(n / 1e9);
  const millions = Math.floor((n % 1e9) / 1e6);
  const milliers = Math.floor((n % 1e6) / 1e3);
  const reste = n % 1e3;

  const morceaux: string[] = [];
  if (milliards > 0) morceaux.push(milliards === 1 ? "un milliard" : `${moinsDeMille(milliards, true)} milliards`);
  if (millions > 0) morceaux.push(millions === 1 ? "un million" : `${moinsDeMille(millions, true)} millions`);
  if (milliers > 0) morceaux.push(milliers === 1 ? "mille" : `${moinsDeMille(milliers, false)} mille`);
  if (reste > 0) morceaux.push(moinsDeMille(reste, true));
  return morceaux.join(" ");
}

export function montantEnLettres(montant: number): string {
  const t = nombreEnLettres(montant);
  return `${t.charAt(0).toUpperCase()}${t.slice(1)} francs CFA`;
}
