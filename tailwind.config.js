/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Charte graphique §27 CDC : bleu professionnel (primaire), rouge
        // sombre réservé aux alertes/erreurs/actions critiques. Palette
        // enrichie pour donner de la personnalité sans sortir de ce cadre :
        // un bleu plus profond en primaire, un indigo et un teal en accents
        // secondaires (jamais pour les alertes), le rouge restant exclusif
        // aux erreurs/critique.
        brand: {
          DEFAULT: "#1e40af", // blue-800
          light: "#3b82f6", // blue-500, pour les dégradés
          soft: "#eff6ff", // fond teinté
        },
        accent: {
          indigo: "#4338ca", // section Équipe
          teal: "#0f766e", // produit HTC
        },
        alert: {
          DEFAULT: "#b91c1c",
        },
      },
    },
  },
  plugins: [],
};
