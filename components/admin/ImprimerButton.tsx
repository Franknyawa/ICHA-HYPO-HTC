"use client";

import { Printer } from "lucide-react";

// Imprime la page courante via la boîte de dialogue du navigateur. La
// sidebar/nav admin (app/(admin)/admin/layout.tsx) et les filtres de
// cette page portent la classe `print:hidden` pour ne laisser que le
// tableau de rapport à l'impression.
export function ImprimerButton() {
  return (
    <button
      onClick={() => window.print()}
      className="flex items-center gap-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300"
    >
      <Printer size={15} />
      Imprimer
    </button>
  );
}
