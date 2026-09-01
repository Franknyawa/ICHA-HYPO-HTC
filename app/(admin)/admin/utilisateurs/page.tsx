"use client";

import { useEffect, useRef, useState } from "react";
import {
  KeyRound,
  UserPlus,
  Pencil,
  UserX,
  UserCheck,
  Camera,
  ShieldCheck,
  Users as UsersIcon,
} from "lucide-react";
import { compressImage } from "@/lib/utils/image";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

type UserRow = {
  id: string;
  username: string;
  nom: string;
  prenom: string;
  role: "ADMIN" | "COMMERCIAL";
  actif: boolean;
  avatarUrl: string | null;
  binome: { id: string; nom: string } | null;
};

type Binome = { id: string; nom: string };

function UserCard({
  u,
  onEdit,
  onReset,
  onToggle,
}: {
  u: UserRow;
  onEdit: (u: UserRow) => void;
  onReset: (u: UserRow) => void;
  onToggle: (u: UserRow) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-100">
      <div className="flex items-center gap-3">
        {u.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={u.avatarUrl}
            alt=""
            className="h-10 w-10 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-400">
            {u.prenom[0]}
            {u.nom[0]}
          </div>
        )}
        <div>
          <p className="font-medium text-slate-800">
            {u.prenom} {u.nom}
            {!u.actif && (
              <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                Désactivé
              </span>
            )}
          </p>
          <p className="text-xs text-slate-500">
            {u.username}
            {u.binome ? ` · ${u.binome.nom}` : ""}
          </p>
        </div>
      </div>
      <div className="flex gap-1.5">
        <button
          onClick={() => onEdit(u)}
          title="Modifier"
          className="flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-sm font-medium text-slate-600"
        >
          <Pencil size={14} />
        </button>
        <button
          onClick={() => onReset(u)}
          title="Réinitialiser le mot de passe"
          className="flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-sm font-medium text-slate-600"
        >
          <KeyRound size={14} />
        </button>
        <button
          onClick={() => onToggle(u)}
          title={u.actif ? "Désactiver" : "Réactiver"}
          className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-medium ${
            u.actif ? "bg-red-50 text-alert" : "bg-green-50 text-green-700"
          }`}
        >
          {u.actif ? <UserX size={14} /> : <UserCheck size={14} />}
        </button>
      </div>
    </div>
  );
}

export default function UtilisateursPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [binomes, setBinomes] = useState<Binome[]>([]);
  const [loading, setLoading] = useState(true);

  const [resetTarget, setResetTarget] = useState<UserRow | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const [editTarget, setEditTarget] = useState<UserRow | null>(null);
  const [editForm, setEditForm] = useState({
    nom: "",
    prenom: "",
    role: "COMMERCIAL" as "ADMIN" | "COMMERCIAL",
    binomeId: "",
    avatarUrl: "" as string | null,
  });
  const [avatarUploading, setAvatarUploading] = useState(false);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    username: "",
    password: "",
    nom: "",
    prenom: "",
    role: "COMMERCIAL" as "ADMIN" | "COMMERCIAL",
    binomeId: "",
  });

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function loadUsers() {
    fetch("/api/users")
      .then((r) => r.json())
      .then((d) => setUsers(d.data ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadUsers();
    fetch("/api/referentiels")
      .then((r) => r.json())
      .then((d) => setBinomes(d.binomes ?? []));
  }, []);

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    if (!resetTarget) return;
    setSaving(true);
    setError(null);

    const res = await fetch(`/api/users/${resetTarget.id}/password`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPassword }),
    });

    if (res.ok) {
      setMessage(`Mot de passe mis à jour pour ${resetTarget.prenom} ${resetTarget.nom}.`);
      setResetTarget(null);
      setNewPassword("");
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Échec de la mise à jour.");
    }
    setSaving(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createForm),
    });

    if (res.ok) {
      setMessage(`Compte créé pour ${createForm.prenom} ${createForm.nom} (${createForm.username}).`);
      setShowCreate(false);
      setCreateForm({
        username: "",
        password: "",
        nom: "",
        prenom: "",
        role: "COMMERCIAL",
        binomeId: "",
      });
      loadUsers();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Échec de la création.");
    }
    setSaving(false);
  }

  function openEdit(u: UserRow) {
    setEditTarget(u);
    setEditForm({
      nom: u.nom,
      prenom: u.prenom,
      role: u.role,
      binomeId: u.binome?.id ?? "",
      avatarUrl: u.avatarUrl,
    });
    setError(null);
  }

  async function handleEditAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    setError(null);

    try {
      const dataUrl = await compressImage(file, 400, 0.8);
      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl, uuidClient: crypto.randomUUID() }),
      });

      if (!uploadRes.ok) {
        setError("Échec de l'envoi de la photo.");
        return;
      }

      const { url } = await uploadRes.json();
      setEditForm((f) => ({ ...f, avatarUrl: url }));
    } catch {
      setError("Une erreur est survenue lors de l'envoi de la photo.");
    } finally {
      setAvatarUploading(false);
    }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editTarget) return;
    setSaving(true);
    setError(null);

    const res = await fetch(`/api/users/${editTarget.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });

    if (res.ok) {
      setMessage(`Compte de ${editForm.prenom} ${editForm.nom} mis à jour.`);
      setEditTarget(null);
      loadUsers();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Échec de la mise à jour.");
    }
    setSaving(false);
  }

  async function toggleActif(u: UserRow) {
    const action = u.actif ? "désactiver" : "réactiver";
    if (!confirm(`Confirmer : ${action} le compte de ${u.prenom} ${u.nom} ?`)) return;

    const res = await fetch(`/api/users/${u.id}`, {
      method: u.actif ? "DELETE" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: u.actif ? undefined : JSON.stringify({ actif: true }),
    });

    if (res.ok) {
      setMessage(`Compte de ${u.prenom} ${u.nom} ${u.actif ? "désactivé" : "réactivé"}.`);
      loadUsers();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Échec de l'opération.");
    }
  }

  const admins = users.filter((u) => u.role === "ADMIN");
  const commerciaux = users.filter((u) => u.role === "COMMERCIAL");

  // Regroupement des commerciaux par binôme — plus lisible qu'une liste
  // plate quand il y en a plusieurs.
  const commerciauxParBinome = new Map<string, UserRow[]>();
  const sansBinome: UserRow[] = [];
  for (const u of commerciaux) {
    if (u.binome) {
      const arr = commerciauxParBinome.get(u.binome.nom) ?? [];
      arr.push(u);
      commerciauxParBinome.set(u.binome.nom, arr);
    } else {
      sansBinome.push(u);
    }
  }

  return (
    <main className="pb-10">
      <AdminPageHeader
        title="Utilisateurs"
        action={
          <button
            onClick={() => {
              setShowCreate(true);
              setError(null);
            }}
            className="flex items-center gap-1.5 rounded-xl bg-brand px-3 py-2 text-sm font-semibold text-white"
          >
            <UserPlus size={16} />
            Nouveau
          </button>
        }
      />

      <div className="px-4 pt-4 md:px-6">
        {message && (
          <p className="mb-4 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800">
            {message}
          </p>
        )}

        {loading ? (
          <p className="text-sm text-slate-500">Chargement...</p>
        ) : (
          <div className="space-y-6">
            {/* Administrateurs */}
            <section>
              <div className="mb-2 flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white">
                  <ShieldCheck size={15} />
                </span>
                <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
                  Administrateurs
                </h2>
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-600">
                  {admins.length}
                </span>
              </div>
              <div className="space-y-2">
                {admins.map((u) => (
                  <UserCard
                    key={u.id}
                    u={u}
                    onEdit={openEdit}
                    onReset={(u) => {
                      setResetTarget(u);
                      setNewPassword("");
                      setError(null);
                    }}
                    onToggle={toggleActif}
                  />
                ))}
                {admins.length === 0 && (
                  <p className="text-sm text-slate-400">Aucun administrateur.</p>
                )}
              </div>
            </section>

            {/* Commerciaux, groupés par binôme */}
            <section>
              <div className="mb-2 flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-700 text-white">
                  <UsersIcon size={15} />
                </span>
                <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
                  Commerciaux
                </h2>
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-600">
                  {commerciaux.length}
                </span>
              </div>

              <div className="space-y-4">
                {[...commerciauxParBinome.entries()].map(([binomeNom, membres]) => (
                  <div key={binomeNom}>
                    <p className="mb-1.5 text-xs font-semibold text-teal-700">
                      {binomeNom}
                    </p>
                    <div className="space-y-2">
                      {membres.map((u) => (
                        <UserCard
                          key={u.id}
                          u={u}
                          onEdit={openEdit}
                          onReset={(u) => {
                            setResetTarget(u);
                            setNewPassword("");
                            setError(null);
                          }}
                          onToggle={toggleActif}
                        />
                      ))}
                    </div>
                  </div>
                ))}

                {sansBinome.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-xs font-semibold text-slate-400">
                      Sans binôme
                    </p>
                    <div className="space-y-2">
                      {sansBinome.map((u) => (
                        <UserCard
                          key={u.id}
                          u={u}
                          onEdit={openEdit}
                          onReset={(u) => {
                            setResetTarget(u);
                            setNewPassword("");
                            setError(null);
                          }}
                          onToggle={toggleActif}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {commerciaux.length === 0 && (
                  <p className="text-sm text-slate-400">Aucun commercial.</p>
                )}
              </div>
            </section>
          </div>
        )}
      </div>

      {/* Modal réinitialisation mot de passe */}
      {resetTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={handleReset}
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-lg"
          >
            <h2 className="mb-1 font-semibold text-slate-800">
              Nouveau mot de passe
            </h2>
            <p className="mb-4 text-sm text-slate-500">
              Pour {resetTarget.prenom} {resetTarget.nom} ({resetTarget.username})
            </p>
            <input
              type="text"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Nouveau mot de passe (min. 6 caractères)"
              required
              minLength={6}
              className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
            />
            {error && (
              <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-alert">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setResetTarget(null)}
                className="flex-1 rounded-lg bg-slate-100 py-2 text-sm font-medium text-slate-600"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 rounded-lg bg-blue-700 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {saving ? "..." : "Valider"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal modification de compte */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={handleEdit}
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-lg"
          >
            <h2 className="mb-4 font-semibold text-slate-800">
              Modifier le compte ({editTarget.username})
            </h2>

            <input
              ref={editFileInputRef}
              type="file"
              accept="image/*"
              onChange={handleEditAvatarChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => editFileInputRef.current?.click()}
              className="relative mx-auto mb-4 flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-slate-100"
            >
              {editForm.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={editForm.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <Camera size={18} className="text-slate-400" />
              )}
              {avatarUploading && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-[10px] text-white">
                  ...
                </span>
              )}
            </button>

            <div className="mb-3 grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Prénom"
                value={editForm.prenom}
                onChange={(e) => setEditForm((f) => ({ ...f, prenom: e.target.value }))}
                required
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                type="text"
                placeholder="Nom"
                value={editForm.nom}
                onChange={(e) => setEditForm((f) => ({ ...f, nom: e.target.value }))}
                required
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <select
              value={editForm.role}
              onChange={(e) =>
                setEditForm((f) => ({ ...f, role: e.target.value as "ADMIN" | "COMMERCIAL" }))
              }
              className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="COMMERCIAL">Commercial</option>
              <option value="ADMIN">Administrateur</option>
            </select>

            {editForm.role === "COMMERCIAL" && (
              <select
                value={editForm.binomeId}
                onChange={(e) => setEditForm((f) => ({ ...f, binomeId: e.target.value }))}
                className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Binôme (optionnel)...</option>
                {binomes.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.nom}
                  </option>
                ))}
              </select>
            )}

            {error && (
              <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-alert">
                {error}
              </p>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEditTarget(null)}
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

      {/* Modal création de compte */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={handleCreate}
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-lg"
          >
            <h2 className="mb-4 font-semibold text-slate-800">Nouveau compte</h2>

            <div className="mb-3 grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Prénom"
                value={createForm.prenom}
                onChange={(e) => setCreateForm((f) => ({ ...f, prenom: e.target.value }))}
                required
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                type="text"
                placeholder="Nom"
                value={createForm.nom}
                onChange={(e) => setCreateForm((f) => ({ ...f, nom: e.target.value }))}
                required
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <input
              type="text"
              placeholder="Identifiant (ex : commercial4)"
              value={createForm.username}
              onChange={(e) =>
                setCreateForm((f) => ({
                  ...f,
                  username: e.target.value.toLowerCase().replace(/\s+/g, ""),
                }))
              }
              required
              className="mb-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <p className="mb-3 text-xs text-slate-400">
              Sans espace ni accent — ex : commercial2
            </p>

            <input
              type="text"
              placeholder="Mot de passe / code personnel initial"
              value={createForm.password}
              onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
              required
              minLength={6}
              className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />

            <select
              value={createForm.role}
              onChange={(e) =>
                setCreateForm((f) => ({ ...f, role: e.target.value as "ADMIN" | "COMMERCIAL" }))
              }
              className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="COMMERCIAL">Commercial</option>
              <option value="ADMIN">Administrateur</option>
            </select>

            {createForm.role === "COMMERCIAL" && (
              <select
                value={createForm.binomeId}
                onChange={(e) => setCreateForm((f) => ({ ...f, binomeId: e.target.value }))}
                className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Binôme (optionnel)...</option>
                {binomes.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.nom}
                  </option>
                ))}
              </select>
            )}

            {error && (
              <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-alert">
                {error}
              </p>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="flex-1 rounded-lg bg-slate-100 py-2 text-sm font-medium text-slate-600"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 rounded-lg bg-blue-700 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {saving ? "..." : "Créer"}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
