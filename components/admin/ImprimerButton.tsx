"use client";

import { Printer } from "lucide-react";
import { TelechargerPdfButton } from "@/components/admin/TelechargerPdfButton";

/** Ouvre la boîte d'impression. Différée : le gestionnaire rend la main tout de suite (sinon le navigateur
 *  compte tout le temps où la fenêtre d'impression reste ouverte comme un blocage de l'interface — alerte « INP »). */
export function lancerImpression() {
  setTimeout(() => window.print(), 50);
}

// Imprime la page courante. La navigation admin et les filtres portent `print:hidden`.
// Le bouton « Télécharger PDF » l'accompagne (sauf si la page a déjà son propre export PDF : sansPdf).
export function ImprimerButton({ sansPdf = false }: { sansPdf?: boolean }) {
  return (
    <>
      <button
        onClick={lancerImpression}
        className="flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200"
      >
        <Printer size={15} />
        Imprimer
      </button>
      {!sansPdf && <TelechargerPdfButton />}
    </>
  );
}
