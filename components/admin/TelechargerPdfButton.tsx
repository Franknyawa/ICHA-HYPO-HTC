"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Download, Loader2 } from "lucide-react";
import { telechargerPagePdf } from "@/lib/utils/pdf-page";

/** Télécharge la page affichée en PDF (à côté du bouton Imprimer). */
export function TelechargerPdfButton({ className, selecteur, nom }: { className?: string; selecteur?: string; nom?: string }) {
  const chemin = usePathname();
  const [envoi, setEnvoi] = useState(false);
  async function lancer() {
    setEnvoi(true);
    try {
      const nomAuto = chemin.replace(/^\/admin\//, "").replace(/[^a-z0-9]+/gi, "-").replace(/-+$/, "") || "page";
      await telechargerPagePdf(nom ?? nomAuto, selecteur);
    } catch {
      alert("Impossible de générer le PDF de cette page.");
    } finally {
      setEnvoi(false);
    }
  }
  return (
    <button
      onClick={lancer}
      disabled={envoi}
      className={
        className ??
        "flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700 disabled:opacity-60 dark:bg-slate-800 dark:text-slate-200"
      }
    >
      {envoi ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
      Télécharger PDF
    </button>
  );
}
