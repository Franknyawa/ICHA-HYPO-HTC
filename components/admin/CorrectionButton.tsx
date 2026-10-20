"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileMinus2, Loader2, X } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/client/apiFetch";
import { genererCorrectionPdf } from "@/lib/utils/correction-pdf";
import type { CorrectionJson } from "@/lib/services/corrections";

type Info = {
  montantTotal: number;
  dejaCredite: number;
  lignes: { id: string; nom: string; code: string; cartons: number; filets: number; sachets: number }[];
};
type Qte = { c: number; f: number; s: number };

/**
 * Fenêtre « Avoir / Retour » d'une commande validée : facture d'avoir (FA) pour
 * corriger un montant, facture retour (FR) quand de la marchandise revient.
 */
export function CorrectionButton({ commandeId }: { commandeId: string }) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<Info | null>(null);
  const [mode, setMode] = useState<"AVOIR" | "RETOUR">("RETOUR");
  const [qtes, setQtes] = useState<Record<string, Qte>>({});
  const [motif, setMotif] = useState("");
  const [montantLibre, setMontantLibre] = useState(0);
  const [destination, setDestination] = useState<"STOCK" | "AVARIES">("STOCK");
  const [creerAvoir, setCreerAvoir] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  async function ouvrir() {
    setOuvert(true);
    setErreur(null);
    setInfo(null);
    try {
      setInfo(await apiFetch<Info>(`/api/facturation/commande/${commandeId}`));
    } catch (e) {
      setErreur(e instanceof ApiError ? e.message : "Chargement impossible.");
    }
  }

  function maj(id: string, champ: keyof Qte, v: number, max: number) {
    const valeur = Math.min(max, Math.max(0, Math.floor(v || 0)));
    setQtes((p) => ({ ...p, [id]: { ...(p[id] ?? { c: 0, f: 0, s: 0 }), [champ]: valeur } }));
  }

  async function valider() {
    if (!info) return;
    setErreur(null);
    const lignes = info.lignes
      .map((l) => ({ ligneId: l.id, nbCartons: qtes[l.id]?.c ?? 0, nbFilets: qtes[l.id]?.f ?? 0, nbSachets: qtes[l.id]?.s ?? 0 }))
      .filter((l) => l.nbCartons + l.nbFilets + l.nbSachets > 0);
    if (motif.trim().length < 2) return setErreur("Indiquez le motif.");
    setLoading(true);
    try {
      if (mode === "AVOIR") {
        const doc = await apiFetch<CorrectionJson>("/api/facturation/avoirs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ commandeId, motif, lignes, montantLibre: lignes.length ? undefined : montantLibre }),
        });
        await genererCorrectionPdf(doc);
      } else {
        const res = await apiFetch<{ retour: CorrectionJson; avoir: CorrectionJson | null }>("/api/facturation/retours", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ commandeId, motif, lignes, destination, creerAvoir }),
        });
        await genererCorrectionPdf(res.retour);
        if (res.avoir) await genererCorrectionPdf(res.avoir);
      }
      setOuvert(false);
      setQtes({});
      setMotif("");
      router.refresh();
    } catch (e) {
      setErreur(e instanceof ApiError ? e.message : "Enregistrement impossible.");
    } finally {
      setLoading(false);
    }
  }

  const champ = "w-16 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-right text-sm dark:border-slate-700 dark:bg-slate-950";

  return (
    <>
      <button
        onClick={ouvrir}
        className="flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300"
      >
        <FileMinus2 size={13} />
        Avoir / Retour
      </button>

      {ouvert && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-4 sm:items-center" role="dialog" aria-modal="true">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl dark:bg-slate-900">
            <div className="mb-3 flex items-start justify-between gap-3">
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Avoir / Retour</h3>
              <button onClick={() => setOuvert(false)} aria-label="Fermer" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X size={16} />
              </button>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-2">
              {(["RETOUR", "AVOIR"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`rounded-xl px-3 py-2 text-sm font-semibold ${
                    mode === m ? "bg-[#1e3a8a] text-white" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                  }`}
                >
                  {m === "RETOUR" ? "Facture retour (FR)" : "Facture d'avoir (FA)"}
                </button>
              ))}
            </div>
            <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
              {mode === "RETOUR"
                ? "Marchandise rendue par le client : elle est remise en stock ou en avaries."
                : "Correction du montant facturé : diminue ce que le client doit payer."}
            </p>

            {!info ? (
              erreur ? <p className="text-sm text-alert">{erreur}</p> : <p className="text-sm text-slate-400">Chargement...</p>
            ) : (
              <div className="space-y-3">
                <ul className="space-y-2">
                  {info.lignes.map((l) => (
                    <li key={l.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                      <p className="mb-2 text-sm font-medium text-slate-800 dark:text-slate-100">{l.nom}</p>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                        {l.cartons > 0 && (
                          <label className="flex items-center gap-1.5">
                            Cartons (max {l.cartons})
                            <input type="number" min={0} max={l.cartons} value={qtes[l.id]?.c ?? 0} onChange={(e) => maj(l.id, "c", Number(e.target.value), l.cartons)} className={champ} />
                          </label>
                        )}
                        {l.filets > 0 && (
                          <label className="flex items-center gap-1.5">
                            Filets (max {l.filets})
                            <input type="number" min={0} max={l.filets} value={qtes[l.id]?.f ?? 0} onChange={(e) => maj(l.id, "f", Number(e.target.value), l.filets)} className={champ} />
                          </label>
                        )}
                        {l.sachets > 0 && (
                          <label className="flex items-center gap-1.5">
                            Sachets (max {l.sachets})
                            <input type="number" min={0} max={l.sachets} value={qtes[l.id]?.s ?? 0} onChange={(e) => maj(l.id, "s", Number(e.target.value), l.sachets)} className={champ} />
                          </label>
                        )}
                        {l.cartons + l.filets + l.sachets === 0 && <span>Tout a déjà été retourné.</span>}
                      </div>
                    </li>
                  ))}
                </ul>

                {mode === "AVOIR" && (
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                    Ou montant libre à créditer (FCFA) si aucune quantité n&apos;est choisie
                    <input type="number" min={0} value={montantLibre} onChange={(e) => setMontantLibre(Number(e.target.value) || 0)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" />
                    <span className="mt-1 block text-[11px] text-slate-400">
                      Déjà crédité : {info.dejaCredite.toLocaleString("fr-FR")} sur {info.montantTotal.toLocaleString("fr-FR")} FCFA
                    </span>
                  </label>
                )}

                {mode === "RETOUR" && (
                  <div className="space-y-2">
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                      Destination de la marchandise
                      <select value={destination} onChange={(e) => setDestination(e.target.value as "STOCK" | "AVARIES")} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950">
                        <option value="STOCK">Retour en stock (vendable)</option>
                        <option value="AVARIES">Avaries (abîmée, non vendable)</option>
                      </select>
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                      <input type="checkbox" checked={creerAvoir} onChange={(e) => setCreerAvoir(e.target.checked)} />
                      Créer aussi la facture d&apos;avoir correspondante
                    </label>
                  </div>
                )}

                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                  Motif
                  <input value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="Erreur de prix, produit abîmé, refus du client…" className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" />
                </label>

                {erreur && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-alert">{erreur}</p>}

                <button
                  onClick={valider}
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1e3a8a] py-3 text-sm font-bold text-white disabled:opacity-50"
                >
                  {loading && <Loader2 size={15} className="animate-spin" />}
                  {mode === "RETOUR" ? "Émettre la facture retour" : "Émettre la facture d'avoir"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
