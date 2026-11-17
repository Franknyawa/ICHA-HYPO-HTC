"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BadgePercent, Layers, Plus, Save, Trash2 } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/client/apiFetch";
import { validerGrille } from "@/lib/utils/tarifs";

type Produit = { id: string; code: string; nom: string; prixCarton: number };
type PalierSaisi = { minCartons: number | ""; maxCartons: number | ""; prixCarton: number | "" };
type EtatProduit = { prixCarton: number | ""; paliers: PalierSaisi[] };
type Reponse = {
  produits: Produit[];
  prixClient: { produitId: string; prixCarton: number }[];
  paliersClient: { produitId: string; minCartons: number; maxCartons: number | null; prixCarton: number }[];
};

const cellule =
  "w-full min-w-[4.5rem] rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-right text-sm tabular-nums text-slate-800 focus:border-[#359980] focus:outline-none focus:ring-2 focus:ring-[#359980]/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";

/**
 * Prix négociés avec ce client (grossiste), un produit à la fois :
 *  - un prix du carton fixe, valable quelle que soit la quantité ;
 *  - et/ou une grille par quantité propre au client.
 * Ils passent avant les tarifs généraux. Vide = les tarifs généraux s'appliquent.
 */
export function PrixClientManager({ pointVenteId }: { pointVenteId: string }) {
  const [produits, setProduits] = useState<Produit[]>([]);
  const [etat, setEtat] = useState<Record<string, EtatProduit>>({});
  const [produitId, setProduitId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ton: "ok" | "erreur"; texte: string } | null>(null);

  const charger = useCallback(() => {
    apiFetch<Reponse>(`/api/points-vente/${pointVenteId}/prix`)
      .then((r) => {
        const liste = r.produits ?? [];
        setProduits(liste);
        const e: Record<string, EtatProduit> = {};
        for (const pr of liste) {
          e[pr.id] = {
            prixCarton: r.prixClient.find((x) => x.produitId === pr.id)?.prixCarton ?? "",
            paliers: r.paliersClient
              .filter((x) => x.produitId === pr.id)
              .map((x) => ({ minCartons: x.minCartons, maxCartons: x.maxCartons ?? "", prixCarton: x.prixCarton })),
          };
        }
        setEtat(e);
        setProduitId((prev) => prev || liste[0]?.id || "");
      })
      .catch((err: ApiError) => {
        if (err.status !== 401) setMessage({ ton: "erreur", texte: "Impossible de charger les prix du client." });
      })
      .finally(() => setLoading(false));
  }, [pointVenteId]);

  useEffect(charger, [charger]);

  const courant = etat[produitId];
  const produit = produits.find((p) => p.id === produitId);

  const propres = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(etat).map(([id, e]) => [
          id,
          e.paliers
            .filter((l) => l.minCartons !== "" && l.prixCarton !== "")
            .map((l) => ({ minCartons: Number(l.minCartons), maxCartons: l.maxCartons === "" ? null : Number(l.maxCartons), prixCarton: Number(l.prixCarton) })),
        ])
      ),
    [etat]
  );
  const erreurGrille = produitId ? validerGrille(propres[produitId] ?? []) : null;
  const nbNegocies = Object.values(etat).filter((e) => e.prixCarton !== "" || e.paliers.length > 0).length;

  function modifier(fn: (e: EtatProduit) => EtatProduit) {
    setMessage(null);
    setEtat((prev) => ({ ...prev, [produitId]: fn(prev[produitId]) }));
  }

  async function enregistrer() {
    for (const id of Object.keys(propres)) {
      const err = validerGrille(propres[id]);
      if (err) return setMessage({ ton: "erreur", texte: `${produits.find((p) => p.id === id)?.code ?? ""} : ${err}` });
    }
    setSaving(true);
    try {
      await apiFetch(`/api/points-vente/${pointVenteId}/prix`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          produits: produits.map((p) => ({
            produitId: p.id,
            prixCarton: etat[p.id]?.prixCarton === "" || etat[p.id]?.prixCarton == null ? null : Number(etat[p.id].prixCarton),
            paliers: propres[p.id] ?? [],
          })),
        }),
      });
      setMessage({ ton: "ok", texte: "Prix du client enregistrés. Ils s'appliquent aux prochaines commandes et ventes." });
      charger();
    } catch (e) {
      setMessage({ ton: "erreur", texte: e instanceof ApiError ? e.message : "Échec de l'enregistrement." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800 print:hidden">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#359980] text-white">
          <BadgePercent size={16} />
        </span>
        <h2 className="font-bold text-slate-800 dark:text-slate-100">Prix négociés de ce client</h2>
        {nbNegocies > 0 && (
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            {nbNegocies} produit{nbNegocies > 1 ? "s" : ""}
          </span>
        )}
      </div>
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
        Ces prix remplacent les tarifs généraux pour ce client uniquement. Un prix par palier prime sur le prix fixe ;
        hors palier, le prix fixe s&apos;applique, puis les tarifs généraux. Les commandes déjà saisies gardent leur prix.
      </p>

      {loading ? (
        <p className="mt-3 text-sm text-slate-400">Chargement...</p>
      ) : produits.length === 0 ? (
        <p className="mt-3 text-sm text-slate-400">Aucun produit configuré.</p>
      ) : (
        <>
          <div className="my-3 flex flex-wrap gap-1.5" role="tablist" aria-label="Produit">
            {produits.map((p) => {
              const e = etat[p.id];
              const actif = !!e && (e.prixCarton !== "" || e.paliers.length > 0);
              return (
                <button
                  key={p.id}
                  role="tab"
                  aria-selected={p.id === produitId}
                  onClick={() => setProduitId(p.id)}
                  className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                    p.id === produitId ? "bg-[#1e3a8a] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                  }`}
                >
                  {p.code}
                  {actif && <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 align-middle" aria-label="prix négocié" />}
                </button>
              );
            })}
          </div>

          {produit && courant && (
            <div className="space-y-5">
              <section>
                <label className="text-sm font-bold text-slate-800 dark:text-slate-100" htmlFor="prix-fixe">
                  Prix du carton négocié (FCFA)
                </label>
                <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
                  Prix de base : {produit.prixCarton.toLocaleString("fr-FR")} FCFA. Laissez vide pour garder les tarifs généraux.
                </p>
                <input
                  id="prix-fixe"
                  type="number"
                  min={0}
                  value={courant.prixCarton}
                  onChange={(e) => modifier((x) => ({ ...x, prixCarton: e.target.value === "" ? "" : Number(e.target.value) }))}
                  placeholder="Tarif général"
                  className={`${cellule} max-w-[12rem]`}
                />
              </section>

              <section>
                <h3 className="flex items-center gap-1.5 text-sm font-bold text-slate-800 dark:text-slate-100">
                  <Layers size={15} className="text-indigo-700" /> Paliers de quantité de ce client
                </h3>
                <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
                  Le prix du carton change selon le nombre de cartons commandés. Laissez « jusqu&apos;à » vide pour le dernier palier.
                </p>
                {courant.paliers.length === 0 ? (
                  <p className="rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                    Aucun palier propre à ce client pour {produit.code}.
                  </p>
                ) : (
                  <div className="space-y-2">
                    <div className="hidden grid-cols-[1fr_1fr_1.3fr_auto] gap-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400 sm:grid">
                      <span>De (cartons)</span>
                      <span>Jusqu&apos;à</span>
                      <span>Prix du carton (FCFA)</span>
                      <span className="w-8" />
                    </div>
                    {courant.paliers.map((l, i) => (
                      <div key={i} className="grid grid-cols-2 items-center gap-2 sm:grid-cols-[1fr_1fr_1.3fr_auto]">
                        {(["minCartons", "maxCartons", "prixCarton"] as const).map((cle) => (
                          <input
                            key={cle}
                            type="number"
                            min={0}
                            value={l[cle]}
                            placeholder={cle === "minCartons" ? "De" : cle === "maxCartons" ? "Illimité" : "Prix"}
                            aria-label={cle === "minCartons" ? "De (cartons)" : cle === "maxCartons" ? "Jusqu'à (cartons)" : "Prix du carton"}
                            onChange={(e) =>
                              modifier((x) => ({
                                ...x,
                                paliers: x.paliers.map((p, j) => (j === i ? { ...p, [cle]: e.target.value === "" ? "" : Number(e.target.value) } : p)),
                              }))
                            }
                            className={cellule}
                          />
                        ))}
                        <button
                          onClick={() => modifier((x) => ({ ...x, paliers: x.paliers.filter((_, j) => j !== i) }))}
                          aria-label="Supprimer ce palier"
                          className="flex h-8 w-8 items-center justify-center justify-self-end rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  onClick={() =>
                    modifier((x) => {
                      const p = propres[produitId] ?? [];
                      const dernier = p.length ? Math.max(...p.map((q) => q.maxCartons ?? q.minCartons)) : -1;
                      return { ...x, paliers: [...x.paliers, { minCartons: dernier + 1, maxCartons: "", prixCarton: x.prixCarton === "" ? produit.prixCarton : x.prixCarton }] };
                    })
                  }
                  className="mt-2 flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"
                >
                  <Plus size={14} /> Ajouter un palier
                </button>
                {erreurGrille && <p className="mt-2 text-xs font-medium text-red-600">{erreurGrille}</p>}
              </section>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              onClick={enregistrer}
              disabled={saving || !!erreurGrille}
              className="flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              <Save size={15} /> {saving ? "Enregistrement..." : "Enregistrer les prix du client"}
            </button>
            {message && <p className={`text-sm ${message.ton === "ok" ? "text-emerald-700 dark:text-emerald-400" : "text-red-600"}`}>{message.texte}</p>}
          </div>
        </>
      )}
    </div>
  );
}
