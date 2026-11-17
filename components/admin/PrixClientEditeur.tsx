"use client";

import { useState } from "react";
import { Layers, Plus, Trash2 } from "lucide-react";
import { validerGrille, type PalierTarif, type PrixClientTarif } from "@/lib/utils/tarifs";

export type ProduitPrix = { id: string; code: string; prixCarton: number };
type PalierSaisi = { minCartons: number | ""; maxCartons: number | ""; prixCarton: number | "" };
export type EtatProduit = { prixCarton: number | ""; paliers: PalierSaisi[] };
export type EtatPrix = Record<string, EtatProduit>;

const cellule =
  "w-full min-w-[4.5rem] rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-right text-sm tabular-nums text-slate-800 focus:border-[#359980] focus:outline-none focus:ring-2 focus:ring-[#359980]/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";

export const etatVide = (produits: ProduitPrix[]): EtatPrix => Object.fromEntries(produits.map((p) => [p.id, { prixCarton: "", paliers: [] }]));

const paliersPropres = (e: EtatProduit | undefined) =>
  (e?.paliers ?? [])
    .filter((l) => l.minCartons !== "" && l.prixCarton !== "")
    .map((l) => ({ minCartons: Number(l.minCartons), maxCartons: l.maxCartons === "" ? null : Number(l.maxCartons), prixCarton: Number(l.prixCarton) }));

/** Premier message d'erreur de grille (tous produits), sinon null. */
export function erreurPrix(produits: ProduitPrix[], etat: EtatPrix): string | null {
  for (const p of produits) {
    const err = validerGrille(paliersPropres(etat[p.id]));
    if (err) return `${p.code} : ${err}`;
  }
  return null;
}

/** Corps de la requête serveur (null = aucun prix négocié saisi). */
export function payloadPrix(produits: ProduitPrix[], etat: EtatPrix) {
  const liste = produits.map((p) => ({
    produitId: p.id,
    prixCarton: etat[p.id]?.prixCarton === "" || etat[p.id]?.prixCarton == null ? null : Number(etat[p.id].prixCarton),
    paliers: paliersPropres(etat[p.id]),
  }));
  return liste.some((x) => x.prixCarton !== null || x.paliers.length > 0) ? { produits: liste } : null;
}

/** Même données au format du calcul de prix (aperçu du total à l'écran). */
export function versTarifs(produits: ProduitPrix[], etat: EtatPrix): { prixClient: PrixClientTarif[]; paliersClient: PalierTarif[] } {
  const prixClient: PrixClientTarif[] = [];
  const paliersClient: PalierTarif[] = [];
  for (const p of produits) {
    const e = etat[p.id];
    if (e && e.prixCarton !== "" && Number(e.prixCarton) > 0) prixClient.push({ produitId: p.id, prixCarton: Number(e.prixCarton) });
    for (const l of paliersPropres(e)) paliersClient.push({ produitId: p.id, ...l });
  }
  return { prixClient, paliersClient };
}

export const nbProduitsNegocies = (etat: EtatPrix) => Object.values(etat).filter((e) => e.prixCarton !== "" || e.paliers.length > 0).length;

/** Saisie des prix négociés d'un client : un onglet par produit (prix fixe + paliers). */
export function PrixClientEditeur({ produits, etat, onChange }: { produits: ProduitPrix[]; etat: EtatPrix; onChange: (e: EtatPrix) => void }) {
  const [produitId, setProduitId] = useState(produits[0]?.id ?? "");
  const produit = produits.find((p) => p.id === produitId) ?? produits[0];
  const courant = produit ? etat[produit.id] ?? { prixCarton: "", paliers: [] } : null;
  const erreur = produit ? validerGrille(paliersPropres(courant ?? undefined)) : null;

  if (!produit || !courant) return <p className="text-sm text-slate-400">Aucun produit configuré.</p>;

  const maj = (fn: (e: EtatProduit) => EtatProduit) => onChange({ ...etat, [produit.id]: fn(courant) });

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1.5" role="tablist" aria-label="Produit">
        {produits.map((p) => {
          const e = etat[p.id];
          const actif = !!e && (e.prixCarton !== "" || e.paliers.length > 0);
          return (
            <button
              type="button"
              key={p.id}
              role="tab"
              aria-selected={p.id === produit.id}
              onClick={() => setProduitId(p.id)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                p.id === produit.id ? "bg-[#1e3a8a] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              {p.code}
              {actif && <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 align-middle" aria-label="prix négocié" />}
            </button>
          );
        })}
      </div>

      <div className="space-y-5">
        <section>
          <label className="text-sm font-bold text-slate-800 dark:text-slate-100" htmlFor={`prix-fixe-${produit.id}`}>
            Prix du carton négocié (FCFA)
          </label>
          <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
            Prix de base : {produit.prixCarton.toLocaleString("fr-FR")} FCFA. Laissez vide pour garder les tarifs généraux.
          </p>
          <input
            id={`prix-fixe-${produit.id}`}
            type="number"
            min={0}
            value={courant.prixCarton}
            onChange={(e) => maj((x) => ({ ...x, prixCarton: e.target.value === "" ? "" : Number(e.target.value) }))}
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
            <p className="rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-500 dark:bg-slate-950 dark:text-slate-400">Aucun palier propre à ce client pour {produit.code}.</p>
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
                      onChange={(e) => maj((x) => ({ ...x, paliers: x.paliers.map((p, j) => (j === i ? { ...p, [cle]: e.target.value === "" ? "" : Number(e.target.value) } : p)) }))}
                      className={cellule}
                    />
                  ))}
                  <button
                    type="button"
                    onClick={() => maj((x) => ({ ...x, paliers: x.paliers.filter((_, j) => j !== i) }))}
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
            type="button"
            onClick={() =>
              maj((x) => {
                const p = paliersPropres(x);
                const dernier = p.length ? Math.max(...p.map((q) => q.maxCartons ?? q.minCartons)) : -1;
                return { ...x, paliers: [...x.paliers, { minCartons: dernier + 1, maxCartons: "", prixCarton: x.prixCarton === "" ? produit.prixCarton : x.prixCarton }] };
              })
            }
            className="mt-2 flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"
          >
            <Plus size={14} /> Ajouter un palier
          </button>
          {erreur && <p className="mt-2 text-xs font-medium text-red-600">{erreur}</p>}
        </section>
      </div>
    </div>
  );
}
