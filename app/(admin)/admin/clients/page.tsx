"use client";

import { useEffect, useState } from "react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { apiFetch, ApiError } from "@/lib/client/apiFetch";
import {
  Search,
  Phone,
  MapPin,
  X,
  AlertTriangle,
  RefreshCw,
  Pencil,
  UserCheck,
  UserX,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

type ClientRow = {
  id: string;
  nom: string;
  telephone: string | null;
  statut: "ACTIF" | "INACTIF";
  pointVente: { id: string; nom: string };
};

type ClientDetail = {
  id: string;
  nom: string;
  telephone: string | null;
  statut: "ACTIF" | "INACTIF";
  createdAt: string;
  pointVente: {
    nom: string;
    vendeur: string | null;
    ville: { nom: string } | null;
    quartier: { nom: string } | null;
    type: { nom: string } | null;
  };
  creditTotal: number;
  ventes: {
    id: string;
    montantTotal: number;
    montantPaye: number;
    montantDu: number;
    createdAt: string;
    commercial: { nom: string; prenom: string };
  }[];
  commandes: {
    id: string;
    statut: "EN_ATTENTE" | "EN_LIVRAISON" | "LIVREE" | "ANNULEE";
    dateCommande: string;
    dateLivraisonPrevue: string | null;
  }[];
};

const LABEL_STATUT_COMMANDE: Record<string, string> = {
  EN_ATTENTE: "En attente",
  EN_LIVRAISON: "En livraison",
  LIVREE: "Livrée",
  ANNULEE: "Annulée",
};

export default function ClientsPage() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statutFiltre, setStatutFiltre] = useState<"" | "ACTIF" | "INACTIF">("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [selectedId, setSelectedId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setLoadError(null);
    const params = new URLSearchParams({ page: String(page), pageSize: "20" });
    if (search.trim()) params.set("search", search.trim());
    if (statutFiltre) params.set("statut", statutFiltre);

    apiFetch<{ data: ClientRow[]; pagination: { totalPages: number } }>(
      `/api/clients?${params.toString()}`
    )
      .then((d) => {
        setClients(d.data ?? []);
        setTotalPages(d.pagination?.totalPages ?? 1);
      })
      .catch((e: ApiError) => {
        if (e.status !== 401) setLoadError(e.message);
      })
      .finally(() => setLoading(false));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [page, statutFiltre]);

  // Recherche : on repart en page 1 et on relance manuellement (pas de
  // debounce serveur — évite une requête par frappe, l'utilisateur valide
  // avec Entrée ou le bouton).
  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    load();
  }

  return (
    <main>
      <AdminPageHeader title="Clients" subtitle="Recherche, fiche détaillée et suivi des crédits" />

      <div className="p-4 md:p-6">
        <form onSubmit={onSearchSubmit} className="mb-4 flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par nom ou téléphone..."
              className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 py-2.5 pl-9 pr-3 text-sm"
            />
          </div>
          <select
            value={statutFiltre}
            onChange={(e) => {
              setStatutFiltre(e.target.value as "" | "ACTIF" | "INACTIF");
              setPage(1);
            }}
            className="rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm"
          >
            <option value="">Tous statuts</option>
            <option value="ACTIF">Actifs</option>
            <option value="INACTIF">Inactifs</option>
          </select>
          <button
            type="submit"
            className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-medium text-white"
          >
            Rechercher
          </button>
        </form>

        {loading ? (
          <p className="text-sm text-slate-400 dark:text-slate-500">Chargement...</p>
        ) : loadError ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-white dark:bg-slate-900 p-8 text-center shadow-sm ring-1 ring-slate-100 dark:ring-slate-800">
            <AlertTriangle size={22} className="text-alert" />
            <p className="text-sm text-slate-600 dark:text-slate-300">{loadError}</p>
            <button
              onClick={load}
              className="flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white"
            >
              <RefreshCw size={14} />
              Réessayer
            </button>
          </div>
        ) : clients.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500">Aucun client trouvé.</p>
        ) : (
          <>
            <div className="overflow-hidden rounded-2xl bg-white dark:bg-slate-900 shadow-sm ring-1 ring-slate-100 dark:ring-slate-800">
              {clients.map((c, i) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={`flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 ${
                    i > 0 ? "border-t border-slate-100 dark:border-slate-800" : ""
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-slate-800 dark:text-slate-100">{c.nom}</p>
                      {c.statut === "INACTIF" && (
                        <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                          Inactif
                        </span>
                      )}
                    </div>
                    <p className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
                      <MapPin size={11} />
                      {c.pointVente.nom}
                    </p>
                  </div>
                  {c.telephone && (
                    <span className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
                      <Phone size={12} />
                      {c.telephone}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="mt-3 flex items-center justify-center gap-3">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700 disabled:opacity-40"
                >
                  <ChevronLeft size={15} />
                </button>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Page {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700 disabled:opacity-40"
                >
                  <ChevronRight size={15} />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {selectedId && (
        <ClientDetailModal
          id={selectedId}
          onClose={() => setSelectedId(null)}
          onUpdated={load}
        />
      )}
    </main>
  );
}

function ClientDetailModal({
  id,
  onClose,
  onUpdated,
}: {
  id: string;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    apiFetch<ClientDetail>(`/api/clients/${id}`)
      .then((d) => {
        setClient(d);
        setNom(d.nom);
        setTelephone(d.telephone ?? "");
      })
      .catch((e: ApiError) => {
        if (e.status !== 401) setError(e.message);
      })
      .finally(() => setLoading(false));
  }

  useEffect(load, [id]);

  async function enregistrer() {
    setSaving(true);
    setSaveError(null);
    const res = await fetch(`/api/clients/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nom, telephone: telephone || null }),
    });
    setSaving(false);
    if (res.ok) {
      setEditing(false);
      load();
      onUpdated();
    } else {
      const d = await res.json().catch(() => ({}));
      setSaveError(d.error ?? "Échec de l'enregistrement.");
    }
  }

  async function toggleStatut() {
    if (!client) return;
    setSaving(true);
    const nouveauStatut = client.statut === "ACTIF" ? "INACTIF" : "ACTIF";
    const res = await fetch(`/api/clients/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statut: nouveauStatut }),
    });
    setSaving(false);
    if (res.ok) {
      load();
      onUpdated();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 shadow-lg">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-5 py-4">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">Fiche client</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
            <X size={18} />
          </button>
        </div>

        <div className="p-5">
          {loading ? (
            <p className="text-sm text-slate-400 dark:text-slate-500">Chargement...</p>
          ) : error ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <AlertTriangle size={20} className="text-alert" />
              <p className="text-sm text-slate-600 dark:text-slate-300">{error}</p>
              <button onClick={load} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white">
                Réessayer
              </button>
            </div>
          ) : client ? (
            <>
              {/* Identité + édition */}
              <div className="mb-4 flex items-start justify-between">
                <div className="flex-1">
                  {editing ? (
                    <div className="space-y-2">
                      <input
                        value={nom}
                        onChange={(e) => setNom(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm"
                        placeholder="Nom"
                      />
                      <input
                        value={telephone}
                        onChange={(e) => setTelephone(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm"
                        placeholder="Téléphone"
                      />
                      {saveError && <p className="text-xs text-alert">{saveError}</p>}
                      <div className="flex gap-2">
                        <button
                          onClick={enregistrer}
                          disabled={saving}
                          className="rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
                        >
                          {saving ? "..." : "Enregistrer"}
                        </button>
                        <button
                          onClick={() => setEditing(false)}
                          className="rounded-lg bg-slate-100 dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300"
                        >
                          Annuler
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <p className="text-lg font-bold text-slate-800 dark:text-slate-100">{client.nom}</p>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            client.statut === "ACTIF"
                              ? "bg-green-50 text-green-700"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                          }`}
                        >
                          {client.statut === "ACTIF" ? "Actif" : "Inactif"}
                        </span>
                      </div>
                      {client.telephone && (
                        <a
                          href={`https://wa.me/${client.telephone.replace(/[^\d]/g, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-sm text-green-600"
                        >
                          <Phone size={13} />
                          {client.telephone}
                        </a>
                      )}
                      <p className="mt-1 flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
                        <MapPin size={11} />
                        {client.pointVente.nom}
                        {client.pointVente.quartier ? ` — ${client.pointVente.quartier.nom}` : ""}
                        {client.pointVente.ville ? `, ${client.pointVente.ville.nom}` : ""}
                      </p>
                    </>
                  )}
                </div>
                {!editing && (
                  <div className="flex shrink-0 gap-1.5">
                    <button
                      onClick={() => setEditing(true)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                      title="Modifier"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={toggleStatut}
                      disabled={saving}
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 disabled:opacity-50"
                      title={client.statut === "ACTIF" ? "Désactiver" : "Réactiver"}
                    >
                      {client.statut === "ACTIF" ? <UserX size={14} /> : <UserCheck size={14} />}
                    </button>
                  </div>
                )}
              </div>

              {/* Crédit en cours */}
              {client.creditTotal > 0 && (
                <div className="mb-4 rounded-xl bg-red-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-alert">Crédit en cours</p>
                  <p className="text-lg font-bold text-alert">{client.creditTotal.toLocaleString("fr-FR")} FCFA</p>
                </div>
              )}

              {/* Ventes */}
              <div className="mb-4">
                <h4 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Ventes ({client.ventes.length})
                </h4>
                {client.ventes.length === 0 ? (
                  <p className="text-sm text-slate-400 dark:text-slate-500">Aucune vente.</p>
                ) : (
                  <div className="space-y-1.5">
                    {client.ventes.map((v) => (
                      <div key={v.id} className="rounded-lg bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-700 dark:text-slate-300">
                            {new Date(v.createdAt).toLocaleDateString("fr-FR")} — {v.commercial.prenom} {v.commercial.nom}
                          </span>
                          <span className="font-semibold text-slate-800 dark:text-slate-100">
                            {v.montantTotal.toLocaleString("fr-FR")} FCFA
                          </span>
                        </div>
                        {v.montantDu > 0 && (
                          <span className="text-xs font-medium text-alert">
                            {v.montantDu.toLocaleString("fr-FR")} FCFA dû
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Commandes */}
              <div>
                <h4 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Commandes ({client.commandes.length})
                </h4>
                {client.commandes.length === 0 ? (
                  <p className="text-sm text-slate-400 dark:text-slate-500">Aucune commande.</p>
                ) : (
                  <div className="space-y-1.5">
                    {client.commandes.map((c) => (
                      <div key={c.id} className="flex items-center justify-between rounded-lg bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm">
                        <span className="text-slate-700 dark:text-slate-300">
                          {new Date(c.dateCommande).toLocaleDateString("fr-FR")}
                        </span>
                        <span
                          className={`text-xs font-semibold ${
                            c.statut === "LIVREE"
                              ? "text-green-700"
                              : c.statut === "ANNULEE"
                              ? "text-slate-400"
                              : c.statut === "EN_LIVRAISON"
                              ? "text-brand"
                              : "text-amber-700"
                          }`}
                        >
                          {LABEL_STATUT_COMMANDE[c.statut]}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
