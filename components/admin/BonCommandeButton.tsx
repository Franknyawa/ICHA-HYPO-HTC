"use client";

import { useState } from "react";
import { ClipboardList, Loader2 } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/client/apiFetch";
import { genererBonCommandePdf } from "@/lib/utils/bon-commande-pdf";
import { lignesDocument } from "@/lib/utils/documents";
import type { BonCommandeJson } from "@/lib/services/documents-data";

/** Bon de commande numéroté (BCICHA 0000X), disponible dès l'enregistrement de la commande. */
export function BonCommandeButton({ commandeId }: { commandeId: string }) {
  const [loading, setLoading] = useState(false);

  async function imprimer() {
    setLoading(true);
    try {
      const b = await apiFetch<BonCommandeJson>(`/api/commandes/${commandeId}/bon-commande`, { method: "POST" });
      await genererBonCommandePdf({
        reference: b.numero,
        date: new Date(b.date),
        commercialNom: b.commercialNom,
        client: b.client,
        sections: [
          {
            lignes: lignesDocument(b.sources),
            livraisonPrevue: b.livraisonPrevue ? new Date(b.livraisonPrevue) : null,
          },
        ],
      });
    } catch (e) {
      alert(e instanceof ApiError ? e.message : "Impossible de générer le bon de commande.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={imprimer}
      disabled={loading}
      className="flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-600 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-300"
    >
      {loading ? <Loader2 size={13} className="animate-spin" /> : <ClipboardList size={13} />}
      Bon de commande
    </button>
  );
}
