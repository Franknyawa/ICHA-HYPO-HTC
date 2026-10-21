"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { genererFicheClientPdf, type FicheClientData } from "@/lib/utils/fiche-client-pdf";

/** Télécharge la fiche PDF du client (identité, factures, relevé de compte). */
export function FicheClientButton({ data }: { data: FicheClientData }) {
  const [loading, setLoading] = useState(false);
  return (
    <button
      onClick={async () => {
        setLoading(true);
        try {
          await genererFicheClientPdf(data);
        } finally {
          setLoading(false);
        }
      }}
      disabled={loading}
      className="flex items-center gap-1.5 rounded-xl bg-[#1e3a8a] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
    >
      {loading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
      Fiche PDF
    </button>
  );
}
