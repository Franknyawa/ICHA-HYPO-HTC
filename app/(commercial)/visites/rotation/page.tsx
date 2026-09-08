"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  RefreshCw,
  Store,
  Camera,
  NotebookPen,
  CheckCircle2,
  Clock,
  ShoppingCart,
} from "lucide-react";
import { PointVenteSearch, type ResultatRecherche } from "@/components/commercial/PointVenteSearch";
import { compressImage } from "@/lib/utils/image";
import { queuePendingVisite } from "@/lib/offline/db";
import { syncPendingVisites } from "@/lib/offline/sync";

function uuid() {
  return crypto.randomUUID();
}

export default function RotationPage() {
  const router = useRouter();

  const [pointVente, setPointVente] = useState<ResultatRecherche | null>(null);
  const [now] = useState(() => new Date());

  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoUuid, setPhotoUuid] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);

  const [observation, setObservation] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [queuedOffline, setQueuedOffline] = useState(false);

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await compressImage(file, 1280, 0.7);
    setPhotoPreview(dataUrl);
    setPhotoUrl(null);

    const newUuid = uuid();
    setPhotoUuid(newUuid);

    if (navigator.onLine) {
      setPhotoUploading(true);
      try {
        const res = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dataUrl, uuidClient: newUuid }),
        });
        if (res.ok) {
          const data = await res.json();
          setPhotoUrl(data.url);
        }
      } catch {
        // repli sur le data URL
      } finally {
        setPhotoUploading(false);
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pointVente) return;
    setError(null);
    setSubmitting(true);

    const visiteUuid = uuid();
    const finalPhotoUrl = photoUrl ?? photoPreview;
    const payload = {
      uuidClient: visiteUuid,
      dateVisite: new Date().toISOString(),
      pointVenteId: pointVente.id,
      observation: observation || undefined,
      photos: finalPhotoUrl
        ? [{ uuidClient: photoUuid ?? uuid(), url: finalPhotoUrl, type: "ROTATION_SELFIE" }]
        : [],
    };

    if (!navigator.onLine) {
      await queuePendingVisite(visiteUuid, payload);
      setQueuedOffline(true);
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch("/api/visites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Échec de l'enregistrement.");
        return;
      }

      setSuccess(true);
    } catch {
      await queuePendingVisite(visiteUuid, payload);
      setQueuedOffline(true);
      syncPendingVisites();
    } finally {
      setSubmitting(false);
    }
  }

  if (success || queuedOffline) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="max-w-sm rounded-2xl bg-white px-8 py-10 text-center shadow-sm">
          <div
            className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full ${
              queuedOffline ? "bg-amber-100 text-amber-600" : "bg-green-100 text-green-600"
            }`}
          >
            {queuedOffline ? <Clock size={28} /> : <CheckCircle2 size={30} />}
          </div>
          <p className="mb-5 font-semibold text-slate-800">
            {queuedOffline ? "Données en attente de synchronisation" : "Visite enregistrée"}
          </p>
          <button
            onClick={() => router.push("/dashboard")}
            className="w-full rounded-xl bg-slate-100 py-3 text-sm font-medium text-slate-600"
          >
            Retour à l'accueil
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 pb-28">
      <div
        className="px-4 pb-6 pt-6 text-white"
        style={{ background: "linear-gradient(135deg, #4338ca 0%, #4f46e5 60%, #6366f1 100%)" }}
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15">
              <RefreshCw size={16} />
            </span>
            <p className="text-xs font-bold uppercase tracking-widest text-indigo-100">
              HYPO / HTC / ICHA IMPORT
            </p>
          </div>
          <Link href="/dashboard" className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15">
            <ArrowLeft size={16} />
          </Link>
        </div>
        <h1 className="text-2xl font-extrabold">Rotation et achalandage</h1>
      </div>

      <div className="-mt-3 space-y-4 px-4 pt-1">
        {!pointVente ? (
          <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
            <h2 className="mb-3 text-sm font-bold text-slate-700">Rechercher le point de vente</h2>
            <PointVenteSearch onSelect={setPointVente} />
          </section>
        ) : (
          <>
            <section className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700">
                <Store size={18} />
              </span>
              <div>
                <p className="font-bold text-slate-800">{pointVente.nom}</p>
                <p className="text-sm text-slate-500">
                  {pointVente.vendeur ?? "—"} · {pointVente.villeNom ?? "—"}
                </p>
              </div>
            </section>

            {/* Le client peut passer une commande à tout moment, avant même
                de finir le rapport — on l'emmène directement vers le
                formulaire de réassort avec ce point de vente déjà connu. */}
            <button
              onClick={() => router.push(`/visites/reassort?pointVenteId=${pointVente.id}`)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-700 py-3.5 text-sm font-bold text-white shadow-sm"
            >
              <ShoppingCart size={18} />
              {pointVente.nom} passe une nouvelle commande
            </button>

            <form onSubmit={handleSubmit} id="rotation-form" className="space-y-4">
              <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
                <div className="mb-3 flex items-center justify-between">
                  <FieldLabel>Photo avec le boutiquier</FieldLabel>
                  <span className="text-xs text-slate-400">
                    {now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  capture="user"
                  onChange={handlePhotoChange}
                  className="hidden"
                  id="photo-rotation-input"
                />
                {photoPreview ? (
                  <label
                    htmlFor="photo-rotation-input"
                    className="relative block w-full cursor-pointer overflow-hidden rounded-xl"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photoPreview} alt="Avec le boutiquier" className="h-48 w-full object-cover" />
                    <span className="absolute bottom-2 right-2 rounded-lg bg-black/60 px-2.5 py-1 text-xs font-medium text-white">
                      Reprendre
                    </span>
                    {photoUploading && (
                      <span className="absolute left-2 top-2 rounded-lg bg-black/60 px-2.5 py-1 text-xs font-medium text-white">
                        Envoi...
                      </span>
                    )}
                    {photoUrl && !photoUploading && (
                      <span className="absolute left-2 top-2 rounded-lg bg-green-600/90 px-2.5 py-1 text-xs font-medium text-white">
                        ✓ Envoyée
                      </span>
                    )}
                  </label>
                ) : (
                  <label
                    htmlFor="photo-rotation-input"
                    className="flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50/40 py-8 text-sm font-semibold text-indigo-700"
                  >
                    <Camera size={22} />
                    Prendre la photo
                  </label>
                )}
              </section>

              <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
                <div className="mb-2 flex items-center gap-2">
                  <NotebookPen size={16} className="text-indigo-700" />
                  <h2 className="text-sm font-bold text-slate-700">Rapport de visite</h2>
                </div>
                <textarea
                  value={observation}
                  onChange={(e) => setObservation(e.target.value)}
                  rows={5}
                  placeholder="État du rayon, achalandage, remarques..."
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-base"
                />
              </section>

              {error && <p className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-alert">{error}</p>}
            </form>
          </>
        )}
      </div>

      {pointVente && (
        <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white/95 p-3 backdrop-blur">
          <button
            type="submit"
            form="rotation-form"
            disabled={submitting}
            className="w-full rounded-xl py-3.5 text-base font-bold text-white shadow-md disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #4338ca, #6366f1)" }}
          >
            {submitting ? "Enregistrement..." : "Valider la visite"}
          </button>
        </div>
      )}
    </main>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-xs font-semibold uppercase tracking-wide text-slate-400">
      {children}
    </span>
  );
}
