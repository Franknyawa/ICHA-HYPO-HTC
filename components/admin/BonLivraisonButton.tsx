"use client";

import { useState } from "react";
import { FileText, Loader2, X } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/client/apiFetch";
import { genererBonLivraisonPdf } from "@/lib/utils/bon-livraison-pdf";
import { lignesDocument, type LigneDocument } from "@/lib/utils/documents";
import type { BonLivraisonJson } from "@/lib/services/documents-data";

/**
 * Bon de livraison numéroté (BLICHA 0000X). Une fenêtre permet d'indiquer la
 * quantité réellement livrée ; le « reste à livrer » s'en déduit.
 */
export function BonLivraisonButton({ commandeId }: { commandeId: string }) {
  const [loading, setLoading] = useState(false);
  const [bon, setBon] = useState<BonLivraisonJson | null>(null);
  const [lignes, setLignes] = useState<LigneDocument[]>([]);
  const [livrees, setLivrees] = useState<number[]>([]);

  async function ouvrir() {
    setLoading(true);
    try {
      const b = await apiFetch<BonLivraisonJson>(`/api/commandes/${commandeId}/bon-livraison`, { method: "POST" });
      const l = lignesDocument(b.sources);
      setBon(b);
      setLignes(l);
      setLivrees(l.map((x) => x.quantite));
    } catch (e) {
      alert(e instanceof ApiError ? e.message : "Impossible de préparer le bon de livraison.");
    } finally {
      setLoading(false);
    }
  }

  const texte = (l: LigneDocument, n: number) => (l.unite === "carton" ? String(n) : `${n} ${l.unite}s`);

  async function imprimer() {
    if (!bon) return;
    setLoading(true);
    try {
      await genererBonLivraisonPdf({
        numero: bon.numero,
        date: new Date(bon.date),
        agentNom: bon.agentNom,
        client: bon.client,
        lignes: lignes.map((l, i) => ({
          reference: l.reference,
          designation: l.designation,
          livree: texte(l, livrees[i] ?? 0),
          reste: texte(l, Math.max(0, l.quantite - (livrees[i] ?? 0))),
        })),
      });
      setBon(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={ouvrir}
        disabled={loading}
        className="flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-600 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-300"
      >
        {loading && !bon ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
        Bon de livraison
      </button>

      {bon && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-4 sm:items-center" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl dark:bg-slate-900">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{bon.numero}</p>
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Quantités livrées</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Le reste à livrer est calculé automatiquement.</p>
              </div>
              <button onClick={() => setBon(null)} aria-label="Fermer" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X size={16} />
              </button>
            </div>
            <ul className="max-h-[50vh] space-y-3 overflow-y-auto">
              {lignes.map((l, i) => (
                <li key={i} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{l.designation}</p>
                  <div className="mt-2 flex items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
                    <span>Commandé : {texte(l, l.quantite)}</span>
                    <label className="flex items-center gap-2">
                      Livré
                      <input
                        type="number"
                        min={0}
                        max={l.quantite}
                        inputMode="numeric"
                        value={livrees[i] ?? 0}
                        onChange={(e) => {
                          const v = Math.min(l.quantite, Math.max(0, Math.floor(Number(e.target.value) || 0)));
                          setLivrees((prev) => prev.map((x, j) => (j === i ? v : x)));
                        }}
                        className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-right text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                      />
                    </label>
                    <span className="w-24 text-right font-semibold">Reste : {texte(l, Math.max(0, l.quantite - (livrees[i] ?? 0)))}</span>
                  </div>
                </li>
              ))}
            </ul>
            <button
              onClick={imprimer}
              disabled={loading}
              className="mt-4 w-full rounded-xl bg-gradient-to-r from-[#1e3a8a] to-[#2563eb] py-3 text-sm font-bold text-white disabled:opacity-50"
            >
              {loading ? "Génération…" : "Télécharger le bon de livraison"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
