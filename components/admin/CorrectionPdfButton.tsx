"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { genererCorrectionPdf } from "@/lib/utils/correction-pdf";
import type { CorrectionJson } from "@/lib/services/corrections";

/** Réimprime une facture d'avoir ou une facture retour déjà émise. */
export function CorrectionPdfButton({ doc }: { doc: CorrectionJson }) {
  const [loading, setLoading] = useState(false);
  return (
    <button
      onClick={async () => {
        setLoading(true);
        try {
          await genererCorrectionPdf(doc);
        } finally {
          setLoading(false);
        }
      }}
      disabled={loading}
      className="flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-600 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-300"
    >
      {loading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
      PDF
    </button>
  );
}
