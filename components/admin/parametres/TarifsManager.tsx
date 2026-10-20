"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, Layers, Plus, RotateCcw, Save, Tags, Trash2 } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/client/apiFetch";
import { validerGrille } from "@/lib/utils/tarifs";

type Produit = { id: string; code: string; nom: string; prixSachet: number; prixFilet: number | null; prixCarton: number };
type Type = { id: string; nom: string; actif: boolean };
type Surcharge = { id: string; produitId: string; typeId: string; prixSachet: number; prixFilet: number | null; prixCarton: number };
type Palier = { minCartons: number | ""; maxCartons: number | ""; prixCarton: number | "" };

const cellule =
  "w-full min-w-[4.5rem] rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-right text-sm tabular-nums text-slate-800 focus:border-[#359980] focus:outline-none focus:ring-2 focus:ring-[#359980]/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";

const fmt = (n: number) => n.toLocaleString("fr-FR");

/**
 * Tarifs en deux blocs, un produit à la fois :
 *  1. une matrice « type de boutique × unité » (une ligne par type, on tape
 *     directement dans les cases) ;
 *  2. une grille par quantité : le prix du carton dépend du nombre de cartons.
 */
export function TarifsManager() {
  const [produits, setProduits] = useState<Produit[]>([]);
  const [types, setTypes] = useState<Type[]>([]);
  const [surcharges, setSurcharges] = useState<Surcharge[]>([]);
  const [paliers, setPaliers] = useState<Record<string, { produitId: string; minCartons: number; maxCartons: number | null; prixCarton: number }[]>>({});
  const [produitId, setProduitId] = useState("");
  const [loading, setLoading] = useState(true);
  const [ouvert, setOuvert] = useState(true);

  const charger = useCallback(() => {
    Promise.all([
      apiFetch<{ data: Produit[] }>("/api/parametres/produits"),
      apiFetch<{ data: Type[] }>("/api/parametres/types"),
      apiFetch<{ data: Surcharge[] }>("/api/parametres/prix-par-type"),
      apiFetch<{ data: { produitId: string; minCartons: number; maxCartons: number | null; prixCarton: number }[] }>("/api/parametres/paliers"),
    ])
      .then(([p, t, s, g]) => {
        setProduits(p.data ?? []);
        setTypes((t.data ?? []).filter((x) => x.actif));
        setSurcharges(s.data ?? []);
        const parProduit: typeof paliers = {};
        for (const x of g.data ?? []) (parProduit[x.produitId] ??= []).push(x);
        setPaliers(parProduit);
        setProduitId((prev) => prev || p.data?.[0]?.id || "");
      })
      .catch((e: ApiError) => {
        if (e.status !== 401) console.error(e);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(charger, [charger]);

  const produit = produits.find((p) => p.id === produitId) ?? null;

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
      <button onClick={() => setOuvert((v) => !v)} className="flex w-full items-center gap-2 text-left">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-600 text-white">
          <Tags size={16} />
        </span>
        <h2 className="font-bold text-slate-800 dark:text-slate-100">Tarifs</h2>
        <ChevronDown size={16} className={`text-slate-400 transition-transform ${ouvert ? "" : "-rotate-90"}`} />
      </button>

      {ouvert && (
        <div className="mt-3">
          {loading ? (
            <p className="text-sm text-slate-400">Chargement...</p>
          ) : produits.length === 0 ? (
            <p className="text-sm text-slate-400">Aucun produit : ajoutez-en un dans la section Produits.</p>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap gap-1.5" role="tablist" aria-label="Produit">
                {produits.map((p) => (
                  <button
                    key={p.id}
                    role="tab"
                    aria-selected={p.id === produitId}
                    onClick={() => setProduitId(p.id)}
                    className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                      p.id === produitId
                        ? "bg-[#1e3a8a] text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                  >
                    {p.code}
                  </button>
                ))}
              </div>

              {produit && (
                <div className="space-y-6">
                  <MatricePrix
                    key={`m-${produit.id}`}
                    produit={produit}
                    types={types}
                    surcharges={surcharges.filter((s) => s.produitId === produit.id)}
                    onSaved={charger}
                  />
                  <GrilleQuantite
                    key={`g-${produit.id}-${(paliers[produit.id] ?? []).length}`}
                    produit={produit}
                    initiaux={paliers[produit.id] ?? []}
                    onSaved={charger}
                  />
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// --- Matrice type de boutique × unité -------------------------------------

function MatricePrix({
  produit,
  types,
  surcharges,
  onSaved,
}: {
  produit: Produit;
  types: Type[];
  surcharges: Surcharge[];
  onSaved: () => void;
}) {
  const avecFilet = produit.prixFilet !== null;
  return (
    <section>
      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Prix par type de boutique</h3>
      <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
        Modifiez directement les cases : une ligne modifiée s&apos;enregistre avec la disquette. Le prix est appliqué
        automatiquement selon le type du point de vente.
      </p>
      <div className="overflow-x-auto rounded-xl ring-1 ring-slate-100 dark:ring-slate-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-950 dark:text-slate-400">
              <th className="px-3 py-2">Type de boutique</th>
              <th className="px-2 py-2 text-right">Sachet</th>
              {avecFilet && <th className="px-2 py-2 text-right">Filet</th>}
              <th className="px-2 py-2 text-right">Carton</th>
              <th className="w-24 px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-slate-100 dark:border-slate-800">
              <td className="px-3 py-2 font-medium text-slate-700 dark:text-slate-200">
                Prix de base <span className="ml-1 text-xs font-normal text-slate-400">(par défaut)</span>
              </td>
              <td className="px-2 py-2 text-right tabular-nums text-slate-500">{fmt(produit.prixSachet)}</td>
              {avecFilet && <td className="px-2 py-2 text-right tabular-nums text-slate-500">{fmt(produit.prixFilet ?? 0)}</td>}
              <td className="px-2 py-2 text-right tabular-nums text-slate-500">{fmt(produit.prixCarton)}</td>
              <td />
            </tr>
            {types.map((t) => (
              <LigneType
                key={`${t.id}-${surcharges.find((s) => s.typeId === t.id)?.id ?? "base"}`}
                produit={produit}
                type={t}
                surcharge={surcharges.find((s) => s.typeId === t.id)}
                avecFilet={avecFilet}
                onSaved={onSaved}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function LigneType({
  produit,
  type,
  surcharge,
  avecFilet,
  onSaved,
}: {
  produit: Produit;
  type: Type;
  surcharge: Surcharge | undefined;
  avecFilet: boolean;
  onSaved: () => void;
}) {
  const depart = {
    sachet: surcharge?.prixSachet ?? produit.prixSachet,
    filet: surcharge?.prixFilet ?? produit.prixFilet ?? 0,
    carton: surcharge?.prixCarton ?? produit.prixCarton,
  };
  const [v, setV] = useState(depart);
  const [saving, setSaving] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const modifie = v.sachet !== depart.sachet || v.filet !== depart.filet || v.carton !== depart.carton;

  async function enregistrer() {
    setSaving(true);
    setErreur(null);
    try {
      await apiFetch("/api/parametres/prix-par-type", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          produitId: produit.id,
          typeId: type.id,
          prixSachet: v.sachet,
          prixCarton: v.carton,
          ...(avecFilet ? { prixFilet: v.filet } : {}),
        }),
      });
      onSaved();
    } catch (e) {
      setErreur(e instanceof ApiError ? e.message : "Échec.");
    } finally {
      setSaving(false);
    }
  }

  async function reinitialiser() {
    if (!surcharge) return;
    setSaving(true);
    try {
      await apiFetch(`/api/parametres/prix-par-type/${surcharge.id}`, { method: "DELETE" });
      onSaved();
    } catch (e) {
      setErreur(e instanceof ApiError ? e.message : "Échec.");
    } finally {
      setSaving(false);
    }
  }

  const champ = (cle: "sachet" | "filet" | "carton") => (
    <input
      type="number"
      min={0}
      value={v[cle]}
      onChange={(e) => setV((x) => ({ ...x, [cle]: Number(e.target.value) || 0 }))}
      onWheel={(e) => (e.target as HTMLInputElement).blur()}
      aria-label={`${type.nom} — ${cle}`}
      className={cellule}
    />
  );

  return (
    <tr className="border-t border-slate-100 dark:border-slate-800">
      <td className="px-3 py-2 text-slate-700 dark:text-slate-200">
        {type.nom}
        {surcharge && (
          <span className="ml-2 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
            Personnalisé
          </span>
        )}
        {erreur && <span className="ml-2 text-xs text-alert">{erreur}</span>}
      </td>
      <td className="px-2 py-1.5">{champ("sachet")}</td>
      {avecFilet && <td className="px-2 py-1.5">{champ("filet")}</td>}
      <td className="px-2 py-1.5">{champ("carton")}</td>
      <td className="px-2 py-1.5">
        <div className="flex justify-end gap-1">
          {modifie && (
            <button
              onClick={enregistrer}
              disabled={saving}
              aria-label="Enregistrer cette ligne"
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#359980] text-white disabled:opacity-50"
            >
              <Save size={14} />
            </button>
          )}
          {surcharge && !modifie && (
            <button
              onClick={reinitialiser}
              disabled={saving}
              title="Revenir au prix de base"
              aria-label="Revenir au prix de base"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <RotateCcw size={14} />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

// --- Grille tarifaire par quantité ----------------------------------------

function GrilleQuantite({
  produit,
  initiaux,
  onSaved,
}: {
  produit: Produit;
  initiaux: { minCartons: number; maxCartons: number | null; prixCarton: number }[];
  onSaved: () => void;
}) {
  const [lignes, setLignes] = useState<Palier[]>(
    initiaux.map((p) => ({ minCartons: p.minCartons, maxCartons: p.maxCartons ?? "", prixCarton: p.prixCarton }))
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ton: "ok" | "erreur"; texte: string } | null>(null);

  const propres = useMemo(
    () =>
      lignes
        .filter((l) => l.minCartons !== "" && l.prixCarton !== "")
        .map((l) => ({
          minCartons: Number(l.minCartons),
          maxCartons: l.maxCartons === "" ? null : Number(l.maxCartons),
          prixCarton: Number(l.prixCarton),
        })),
    [lignes]
  );
  const erreurGrille = validerGrille(propres);

  function maj(i: number, cle: keyof Palier, valeur: string) {
    setMessage(null);
    setLignes((prev) => prev.map((l, j) => (j === i ? { ...l, [cle]: valeur === "" ? "" : Number(valeur) } : l)));
  }

  function ajouter() {
    setMessage(null);
    const dernier = propres.length ? Math.max(...propres.map((p) => p.maxCartons ?? p.minCartons)) : -1;
    setLignes((prev) => [...prev, { minCartons: dernier + 1, maxCartons: "", prixCarton: produit.prixCarton }]);
  }

  async function enregistrer() {
    if (erreurGrille) return setMessage({ ton: "erreur", texte: erreurGrille });
    setSaving(true);
    try {
      await apiFetch(`/api/parametres/paliers/${produit.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paliers: propres }),
      });
      setMessage({ ton: "ok", texte: propres.length ? "Grille enregistrée." : "Grille supprimée : le prix de base s'applique." });
      onSaved();
    } catch (e) {
      setMessage({ ton: "erreur", texte: e instanceof ApiError ? e.message : "Échec de l'enregistrement." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <h3 className="flex items-center gap-1.5 text-sm font-bold text-slate-800 dark:text-slate-100">
        <Layers size={15} className="text-indigo-700" /> Grille par quantité de cartons
      </h3>
      <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
        Le prix du carton change selon le nombre de cartons commandés (ex : 0 à 10 cartons = 9 000 FCFA, 11 à 100 =
        8 500 FCFA). Laissez « jusqu&apos;à » vide pour le dernier palier. Sans palier correspondant, le prix du type
        de boutique ou le prix de base s&apos;applique.
      </p>

      {lignes.length === 0 ? (
        <p className="rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-500 dark:bg-slate-950 dark:text-slate-400">
          Aucune grille pour {produit.code} : le prix du carton est le même quelle que soit la quantité.
        </p>
      ) : (
        <div className="space-y-2">
          <div className="hidden grid-cols-[1fr_1fr_1.3fr_auto] gap-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400 sm:grid">
            <span>De (cartons)</span>
            <span>Jusqu&apos;à</span>
            <span>Prix du carton (FCFA)</span>
            <span className="w-8" />
          </div>
          {lignes.map((l, i) => (
            <div key={i} className="grid grid-cols-2 items-center gap-2 sm:grid-cols-[1fr_1fr_1.3fr_auto]">
              <input type="number" min={0} value={l.minCartons} onChange={(e) => maj(i, "minCartons", e.target.value)} placeholder="De" aria-label="De (cartons)" className={cellule} />
              <input type="number" min={0} value={l.maxCartons} onChange={(e) => maj(i, "maxCartons", e.target.value)} placeholder="Illimité" aria-label="Jusqu'à (cartons)" className={cellule} />
              <input type="number" min={0} value={l.prixCarton} onChange={(e) => maj(i, "prixCarton", e.target.value)} placeholder="Prix" aria-label="Prix du carton" className={cellule} />
              <button
                onClick={() => setLignes((prev) => prev.filter((_, j) => j !== i))}
                aria-label="Supprimer ce palier"
                className="flex h-8 w-8 items-center justify-center justify-self-end rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {erreurGrille && lignes.length > 0 && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">{erreurGrille}</p>}
      {message && (
        <p className={`mt-2 rounded-lg px-3 py-2 text-xs ${message.ton === "ok" ? "bg-green-50 text-green-700" : "bg-red-50 text-alert"}`}>
          {message.texte}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={ajouter} className="flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200">
          <Plus size={14} /> Ajouter un palier
        </button>
        <button
          onClick={enregistrer}
          disabled={saving || Boolean(erreurGrille)}
          className="flex items-center gap-1.5 rounded-xl bg-[#1e3a8a] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
        >
          <Save size={14} /> {saving ? "Enregistrement…" : "Enregistrer la grille"}
        </button>
      </div>
    </section>
  );
}
