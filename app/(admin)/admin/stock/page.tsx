"use client";

import { useEffect, useState } from "react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import {
  Package,
  AlertTriangle,
  Plus,
  Minus,
  History,
  Settings2,
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

type Mouvement = {
  id: string;
  type: "ENTREE" | "SORTIE";
  quantiteSachets: number;
  referenceType: string | null;
  createdAt: string;
};

const LABEL_TYPE_MOUVEMENT: Record<string, string> = {
  VENTE: "Vente",
  AJUSTEMENT_MANUEL: "Ajustement manuel",
};

export default function StockPage() {
  const [stocks, setStocks] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [ajusterTarget, setAjusterTarget] = useState<StockItem | null>(null);
  const [ajusterType, setAjusterType] = useState<"ENTREE" | "SORTIE">("ENTREE");
  const [ajusterUnite, setAjusterUnite] = useState<"cartons" | "sachets">("cartons");
  const [ajusterQuantite, setAjusterQuantite] = useState(0);
  const [ajusterMotif, setAjusterMotif] = useState("");
  const [ajusterError, setAjusterError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [seuilTarget, setSeuilTarget] = useState<StockItem | null>(null);
  const [seuilValeur, setSeuilValeur] = useState(0);

  const [historiqueTarget, setHistoriqueTarget] = useState<StockItem | null>(null);
  const [historique, setHistorique] = useState<Mouvement[]>([]);
  const [historiqueLoading, setHistoriqueLoading] = useState(false);

  function load() {
    setLoading(true);
    fetch("/api/stock")
      .then((r) => r.json())
      .then((d) => setStocks(d.data ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  function ouvrirAjuster(item: StockItem, type: "ENTREE" | "SORTIE") {
    setAjusterTarget(item);
    setAjusterType(type);
    setAjusterUnite("cartons");
    setAjusterQuantite(0);
    setAjusterMotif("");
    setAjusterError(null);
  }

  async function confirmerAjuster(e: React.FormEvent) {
    e.preventDefault();
    if (!ajusterTarget) return;
    setSaving(true);
    setAjusterError(null);

    const quantiteSachets =
      ajusterUnite === "cartons"
        ? ajusterQuantite * ajusterTarget.sachetsParCarton
        : ajusterQuantite;

    const res = await fetch(`/api/stock/${ajusterTarget.produitId}/ajuster`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: ajusterType, quantiteSachets, motif: ajusterMotif || undefined }),
    });

    if (res.ok) {
      setAjusterTarget(null);
      load();
    } else {
      const d = await res.json().catch(() => ({}));
      setAjusterError(d.error ?? "Échec de l'ajustement.");
    }
    setSaving(false);
  }

  async function confirmerSeuil(e: React.FormEvent) {
    e.preventDefault();
    if (!seuilTarget) return;
    setSaving(true);
    await fetch(`/api/stock/${seuilTarget.produitId}/seuil`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seuilAlerte: seuilValeur }),
    });
    setSeuilTarget(null);
    setSaving(false);
    load();
  }

  function ouvrirHistorique(item: StockItem) {
    setHistoriqueTarget(item);
    setHistoriqueLoading(true);
    fetch(`/api/stock/${item.produitId}/mouvements`)
      .then((r) => r.json())
      .then((d) => setHistorique(d.data ?? []))
      .finally(() => setHistoriqueLoading(false));
  }

  return (
    <main>
      <AdminPageHeader title="Gestion du stock" subtitle="Vue et ajustement manuel par produit" />

      <div className="p-4 md:p-6">
        {loading ? (
          <p className="text-sm text-slate-400">Chargement...</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {stocks.map((s) => (
              <div
                key={s.id}
                className={`rounded-2xl bg-white p-4 shadow-sm ring-1 ${
                  s.enAlerte ? "ring-2 ring-red-200" : "ring-slate-100"
                }`}
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="flex h-10 w-10 items-center justify-center rounded-lg text-white"
                      style={{ backgroundColor: s.produitCode === "HYPO" ? "#1e40af" : "#0f766e" }}
                    >
                      <Package size={18} />
                    </span>
                    <div>
                      <p className="font-bold text-slate-800">{s.produitNom}</p>
                      <p className="text-xs text-slate-400">{s.produitCode}</p>
                    </div>
                  </div>
                  {s.enAlerte && (
                    <span className="flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-alert">
                      <AlertTriangle size={12} />
                      Faible
                    </span>
                  )}
                </div>

                <div className="mb-3 grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-slate-50 p-3 text-center">
                    <p className="text-xl font-bold text-slate-800">{s.quantiteCartons}</p>
                    <p className="text-xs text-slate-400">cartons</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3 text-center">
                    <p className="text-xl font-bold text-slate-800">{s.quantiteSachets}</p>
                    <p className="text-xs text-slate-400">sachets</p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setSeuilTarget(s);
                    setSeuilValeur(s.seuilAlerte);
                  }}
                  className="mb-3 flex w-full items-center justify-between rounded-lg bg-amber-50/60 px-3 py-2 text-xs text-amber-800"
                >
                  <span className="flex items-center gap-1">
                    <Settings2 size={12} />
                    Seuil d'alerte
                  </span>
                  <span className="font-semibold">{s.seuilAlerte} sachets</span>
                </button>

                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    onClick={() => ouvrirAjuster(s, "ENTREE")}
                    className="flex items-center justify-center gap-1 rounded-lg bg-green-50 py-2 text-xs font-semibold text-green-700"
                  >
                    <Plus size={13} />
                    Réassort
                  </button>
                  <button
                    onClick={() => ouvrirAjuster(s, "SORTIE")}
                    className="flex items-center justify-center gap-1 rounded-lg bg-red-50 py-2 text-xs font-semibold text-alert"
                  >
                    <Minus size={13} />
                    Retirer
                  </button>
                  <button
                    onClick={() => ouvrirHistorique(s)}
                    className="flex items-center justify-center gap-1 rounded-lg bg-slate-100 py-2 text-xs font-semibold text-slate-600"
                  >
                    <History size={13} />
                    Historique
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal ajustement */}
      {ajusterTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form onSubmit={confirmerAjuster} className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-lg">
            <h3 className="mb-1 font-semibold text-slate-800">
              {ajusterType === "ENTREE" ? "Réassort" : "Retirer du stock"} — {ajusterTarget.produitNom}
            </h3>
            <p className="mb-3 text-xs text-slate-400">
              Stock actuel : {ajusterTarget.quantiteCartons} cartons ({ajusterTarget.quantiteSachets} sachets)
            </p>

            <div className="mb-3 flex gap-2">
              <select
                value={ajusterUnite}
                onChange={(e) => setAjusterUnite(e.target.value as "cartons" | "sachets")}
                className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
              >
                <option value="cartons">Cartons</option>
                <option value="sachets">Sachets</option>
              </select>
              <input
                type="number"
                min={1}
                required
                value={ajusterQuantite || ""}
                onChange={(e) => setAjusterQuantite(Number(e.target.value) || 0)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <label className="mb-1 block text-xs font-medium text-slate-500">Motif (optionnel)</label>
            <input
              type="text"
              value={ajusterMotif}
              onChange={(e) => setAjusterMotif(e.target.value)}
              placeholder={ajusterType === "ENTREE" ? "Ex : Livraison fournisseur" : "Ex : Casse, périmé..."}
              className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />

            {ajusterError && (
              <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-alert">{ajusterError}</p>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAjusterTarget(null)}
                className="flex-1 rounded-lg bg-slate-100 py-2 text-sm font-medium text-slate-600"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={saving}
                className={`flex-1 rounded-lg py-2 text-sm font-medium text-white disabled:opacity-60 ${
                  ajusterType === "ENTREE" ? "bg-green-600" : "bg-alert"
                }`}
              >
                {saving ? "..." : "Confirmer"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal seuil */}
      {seuilTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form onSubmit={confirmerSeuil} className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-lg">
            <h3 className="mb-3 font-semibold text-slate-800">Seuil d'alerte — {seuilTarget.produitNom}</h3>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              Alerte "stock faible" en dessous de (sachets)
            </label>
            <input
              type="number"
              min={0}
              required
              value={seuilValeur}
              onChange={(e) => setSeuilValeur(Number(e.target.value) || 0)}
              className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSeuilTarget(null)}
                className="flex-1 rounded-lg bg-slate-100 py-2 text-sm font-medium text-slate-600"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 rounded-lg bg-blue-700 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {saving ? "..." : "Enregistrer"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal historique */}
      {historiqueTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-lg">
            <h3 className="mb-3 font-semibold text-slate-800">
              Historique — {historiqueTarget.produitNom}
            </h3>
            {historiqueLoading ? (
              <p className="text-sm text-slate-400">Chargement...</p>
            ) : historique.length === 0 ? (
              <p className="text-sm text-slate-400">Aucun mouvement enregistré.</p>
            ) : (
              <div className="mb-4 max-h-80 space-y-1.5 overflow-y-auto">
                {historique.map((m) => (
                  <div key={m.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                    <div>
                      <p className={`font-medium ${m.type === "ENTREE" ? "text-green-700" : "text-alert"}`}>
                        {m.type === "ENTREE" ? "+" : "-"}{m.quantiteSachets} sachets
                      </p>
                      <p className="text-xs text-slate-400">
                        {LABEL_TYPE_MOUVEMENT[m.referenceType ?? ""] ?? m.referenceType ?? "—"}
                      </p>
                    </div>
                    <span className="text-xs text-slate-400">
                      {new Date(m.createdAt).toLocaleDateString("fr-FR")}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={() => setHistoriqueTarget(null)}
              className="w-full rounded-lg bg-slate-100 py-2 text-sm font-medium text-slate-600"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
