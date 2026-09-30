// Formatage de montants FCFA partagé entre la facture, le bon de livraison
// et les rapports.
//
// `toLocaleString("fr-FR")` insère un espace fine insécable (U+202F) comme
// séparateur de milliers. C'est correct dans un navigateur, mais la police
// Helvetica intégrée à jsPDF ne sait pas dessiner ce caractère : il ressort
// comme un glyphe cassé (vu en pratique sous forme de "/"), donnant des
// montants illisibles du type "1 / 153 / 350" au lieu de "1 153 350" dans
// les PDF (facture, bon de livraison, export des rapports).
//
// On construit donc le séparateur de milliers nous-mêmes avec un espace
// normal (U+0020), rendu correctement partout — écran comme PDF.
export function formatMontant(montant: number): string {
  const entier = Math.round(montant);
  return entier.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export function formatFcfa(montant: number): string {
  return `${formatMontant(montant)} FCFA`;
}
