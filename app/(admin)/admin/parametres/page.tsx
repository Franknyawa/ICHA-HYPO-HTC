"use client";

import { useEffect, useState } from "react";
import {
  MapPin,
  Store,
  Users2,
  Package,
  Target,
  Plus,
  Pencil,
  Clock,
  Trash2,
  Merge,
  BellRing,
  ChevronDown,
} from "lucide-react";
import { ObjectifsTerritoireManager } from "@/components/admin/parametres/ObjectifsTerritoireManager";
import { TarifsManager } from "@/components/admin/parametres/TarifsManager";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { apiFetch, ApiError } from "@/lib/client/apiFetch";

type Entity = { id: string; nom: string; actif: boolean; ordre?: number };

// --- Gestionnaire générique (Villes / Types / Binômes) -----------------
// Les trois partagent exactement la même forme {id, nom, actif} et le
// même cycle CRUD — un seul composant paramétré par son endpoint API.
// `avecOrdre` active en plus un champ numérique d'ordre d'affichage
// (utilisé pour les Types de boutique).

function SimpleEntityManager({
  apiBase,
  labelSingulier,
  icon: Icon,
  color,
  avecOrdre = false,
  labelPluriel,
}: {
  apiBase: string;
  labelSingulier: string;
  icon: React.ElementType;
  color: string;
  avecOrdre?: boolean;
  labelPluriel?: string;
}) {
  const [items, setItems] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newNom, setNewNom] = useState("");
  const [editTarget, setEditTarget] = useState<Entity | null>(null);
  const [editNom, setEditNom] = useState("");
  const [editOrdre, setEditOrdre] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [ouvert, setOuvert] = useState(true);

  function load() {
    setLoading(true);
    apiFetch<{ data: Entity[] }>(apiBase)
      .then((d) => setItems(d.data ?? []))
      .catch((e: ApiError) => {
        if (e.status !== 401) console.error(e);
      })
      .finally(() => setLoading(false));
  }

  useEffect(load, [apiBase]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch(apiBase, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nom: newNom }),
    });
    if (res.ok) {
      setShowCreate(false);
      setNewNom("");
      load();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Échec de la création.");
    }
    setSaving(false);
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editTarget) return;
    setSaving(true);
    setError(null);
    const res = await fetch(`${apiBase}/${editTarget.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nom: editNom, ...(avecOrdre ? { ordre: editOrdre } : {}) }),
    });
    if (res.ok) {
      setEditTarget(null);
      load();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Échec de la mise à jour.");
    }
    setSaving(false);
  }

  async function toggleActif(item: Entity) {
    setError(null);
    const res = await fetch(`${apiBase}/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actif: !item.actif }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? `Échec de la mise à jour (${res.status}).`);
      return;
    }
    load();
  }

  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900 p-4 shadow-sm ring-1 ring-slate-100 dark:ring-slate-800">
      <div className="mb-3 flex items-center justify-between">
        <button
          onClick={() => setOuvert((v) => !v)}
          className="flex flex-1 items-center gap-2 text-left"
        >
          <span
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white"
            style={{ backgroundColor: color }}
          >
            <Icon size={16} />
          </span>
          <h2 className="font-bold text-slate-800 dark:text-slate-100">{labelPluriel ?? `${labelSingulier}s`}</h2>
          <ChevronDown
            size={16}
            className={`text-slate-400 transition-transform ${ouvert ? "" : "-rotate-90"}`}
          />
        </button>
        <button
          onClick={() => {
            setShowCreate(true);
            setError(null);
          }}
          className="flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300"
        >
          <Plus size={14} />
          Ajouter
        </button>
      </div>

      {ouvert && (
        <>
          {error && (
            <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-alert">{error}</p>
          )}

          {loading ? (
            <p className="text-sm text-slate-400 dark:text-slate-500">Chargement...</p>
          ) : (
            <div className="space-y-1.5">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-xl bg-slate-50 dark:bg-slate-950 px-3 py-2"
            >
              <span className={`text-sm font-medium ${item.actif ? "text-slate-700 dark:text-slate-300" : "text-slate-400 dark:text-slate-500 line-through"}`}>
                {avecOrdre && item.ordre ? `${item.ordre}. ` : ""}
                {item.nom}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setEditTarget(item);
                    setEditNom(item.nom);
                    setEditOrdre(item.ordre ?? 0);
                    setError(null);
                  }}
                  className="text-slate-400 dark:text-slate-500"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => toggleActif(item)}
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    item.actif ? "bg-green-50 text-green-700" : "bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
                  }`}
                >
                  {item.actif ? "Actif" : "Inactif"}
                </button>
              </div>
            </div>
          ))}
          {items.length === 0 && (
            <p className="text-sm text-slate-400 dark:text-slate-500">Aucun élément.</p>
          )}
        </div>
      )}
        </>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form onSubmit={handleCreate} className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 p-5 shadow-lg">
            <h3 className="mb-3 font-semibold text-slate-800 dark:text-slate-100">Nouveau {labelSingulier.toLowerCase()}</h3>
            <input
              type="text"
              value={newNom}
              onChange={(e) => setNewNom(e.target.value)}
              required
              placeholder="Nom"
              className="mb-3 w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm"
            />
            {error && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-alert">{error}</p>}
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowCreate(false)} className="flex-1 rounded-lg bg-slate-100 dark:bg-slate-800 py-2 text-sm font-medium text-slate-600 dark:text-slate-300">
                Annuler
              </button>
              <button type="submit" disabled={saving} className="flex-1 rounded-lg bg-blue-700 py-2 text-sm font-medium text-white disabled:opacity-60">
                {saving ? "..." : "Créer"}
              </button>
            </div>
          </form>
        </div>
      )}

      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form onSubmit={handleEdit} className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 p-5 shadow-lg">
            <h3 className="mb-3 font-semibold text-slate-800 dark:text-slate-100">Modifier</h3>
            <input
              type="text"
              value={editNom}
              onChange={(e) => setEditNom(e.target.value)}
              required
              className="mb-3 w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm"
            />
            {avecOrdre && (
              <>
                <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                  Ordre d&apos;affichage
                </label>
                <input
                  type="number"
                  min={0}
                  value={editOrdre}
                  onChange={(e) => setEditOrdre(Number(e.target.value) || 0)}
                  className="mb-3 w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm"
                />
              </>
            )}
            {error && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-alert">{error}</p>}
            <div className="flex gap-2">
              <button type="button" onClick={() => setEditTarget(null)} className="flex-1 rounded-lg bg-slate-100 dark:bg-slate-800 py-2 text-sm font-medium text-slate-600 dark:text-slate-300">
                Annuler
              </button>
              <button type="submit" disabled={saving} className="flex-1 rounded-lg bg-blue-700 py-2 text-sm font-medium text-white disabled:opacity-60">
                {saving ? "..." : "Enregistrer"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// --- Produits : prix uniquement -----------------------------------------

type Produit = {
  id: string;
  code: string;
  nom: string;
  prixSachet: number;
  prixFilet: number | null;
  prixCarton: number;
  gamme?: string | null;
  designation?: string | null;
  actif: boolean;
};

function ProduitsManager() {
  const [produits, setProduits] = useState<Produit[]>([]);
  const [loading, setLoading] = useState(true);
  const [editTarget, setEditTarget] = useState<Produit | null>(null);
  const [form, setForm] = useState({ prixSachet: 0, prixFilet: 0, prixCarton: 0, gamme: "", designation: "" });
  const [saving, setSaving] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    code: "",
    nom: "",
    gamme: "",
    volumeMl: 0,
    sachetsParCarton: 0,
    aDesFilets: false,
    filetsParCarton: 0,
    sachetsParFilet: 0,
    prixSachet: 0,
    prixFilet: 0,
    prixCarton: 0,
  });
  const [createError, setCreateError] = useState<string | null>(null);
  const [ouvert, setOuvert] = useState(true);

  function load() {
    setLoading(true);
    apiFetch<{ data: Produit[] }>("/api/parametres/produits")
      .then((d) => setProduits(d.data ?? []))
      .catch((e: ApiError) => {
        if (e.status !== 401) console.error(e);
      })
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setCreateError(null);
    const res = await fetch("/api/parametres/produits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: createForm.code.toUpperCase().replace(/\s+/g, "_"),
        nom: createForm.nom,
        gamme: createForm.gamme.trim() || null,
        volumeMl: createForm.volumeMl,
        sachetsParCarton: createForm.sachetsParCarton,
        filetsParCarton: createForm.aDesFilets ? createForm.filetsParCarton : null,
        sachetsParFilet: createForm.aDesFilets ? createForm.sachetsParFilet : null,
        prixSachet: createForm.prixSachet,
        prixFilet: createForm.aDesFilets ? createForm.prixFilet : null,
        prixCarton: createForm.prixCarton,
      }),
    });
    if (res.ok) {
      setShowCreate(false);
      setCreateForm({
        code: "",
        nom: "",
        gamme: "",
        volumeMl: 0,
        sachetsParCarton: 0,
        aDesFilets: false,
        filetsParCarton: 0,
        sachetsParFilet: 0,
        prixSachet: 0,
        prixFilet: 0,
        prixCarton: 0,
      });
      load();
    } else {
      const d = await res.json().catch(() => ({}));
      setCreateError(d.error ?? "Échec de la création.");
    }
    setSaving(false);
  }

  async function handleDelete(p: Produit) {
    setDeleteError(null);
    if (!confirm(`Supprimer définitivement ${p.code} ? Cette action est irréversible.`)) {
      return;
    }
    const res = await fetch(`/api/parametres/produits/${p.id}`, { method: "DELETE" });
    if (res.ok) {
      load();
    } else {
      const d = await res.json().catch(() => ({}));
      setDeleteError(d.error ?? "Échec de la suppression.");
    }
  }

  async function toggleActif(p: Produit) {
    await fetch(`/api/parametres/produits/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actif: !p.actif }),
    });
    load();
  }

  function openEdit(p: Produit) {
    setEditTarget(p);
    setForm({
      prixSachet: p.prixSachet,
      prixFilet: p.prixFilet ?? 0,
      prixCarton: p.prixCarton,
      gamme: p.gamme ?? "",
      designation: p.designation ?? "",
    });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editTarget) return;
    setSaving(true);
    await fetch(`/api/parametres/produits/${editTarget.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gamme: form.gamme.trim() || null,
        designation: form.designation.trim() || null,
        prixSachet: form.prixSachet,
        prixCarton: form.prixCarton,
        ...(editTarget.prixFilet !== null ? { prixFilet: form.prixFilet } : {}),
      }),
    });
    setEditTarget(null);
    setSaving(false);
    load();
  }

  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900 p-4 shadow-sm ring-1 ring-slate-100 dark:ring-slate-800">
      <div className="mb-3 flex items-center justify-between">
        <button onClick={() => setOuvert((v) => !v)} className="flex flex-1 items-center gap-2 text-left">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-700 text-white">
            <Package size={16} />
          </span>
          <h2 className="font-bold text-slate-800 dark:text-slate-100">Produits & prix</h2>
          <ChevronDown size={16} className={`text-slate-400 transition-transform ${ouvert ? "" : "-rotate-90"}`} />
        </button>
        <button
          onClick={() => {
            setShowCreate(true);
            setCreateError(null);
          }}
          className="flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300"
        >
          <Plus size={14} />
          Nouveau
        </button>
      </div>

      {ouvert && (loading ? (
        <p className="text-sm text-slate-400 dark:text-slate-500">Chargement...</p>
      ) : (
        <div className="space-y-2">
          {deleteError && (
            <p className="mb-2 rounded-md bg-red-50 px-3 py-2 text-sm text-alert">{deleteError}</p>
          )}
          {produits.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-xl bg-slate-50 dark:bg-slate-950 px-3 py-2.5">
              <div>
                <p className={`text-sm font-semibold ${p.actif ? "text-slate-800 dark:text-slate-100" : "text-slate-400 dark:text-slate-500 line-through"}`}>
                  {p.code}
                  {p.gamme && (
                    <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                      {p.gamme}
                    </span>
                  )}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {p.prixSachet.toLocaleString("fr-FR")} FCFA/sachet
                  {p.prixFilet !== null ? ` · ${p.prixFilet.toLocaleString("fr-FR")} FCFA/filet` : ""}
                  {" · "}
                  {p.prixCarton.toLocaleString("fr-FR")} FCFA/carton
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => openEdit(p)} className="text-slate-400 dark:text-slate-500">
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => toggleActif(p)}
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    p.actif ? "bg-green-50 text-green-700" : "bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
                  }`}
                >
                  {p.actif ? "Actif" : "Inactif"}
                </button>
                <button onClick={() => handleDelete(p)} className="text-alert">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ))}

      <datalist id="gammes-existantes">
        {[...new Set(produits.map((p) => p.gamme).filter(Boolean) as string[])].map((g) => (
          <option key={g} value={g} />
        ))}
      </datalist>

      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form onSubmit={handleSave} className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 p-5 shadow-lg">
            <h3 className="mb-3 font-semibold text-slate-800 dark:text-slate-100">Prix {editTarget.code}</h3>

            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Désignation (factures et bons)</label>
            <input
              type="text"
              maxLength={160}
              placeholder="Ex : HYPO eau de Javel carton de 112 sachets de 75ml"
              value={form.designation}
              onChange={(e) => setForm((f) => ({ ...f, designation: e.target.value }))}
              className="mb-3 w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm"
            />

            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Gamme (rapports)</label>
            <input
              type="text"
              list="gammes-existantes"
              maxLength={40}
              placeholder="Ex : Entretien, Céréales, Hygiène"
              value={form.gamme}
              onChange={(e) => setForm((f) => ({ ...f, gamme: e.target.value }))}
              className="mb-3 w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm"
            />

            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Prix par sachet (FCFA)</label>
            <input
              type="number"
              min={0}
              value={form.prixSachet}
              onChange={(e) => setForm((f) => ({ ...f, prixSachet: Number(e.target.value) || 0 }))}
              className="mb-3 w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm"
            />

            {editTarget.prixFilet !== null && (
              <>
                <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Prix par filet (FCFA)</label>
                <input
                  type="number"
                  min={0}
                  value={form.prixFilet}
                  onChange={(e) => setForm((f) => ({ ...f, prixFilet: Number(e.target.value) || 0 }))}
                  className="mb-3 w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm"
                />
              </>
            )}

            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Prix par carton (FCFA)</label>
            <input
              type="number"
              min={0}
              value={form.prixCarton}
              onChange={(e) => setForm((f) => ({ ...f, prixCarton: Number(e.target.value) || 0 }))}
              className="mb-3 w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm"
            />

            <div className="flex gap-2">
              <button type="button" onClick={() => setEditTarget(null)} className="flex-1 rounded-lg bg-slate-100 dark:bg-slate-800 py-2 text-sm font-medium text-slate-600 dark:text-slate-300">
                Annuler
              </button>
              <button type="submit" disabled={saving} className="flex-1 rounded-lg bg-blue-700 py-2 text-sm font-medium text-white disabled:opacity-60">
                {saving ? "..." : "Enregistrer"}
              </button>
            </div>
          </form>
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={handleCreate}
            className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 p-5 shadow-lg"
          >
            <h3 className="mb-3 font-semibold text-slate-800 dark:text-slate-100">Nouveau produit</h3>
            <p className="mb-3 text-xs text-slate-400 dark:text-slate-500">
              Apparaîtra automatiquement dans la Visite de réassort. Le
              formulaire "Nouveau recensement" reste pour l'instant limité à
              HYPO/HTC (voir README).
            </p>

            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Gamme (ex : Céréales, Hygiène)</label>
            <input
              type="text"
              list="gammes-existantes"
              maxLength={40}
              value={createForm.gamme}
              onChange={(e) => setCreateForm((f) => ({ ...f, gamme: e.target.value }))}
              className="mb-3 w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm"
            />
            <div className="mb-3 grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Code (ex: XYZ)</label>
                <input
                  type="text"
                  required
                  value={createForm.code}
                  onChange={(e) => setCreateForm((f) => ({ ...f, code: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm uppercase"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Volume (ml)</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={createForm.volumeMl || ""}
                  onChange={(e) => setCreateForm((f) => ({ ...f, volumeMl: Number(e.target.value) || 0 }))}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Nom complet</label>
            <input
              type="text"
              required
              value={createForm.nom}
              onChange={(e) => setCreateForm((f) => ({ ...f, nom: e.target.value }))}
              className="mb-3 w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm"
            />

            <label className="mb-2 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={createForm.aDesFilets}
                onChange={(e) => setCreateForm((f) => ({ ...f, aDesFilets: e.target.checked }))}
              />
              Ce produit se vend aussi par filet (comme HTC)
            </label>

            <div className="mb-3 grid grid-cols-2 gap-2">
              {createForm.aDesFilets && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Sachets/filet</label>
                  <input
                    type="number"
                    min={1}
                    value={createForm.sachetsParFilet || ""}
                    onChange={(e) => setCreateForm((f) => ({ ...f, sachetsParFilet: Number(e.target.value) || 0 }))}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm"
                  />
                </div>
              )}
              {createForm.aDesFilets && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Filets/carton</label>
                  <input
                    type="number"
                    min={1}
                    value={createForm.filetsParCarton || ""}
                    onChange={(e) => setCreateForm((f) => ({ ...f, filetsParCarton: Number(e.target.value) || 0 }))}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm"
                  />
                </div>
              )}
              <div className={createForm.aDesFilets ? "col-span-2" : ""}>
                <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Sachets/carton</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={createForm.sachetsParCarton || ""}
                  onChange={(e) => setCreateForm((f) => ({ ...f, sachetsParCarton: Number(e.target.value) || 0 }))}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="mb-3 grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Prix/sachet</label>
                <input
                  type="number"
                  min={0}
                  value={createForm.prixSachet || ""}
                  onChange={(e) => setCreateForm((f) => ({ ...f, prixSachet: Number(e.target.value) || 0 }))}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Prix/carton</label>
                <input
                  type="number"
                  min={0}
                  value={createForm.prixCarton || ""}
                  onChange={(e) => setCreateForm((f) => ({ ...f, prixCarton: Number(e.target.value) || 0 }))}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm"
                />
              </div>
              {createForm.aDesFilets && (
                <div className="col-span-2">
                  <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Prix/filet</label>
                  <input
                    type="number"
                    min={0}
                    value={createForm.prixFilet || ""}
                    onChange={(e) => setCreateForm((f) => ({ ...f, prixFilet: Number(e.target.value) || 0 }))}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm"
                  />
                </div>
              )}
            </div>

            {createError && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-alert">{createError}</p>}

            <div className="flex gap-2">
              <button type="button" onClick={() => setShowCreate(false)} className="flex-1 rounded-lg bg-slate-100 dark:bg-slate-800 py-2 text-sm font-medium text-slate-600 dark:text-slate-300">
                Annuler
              </button>
              <button type="submit" disabled={saving} className="flex-1 rounded-lg bg-blue-700 py-2 text-sm font-medium text-white disabled:opacity-60">
                {saving ? "..." : "Créer"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// --- Objectifs : valeur courante par binôme -----------------------------

type ObjectifBinome = {
  id: string;
  nom: string;
  objectifJournalier: { id: string; valeurCartons: number } | null;
  objectifHebdomadaire: { id: string; valeurCartons: number } | null;
};

function ObjectifsManager() {
  const [data, setData] = useState<ObjectifBinome[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [ouvert, setOuvert] = useState(true);

  function load() {
    setLoading(true);
    apiFetch<{ data: ObjectifBinome[] }>("/api/parametres/objectifs")
      .then((d) => setData(d.data ?? []))
      .catch((e: ApiError) => {
        if (e.status !== 401) console.error(e);
      })
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function saveValeur(
    binomeId: string,
    periode: "JOURNALIER" | "HEBDOMADAIRE",
    objectifId: string | null,
    valeur: number
  ) {
    setSaving(`${binomeId}-${periode}`);
    if (objectifId) {
      await fetch(`/api/parametres/objectifs/${objectifId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ valeurCartons: valeur }),
      });
    } else {
      await fetch("/api/parametres/objectifs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ binomeId, periode, valeurCartons: valeur }),
      });
    }
    setSaving(null);
    load();
  }

  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900 p-4 shadow-sm ring-1 ring-slate-100 dark:ring-slate-800">
      <button onClick={() => setOuvert((v) => !v)} className="mb-3 flex w-full items-center gap-2 text-left">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-600 text-white">
          <Target size={16} />
        </span>
        <h2 className="font-bold text-slate-800 dark:text-slate-100">Objectifs (période en cours)</h2>
        <ChevronDown size={16} className={`text-slate-400 transition-transform ${ouvert ? "" : "-rotate-90"}`} />
      </button>

      {ouvert && (loading ? (
        <p className="text-sm text-slate-400 dark:text-slate-500">Chargement...</p>
      ) : (
        <div className="space-y-3">
          {data.map((b) => (
            <div key={b.id} className="rounded-xl bg-slate-50 dark:bg-slate-950 p-3">
              <p className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">{b.nom}</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    Cartons / jour
                  </label>
                  <ObjectifInput
                    defaultValue={b.objectifJournalier?.valeurCartons ?? 42}
                    saving={saving === `${b.id}-JOURNALIER`}
                    onSave={(v) =>
                      saveValeur(b.id, "JOURNALIER", b.objectifJournalier?.id ?? null, v)
                    }
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    Cartons / semaine
                  </label>
                  <ObjectifInput
                    defaultValue={b.objectifHebdomadaire?.valeurCartons ?? 2500}
                    saving={saving === `${b.id}-HEBDOMADAIRE`}
                    onSave={(v) =>
                      saveValeur(b.id, "HEBDOMADAIRE", b.objectifHebdomadaire?.id ?? null, v)
                    }
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function ObjectifInput({
  defaultValue,
  saving,
  onSave,
}: {
  defaultValue: number;
  saving: boolean;
  onSave: (v: number) => void;
}) {
  const [value, setValue] = useState(defaultValue);

  // useState(defaultValue) ne capture que la valeur INITIALE — sans ce
  // useEffect, si le serveur renvoie une valeur différente après un
  // rechargement (ex: sauvegarde faite depuis un autre onglet), l'input
  // resterait bloqué sur l'ancienne valeur affichée localement.
  useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue]);
  return (
    <div className="flex gap-1.5">
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => setValue(Number(e.target.value) || 0)}
        className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-2 py-1.5 text-sm"
      />
      <button
        onClick={() => onSave(value)}
        disabled={saving}
        className="shrink-0 rounded-lg bg-blue-700 px-2.5 text-xs font-semibold text-white disabled:opacity-50"
      >
        {saving ? "..." : "OK"}
      </button>
    </div>
  );
}

// --- Objectifs individuels (par commercial, pas par binôme) --------------

type ObjectifIndividuel = { periode: "JOURNALIER" | "HEBDOMADAIRE" | "MENSUEL"; valeurCartons: number };

const LABEL_PERIODE: Record<string, string> = {
  JOURNALIER: "Cartons / jour",
  HEBDOMADAIRE: "Cartons / semaine",
  MENSUEL: "Cartons / mois",
};

function ObjectifsIndividuelsManager() {
  const [data, setData] = useState<ObjectifIndividuel[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ouvert, setOuvert] = useState(true);

  function load() {
    setLoading(true);
    apiFetch<{ data: ObjectifIndividuel[] }>("/api/parametres/objectifs-individuels")
      .then((d) => setData(d.data ?? []))
      .catch((e: ApiError) => {
        if (e.status !== 401) console.error(e);
      })
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function save(periode: string, valeur: number) {
    setSaving(periode);
    setError(null);
    try {
      const res = await fetch("/api/parametres/objectifs-individuels", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periode, valeurCartons: valeur }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? `Échec de la sauvegarde (${res.status}).`);
        return;
      }
      load();
    } catch {
      setError("Erreur réseau — la sauvegarde a échoué.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900 p-4 shadow-sm ring-1 ring-slate-100 dark:ring-slate-800">
      <button onClick={() => setOuvert((v) => !v)} className="mb-3 flex w-full items-center gap-2 text-left">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
          <Target size={16} />
        </span>
        <div className="flex-1">
          <h2 className="font-bold text-slate-800 dark:text-slate-100">Objectifs individuels</h2>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Appliqués à chaque commercial (distinct des objectifs par binôme ci-dessus)
          </p>
        </div>
        <ChevronDown size={16} className={`text-slate-400 transition-transform ${ouvert ? "" : "-rotate-90"}`} />
      </button>

      {ouvert && (loading ? (
        <p className="text-sm text-slate-400 dark:text-slate-500">Chargement...</p>
      ) : (
        <>
          {error && (
            <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-alert">{error}</p>
          )}
          <div className="grid grid-cols-3 gap-2">
            {data.map((o) => (
              <div key={o.periode}>
                <label className="mb-1 block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  {LABEL_PERIODE[o.periode]}
                </label>
                <ObjectifInput
                  defaultValue={o.valeurCartons}
                  saving={saving === o.periode}
                  onSave={(v) => save(o.periode, v)}
                />
              </div>
            ))}
          </div>
        </>
      ))}
    </div>
  );
}

// --- Durée de session ------------------------------------------------------

// --- Seuils des alertes automatiques ------------------------------------

const SEUILS_CONFIG: { cle: "joursCreditRetard" | "joursProspectARelancer" | "joursClientInactif" | "joursLivraisonProche"; label: string }[] = [
  { cle: "joursCreditRetard", label: "Crédit en retard après (jours)" },
  { cle: "joursProspectARelancer", label: "Prospect à relancer après (jours)" },
  { cle: "joursClientInactif", label: "Client inactif après (jours)" },
  { cle: "joursLivraisonProche", label: "Alerte livraison à venir (jours avant)" },
];

function SeuilsAlertesManager() {
  const [seuils, setSeuils] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [ouvert, setOuvert] = useState(true);

  function load() {
    setLoading(true);
    apiFetch<Record<string, number>>("/api/parametres/alertes-seuils")
      .then((d) => setSeuils(d))
      .catch((e: ApiError) => {
        if (e.status !== 401) console.error(e);
      })
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function save(cle: string, valeur: number) {
    setSaving(cle);
    await fetch("/api/parametres/alertes-seuils", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cle, valeur }),
    });
    setSaving(null);
    load();
  }

  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900 p-4 shadow-sm ring-1 ring-slate-100 dark:ring-slate-800">
      <button onClick={() => setOuvert((v) => !v)} className="mb-3 flex w-full items-center gap-2 text-left">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-600 text-white">
          <BellRing size={16} />
        </span>
        <div className="flex-1">
          <h2 className="font-bold text-slate-800 dark:text-slate-100">Seuils des alertes</h2>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Utilisés par la génération automatique — voir /admin/alertes
          </p>
        </div>
        <ChevronDown size={16} className={`text-slate-400 transition-transform ${ouvert ? "" : "-rotate-90"}`} />
      </button>

      {ouvert && (loading ? (
        <p className="text-sm text-slate-400 dark:text-slate-500">Chargement...</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {SEUILS_CONFIG.map(({ cle, label }) => (
            <div key={cle}>
              <label className="mb-1 block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {label}
              </label>
              <ObjectifInput
                defaultValue={seuils[cle] ?? 0}
                saving={saving === cle}
                onSave={(v) => save(cle, v)}
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function SessionDureeManager() {
  const [minutes, setMinutes] = useState(720);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ouvert, setOuvert] = useState(true);

  useEffect(() => {
    apiFetch<{ minutes?: number }>("/api/parametres/session-duree")
      .then((d) => setMinutes(d.minutes ?? 720))
      .catch((e: ApiError) => {
        if (e.status !== 401) console.error(e);
      })
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    setMessage(null);
    setError(null);
    const res = await fetch("/api/parametres/session-duree", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ minutes }),
    });
    if (res.ok) {
      setMessage("Enregistré — s'applique aux prochaines connexions.");
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Échec de l'enregistrement.");
    }
    setSaving(false);
  }

  const heuresEntieres = Math.floor(minutes / 60);
  const minutesRestantes = minutes % 60;

  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900 p-4 shadow-sm ring-1 ring-slate-100 dark:ring-slate-800">
      <button onClick={() => setOuvert((v) => !v)} className="mb-3 flex w-full items-center gap-2 text-left">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-700 text-white">
          <Clock size={16} />
        </span>
        <div className="flex-1">
          <h2 className="font-bold text-slate-800 dark:text-slate-100">Durée de session</h2>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Avant déconnexion automatique — s'applique aux prochaines connexions
          </p>
        </div>
        <ChevronDown size={16} className={`text-slate-400 transition-transform ${ouvert ? "" : "-rotate-90"}`} />
      </button>

      {ouvert && (loading ? (
        <p className="text-sm text-slate-400 dark:text-slate-500">Chargement...</p>
      ) : (
        <>
          <div className="mb-2 flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={0}
                value={heuresEntieres}
                onChange={(e) =>
                  setMinutes(Math.max(5, (Number(e.target.value) || 0) * 60 + minutesRestantes))
                }
                className="w-16 rounded-lg border border-slate-300 dark:border-slate-600 px-2 py-2 text-sm"
              />
              <span className="text-xs text-slate-500 dark:text-slate-400">h</span>
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={0}
                max={59}
                value={minutesRestantes}
                onChange={(e) =>
                  setMinutes(Math.max(5, heuresEntieres * 60 + (Number(e.target.value) || 0)))
                }
                className="w-16 rounded-lg border border-slate-300 dark:border-slate-600 px-2 py-2 text-sm"
              />
              <span className="text-xs text-slate-500 dark:text-slate-400">min</span>
            </div>
            <button
              onClick={save}
              disabled={saving}
              className="ml-auto rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              {saving ? "..." : "Enregistrer"}
            </button>
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500">Soit {minutes} minutes au total</p>
        </>
      ))}
      {message && <p className="mt-2 text-xs text-green-600">{message}</p>}
      {error && <p className="mt-2 text-xs text-alert">{error}</p>}
    </div>
  );
}

// --- Page principale -----------------------------------------------------

export default function ParametresPage() {
  return (
    <main>
      <AdminPageHeader
        title="Paramètres"
        subtitle="Types de boutique, produits, binômes, objectifs — utilisés dans le formulaire terrain"
      />

      <div className="grid gap-4 p-4 md:grid-cols-2 md:p-6">
        <SimpleEntityManager apiBase="/api/parametres/types" labelSingulier="Type de boutique" icon={Store} color="#1e40af" avecOrdre />
        <SimpleEntityManager apiBase="/api/parametres/binomes" labelSingulier="Binôme" icon={Users2} color="#0f766e" />
        <SimpleEntityManager apiBase="/api/parametres/agents-facturation" labelSingulier="Agent de facturation" labelPluriel="Agents de facturation" icon={Users2} color="#b45309" />
        <ProduitsManager />
        <div className="md:col-span-2">
          <ObjectifsManager />
        </div>
        <ObjectifsIndividuelsManager />
        <SessionDureeManager />
        <SeuilsAlertesManager />
        <div className="md:col-span-2">
          <TarifsManager />
        <ObjectifsTerritoireManager />
        </div>
      </div>
    </main>
  );
}
