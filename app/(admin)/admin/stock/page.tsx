"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { apiFetch, ApiError } from "@/lib/client/apiFetch";
import {
  Package,
  AlertTriangle,
  CheckCircle2,
  Pencil,
  Check,
  X,
  RefreshCw,
  ClipboardList,
} from "lucide-react";

type StockItem = {
  id: string;
  produitId: string;
  produitCode: string;
  produitNom: string;
  quantiteSachets: number;
  quantiteCartons: number;
  sachetsParCarton: number;
  seuilAlerte: number;
  enAlerte: boolean;
  updatedAt: string;
};

type MouvementTous = {
  id: string;
  type: "ENTREE" | "SORTIE";
  quantiteSachets: number;
  referenceType: string | null;
  createdAt: string;
  produitCode: string;
  produitNom: string;
};

const LABEL_TYPE_MOUVEMENT: Record<string, string> = {
  VENTE: "Vente",
  AJUSTEMENT_MANUEL: "Ajustement manuel",
};

function couleurProduit(code: string) {
  return code === "HYPO" ? "#1e40af" : "#0f766e";
}

export default function StockPage() {
  const [stocks, setStocks] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [historique, setHistorique] = useState<MouvementTous[]>([]);
  const [historiqueLoading, setHistoriqueLoading] = useState(true);
  const [historiqueError, setHistoriqueError] = useState<string | null>(null);

  // --- Édition inline du seuil d'alerte -----------------------------
  const [seuilEnEdition, setSeuilEnEdition] = useState<string | null>(null); // produitId
  const [seuilValeur, setSeuilValeur] = useState(0);
  const [seuilSaving, setSeuilSaving] = useState(false);

  // --- Formulaire "Enregistrer un mouvement manuel" -----------------
  const [mvtProduitId, setMvtProduitId] = useState("");
  const [mvtType, setMvtType] = useState<"ENTREE" | "AJUSTEMENT">("ENTREE");
  const [mvtUnite, setMvtUnite] = useState<"cartons" | "sachets">("cartons");
  const [mvtQuantite, setMvtQuantite] = useState<number | "">("");
  const [mvtNote, setMvtNote] = useState("");
  const [mvtError, setMvtError] = useState<string | null>(null);
  const [mvtSuccess, setMvtSuccess] = useState<string | null>(null);
  const [mvtSaving, setMvtSaving] = useState(false);

  function loadStocks() {
    setLoading(true);
    setLoadError(null);
    apiFetch<{ data: StockItem[] }>("/api/stock")
      .then((d) => {
        setStocks(d.data ?? []);
        setMvtProduitId((prev) => prev || d.data?.[0]?.produitId || "");
      })
      .catch((e: ApiError) => {
        if (e.status !== 401) setLoadError(e.message);
      })
      .finally(() => setLoading(false));
  }

  function loadHistorique() {
    setHistoriqueLoading(true);
    setHistoriqueError(null);
    apiFetch<{ data: MouvementTous[] }>("/api/stock/mouvements")
      .then((d) => setHistorique(d.data ?? []))
      .catch((e: ApiError) => {
        if (e.status !== 401) setHistoriqueError(e.message);
      })
      .finally(() => setHistoriqueLoading(false));
  }

  useEffect(() => {
    loadStocks();
    loadHistorique();
  }, []);

  const produitSelectionne = useMemo(
    () => stocks.find((s) => s.produitId === mvtProduitId) ?? null,
    [stocks, mvtProduitId]
  );

  function ouvrirEditionSeuil(item: StockItem) {
    setSeuilEnEdition(item.produitId);
    setSeuilValeur(item.seuilAlerte);
  }

  async function enregistrerSeuil(item: StockItem) {
    setSeuilSaving(true);
    try {
      await apiFetch(`/api/stock/${item.produitId}/seuil`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seuilAlerte: seuilValeur }),
      });
      setSeuilEnEdition(null);
      loadStocks();
    } catch (e) {
      alert(e instanceof ApiError ? e.message : "Échec de l'enregistrement du seuil.");
    } finally {
      setSeuilSaving(false);
    }
  }

  async function soumettreMouvement(e: React.FormEvent) {
    e.preventDefault();
    setMvtError(null);
    setMvtSuccess(null);

    const cible = stocks.find((s) => s.produitId === mvtProduitId);
    if (!cible) {
      setMvtError("Sélectionnez un produit.");
      return;
    }
    const quantiteSaisieSachets =
      mvtUnite === "cartons" ? Number(mvtQuantite || 0) * cible.sachetsParCarton : Number(mvtQuantite || 0);

    if (!quantiteSaisieSachets || quantiteSaisieSachets < 0) {
      setMvtError("Indiquez une quantité valide.");
      return;
    }

    // "Entrée" : ajoute la quantité saisie au stock existant.
    // "Ajustement" : la quantité saisie est le NOUVEAU total ; on calcule
    // le delta par rapport au stock actuel puis on réutilise le même
    // service (ENTREE si positif, SORTIE si négatif) — aucune nouvelle
    // logique de blocage à écrire, applyStockMovement empêche déjà le
    // négatif des deux côtés.
    let type: "ENTREE" | "SORTIE";
    let quantiteSachets: number;
    if (mvtType === "ENTREE") {
      type = "ENTREE";
      quantiteSachets = quantiteSaisieSachets;
    } else {
      const delta = quantiteSaisieSachets - cible.quantiteSachets;
      if (delta === 0) {
        setMvtSuccess("Aucun changement : la quantité saisie est déjà le stock actuel.");
        return;
      }
      type = delta > 0 ? "ENTREE" : "SORTIE";
      quantiteSachets = Math.abs(delta);
    }

    setMvtSaving(true);
    try {
      await apiFetch(`/api/stock/${cible.produitId}/ajuster`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, quantiteSachets, motif: mvtNote || undefined }),
      });
      setMvtSuccess(
        `${mvtType === "ENTREE" ? "Entrée" : "Ajustement"} enregistré pour ${cible.produitNom}.`
      );
      setMvtQuantite("");
      setMvtNote("");
      loadStocks();
      loadHistorique();
    } catch (e) {
      setMvtError(e instanceof ApiError ? e.message : "Échec de l'enregistrement du mouvement.");
    } finally {
      setMvtSaving(false);
    }
  }

  return (
    <main>
      <AdminPageHeader title="Gestion du stock" subtitle="Vue d'ensemble et mouvements manuels" />

      <div className="space-y-5 p-4 md:p-6">
        {/* Tableau pleine largeur ------------------------------------- */}
        {loading ? (
          <p className="text-sm text-slate-400 dark:text-slate-500">Chargement...</p>
        ) : loadError ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-white dark:bg-slate-900 p-8 text-center shadow-sm ring-1 ring-slate-100 dark:ring-slate-800">
            <AlertTriangle size={22} className="text-alert" />
            <p className="text-sm text-slate-600 dark:text-slate-300">{loadError}</p>
            <button
              onClick={loadStocks}
              className="flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white"
            >
              <RefreshCw size={14} />
              Réessayer
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl bg-white dark:bg-slate-900 shadow-sm ring-1 ring-slate-100 dark:ring-slate-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-left text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  <th className="px-4 py-3">Produit</th>
                  <th className="px-4 py-3">Stock disponible</th>
                  <th className="px-4 py-3">Seuil d'alerte</th>
                  <th className="px-4 py-3">Statut</th>
                </tr>
              </thead>
              <tbody>
                {stocks.map((s) => (
                  <tr key={s.id} className="border-b border-slate-50 dark:border-slate-800 last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="flex h-9 w-9 items-center justify-center rounded-lg text-white"
                          style={{ backgroundColor: couleurProduit(s.produitCode) }}
                        >
                          <Package size={16} />
                        </span>
                        <div>
                          <p className="font-semibold text-slate-800 dark:text-slate-100">{s.produitNom}</p>
                          <p className="text-xs text-slate-400 dark:text-slate-500">{s.produitCode}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                      <span className="font-semibold">{s.quantiteCartons}</span> cartons
                      <span className="text-slate-400 dark:text-slate-500"> · {s.quantiteSachets} sachets</span>
                    </td>
                    <td className="px-4 py-3">
                      {seuilEnEdition === s.produitId ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min={0}
                            autoFocus
                            value={seuilValeur}
                            onChange={(e) => setSeuilValeur(Number(e.target.value) || 0)}
                            className="w-20 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1 text-sm"
                          />
                          <button
                            onClick={() => enregistrerSeuil(s)}
                            disabled={seuilSaving}
                            className="flex h-7 w-7 items-center justify-center rounded-md bg-green-50 text-green-700 disabled:opacity-50"
                            aria-label="Enregistrer le seuil"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            onClick={() => setSeuilEnEdition(null)}
                            className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                            aria-label="Annuler"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => ouvrirEditionSeuil(s)}
                          className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 hover:text-brand"
                        >
                          {s.seuilAlerte} sachets
                          <Pencil size={12} className="text-slate-300 dark:text-slate-600" />
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {s.enAlerte ? (
                        <span className="flex w-fit items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-alert">
                          <AlertTriangle size={12} />
                          Stock faible
                        </span>
                      ) : (
                        <span className="flex w-fit items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700">
                          <CheckCircle2 size={12} />
                          OK
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {stocks.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-400 dark:text-slate-500">
                      Aucun produit en stock.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Formulaire de mouvement manuel, en ligne (pas de modale) --- */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 p-4 shadow-sm ring-1 ring-slate-100 dark:ring-slate-800 md:p-5">
          <h2 className="mb-3 font-semibold text-slate-800 dark:text-slate-100">Enregistrer un mouvement manuel</h2>
          <form onSubmit={soumettreMouvement} className="grid gap-3 md:grid-cols-5">
            <select
              value={mvtProduitId}
              onChange={(e) => setMvtProduitId(e.target.value)}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 md:col-span-1"
            >
              {stocks.map((s) => (
                <option key={s.produitId} value={s.produitId}>
                  {s.produitNom}
                </option>
              ))}
            </select>

            <select
              value={mvtType}
              onChange={(e) => setMvtType(e.target.value as "ENTREE" | "AJUSTEMENT")}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 md:col-span-1"
            >
              <option value="ENTREE">Entrée</option>
              <option value="AJUSTEMENT">Ajustement</option>
            </select>

            <div className="flex gap-2 md:col-span-1">
              <select
                value={mvtUnite}
                onChange={(e) => setMvtUnite(e.target.value as "cartons" | "sachets")}
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-2 text-sm text-slate-800 dark:text-slate-100"
              >
                <option value="cartons">Cartons</option>
                <option value="sachets">Sachets</option>
              </select>
              <input
                type="number"
                min={0}
                required
                placeholder={mvtType === "AJUSTEMENT" ? "Nouveau total" : "Quantité"}
                value={mvtQuantite}
                onChange={(e) => setMvtQuantite(e.target.value === "" ? "" : Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-100"
              />
            </div>

            <input
              type="text"
              placeholder="Note (optionnel)"
              value={mvtNote}
              onChange={(e) => setMvtNote(e.target.value)}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 md:col-span-1"
            />

            <button
              type="submit"
              disabled={mvtSaving || !produitSelectionne}
              className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 md:col-span-1"
            >
              {mvtSaving ? "..." : "Valider"}
            </button>
          </form>

          {mvtType === "AJUSTEMENT" && produitSelectionne && (
            <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
              Stock actuel de {produitSelectionne.produitNom} : {produitSelectionne.quantiteCartons} cartons (
              {produitSelectionne.quantiteSachets} sachets). La quantité saisie ci-dessus remplacera ce total.
            </p>
          )}
          {mvtError && (
            <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-alert">{mvtError}</p>
          )}
          {mvtSuccess && (
            <p className="mt-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{mvtSuccess}</p>
          )}
        </div>

        {/* Historique combiné, tous produits confondus ---------------- */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 shadow-sm ring-1 ring-slate-100 dark:ring-slate-800">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 px-4 py-3">
            <ClipboardList size={16} className="text-slate-400 dark:text-slate-500" />
            <h2 className="font-semibold text-slate-800 dark:text-slate-100">Historique des mouvements</h2>
          </div>
          {historiqueLoading ? (
            <p className="px-4 py-6 text-sm text-slate-400 dark:text-slate-500">Chargement...</p>
          ) : historiqueError ? (
            <p className="mx-4 my-3 rounded-md bg-red-50 px-3 py-2 text-sm text-alert">{historiqueError}</p>
          ) : historique.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-400 dark:text-slate-500">Aucun mouvement enregistré.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-left text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    <th className="px-4 py-2">Date</th>
                    <th className="px-4 py-2">Produit</th>
                    <th className="px-4 py-2">Type</th>
                    <th className="px-4 py-2">Quantité</th>
                    <th className="px-4 py-2">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {historique.map((m) => (
                    <tr key={m.id} className="border-b border-slate-50 dark:border-slate-800 last:border-0">
                      <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">
                        {new Date(m.createdAt).toLocaleDateString("fr-FR")}
                      </td>
                      <td className="px-4 py-2.5 text-slate-700 dark:text-slate-200">
                        {m.produitCode} — {m.produitNom}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`font-medium ${
                            m.type === "ENTREE" ? "text-green-700" : "text-alert"
                          }`}
                        >
                          {m.type === "ENTREE" ? "Entrée" : "Sortie"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-700 dark:text-slate-200">
                        {m.type === "ENTREE" ? "+" : "-"}
                        {m.quantiteSachets} sachets
                      </td>
                      <td className="px-4 py-2.5 text-slate-400 dark:text-slate-500">
                        {LABEL_TYPE_MOUVEMENT[m.referenceType ?? ""] ?? m.referenceType ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
