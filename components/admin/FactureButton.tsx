"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/client/apiFetch";
import { genererFacturePdf } from "@/lib/utils/facture-pdf";
import { lignesDocument } from "@/lib/utils/documents";
import type { FactureJson } from "@/lib/services/documents-data";

export type AgentOption = { id: string; nom: string };

/**
 * Génère la facture numérotée (FVICHA 0000X) d'une vente ou d'une commande.
 * L'agent de facturation par défaut est appliqué ; s'il y en a plusieurs, un
 * petit sélecteur permet d'en choisir un autre avant l'impression.
 */
export function FactureButton({
  type,
  id,
  agents = [],
  label = "Facture",
}: {
  type: "VENTE" | "COMMANDE";
  id: string;
  agents?: AgentOption[];
  label?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [agentId, setAgentId] = useState("");

  async function generer() {
    setLoading(true);
    try {
      const f = await apiFetch<FactureJson>(`/api/${type === "VENTE" ? "ventes" : "commandes"}/${id}/facture`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(agentId ? { agentId } : {}),
      });
      await genererFacturePdf({
        numero: f.numero,
        date: new Date(f.date),
        agentNom: f.agentNom,
        client: f.client,
        lignes: lignesDocument(f.sources),
        montantTotal: f.montantTotal,
        modePaiementLabel: f.modePaiementLabel,
        dejaRegle: f.dejaRegle,
      });
    } catch (e) {
      alert(e instanceof ApiError ? e.message : "Impossible de générer la facture.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      {agents.length > 1 && (
        <select
          value={agentId}
          onChange={(e) => setAgentId(e.target.value)}
          aria-label="Agent de facturation"
          className="max-w-[9rem] rounded-lg border border-slate-200 bg-white px-1.5 py-1.5 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
        >
          <option value="">Agent par défaut</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nom}
            </option>
          ))}
        </select>
      )}
      <button
        onClick={generer}
        disabled={loading}
        className="flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-600 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-300"
      >
        {loading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
        {label}
      </button>
    </span>
  );
}
