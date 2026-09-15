"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";

const ThemeContext = createContext<{
  theme: Theme;
  toggleTheme: () => void;
}>({ theme: "light", toggleTheme: () => {} });

export function useTheme() {
  return useContext(ThemeContext);
}

// Script injecté avant l'hydratation React — applique la classe "dark"
// dès le premier rendu HTML pour éviter un flash de thème incorrect au
// chargement (lu depuis localStorage, ou la préférence système si jamais
// choisi explicitement).
export const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stocke = localStorage.getItem("icha-theme");
    var theme = stocke || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    if (theme === "dark") document.documentElement.classList.add("dark");
  } catch (e) {}
})();
`;

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    // Reflète l'état déjà posé par THEME_INIT_SCRIPT au chargement.
    const actuel = document.documentElement.classList.contains("dark") ? "dark" : "light";
    setTheme(actuel);
  }, []);

  function toggleTheme() {
    setTheme((prev) => {
      const suivant = prev === "dark" ? "light" : "dark";
      document.documentElement.classList.toggle("dark", suivant === "dark");
      try {
        localStorage.setItem("icha-theme", suivant);
      } catch {
        // Stockage indisponible (navigation privée...) — le choix ne
        // persistera pas, sans gravité.
      }
      return suivant;
    });
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
