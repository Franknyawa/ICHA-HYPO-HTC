"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, CreditCard } from "lucide-react";
import { compressImage } from "@/lib/utils/image";

type CreditDetail = { venteId: string; pointVenteNom: string; montantDu: number; dateVente: string };

export default function ProfilPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const [credits, setCredits] = useState<{ total: number; detail: CreditDetail[] } | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => setAvatarUrl(d.avatarUrl ?? null));
    fetch("/api/me/credits")
      .then((r) => r.json())
      .then((d) => setCredits(d));
  }, []);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarError(null);
    setAvatarUploading(true);

    try {
      const dataUrl = await compressImage(file, 400, 0.8);
      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl, uuidClient: crypto.randomUUID() }),
      });

      if (!uploadRes.ok) {
        setAvatarError("Échec de l'envoi de la photo.");
        return;
      }

      const { url } = await uploadRes.json();

      const saveRes = await fetch("/api/me/avatar", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarUrl: url }),
      });

      if (saveRes.ok) {
        setAvatarUrl(url);
      } else {
        setAvatarError("Échec de la mise à jour du profil.");
      }
    } catch {
      setAvatarError("Une erreur est survenue.");
    } finally {
      setAvatarUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    if (res.ok) {
      setSuccess(true);
      setTimeout(() => router.push("/dashboard"), 1200);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Échec de la mise à jour.");
    }
    setSaving(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm space-y-4">
        {/* Photo de profil */}
        <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="user"
            onChange={handleAvatarChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="relative mx-auto mb-3 flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-slate-100"
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="Photo de profil" className="h-full w-full object-cover" />
            ) : (
              <Camera size={24} className="text-slate-400" />
            )}
            {avatarUploading && (
              <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-xs font-medium text-white">
                ...
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-sm font-medium text-brand"
          >
            {avatarUrl ? "Changer la photo" : "Ajouter une photo"}
          </button>
          {avatarError && (
            <p className="mt-2 text-xs text-alert">{avatarError}</p>
          )}
        </div>

        {/* Crédits en cours — reste à payer sur les ventes à crédit */}
        {credits && credits.total > 0 && (
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-alert">
                <CreditCard size={16} />
              </span>
              <div>
                <p className="text-sm font-bold text-slate-800">Crédits en cours</p>
                <p className="text-xs text-slate-400">Reste à percevoir chez tes clients</p>
              </div>
            </div>
            <p className="mb-3 text-2xl font-extrabold text-alert">
              {credits.total.toLocaleString("fr-FR")} FCFA
            </p>
            <div className="space-y-2">
              {credits.detail.slice(0, 5).map((d) => (
                <div
                  key={d.venteId}
                  className="flex items-center justify-between rounded-lg bg-red-50/50 px-3 py-2 text-sm"
                >
                  <span className="text-slate-700">{d.pointVenteNom}</span>
                  <span className="font-semibold text-alert">
                    {d.montantDu.toLocaleString("fr-FR")} FCFA
                  </span>
                </div>
              ))}
              {credits.detail.length > 5 && (
                <p className="text-center text-xs text-slate-400">
                  + {credits.detail.length - 5} autre(s)
                </p>
              )}
            </div>
          </div>
        )}

        {/* Mot de passe */}
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl bg-white p-6 shadow-sm"
        >
          <h1 className="mb-4 text-lg font-semibold text-blue-800">
            Changer mon mot de passe
          </h1>

          {success ? (
            <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
              Mot de passe mis à jour.
            </p>
          ) : (
            <>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Mot de passe actuel
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
              />

              <label className="mb-1 block text-sm font-medium text-slate-700">
                Nouveau mot de passe
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
                className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
              />

              {error && (
                <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-alert">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-lg bg-blue-700 py-2.5 text-base font-medium text-white disabled:opacity-60"
              >
                {saving ? "..." : "Mettre à jour"}
              </button>
            </>
          )}
        </form>
      </div>
    </main>
  );
}
