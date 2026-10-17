"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, CheckCircle2, Clock, ShoppingCart, Search, MessageSquareText } from "lucide-react";
import { PointVenteSearch, type ResultatRecherche } from "@/components/commercial/PointVenteSearch";
import { compressImage } from "@/lib/utils/image";
import { queuePendingVisite } from "@/lib/offline/db";
import { syncPendingVisites } from "@/lib/offline/sync";
import {
  EnTeteFormulaire,
  FOND_PAGE,
  Carte,
  Champ,
  ZoneTexte,
  BarreAction,
  BoutonPrincipal,
} from "@/components/commercial/form-ui";

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
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4 dark:bg-slate-950">
        <div className="w-full max-w-sm rounded-2xl border border-slate-200/80 bg-white px-8 py-10 text-center dark:border-slate-800 dark:bg-slate-900">
          <div
            className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full ${
              queuedOffline ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"
            }`}
          >
            {queuedOffline ? <Clock size={28} /> : <CheckCircle2 size={30} />}
          </div>
          <p className="mb-6 font-semibold text-slate-900 dark:text-slate-100">
            {queuedOffline ? "Données en attente de synchronisation" : "Visite enregistrée"}
          </p>
          <BoutonPrincipal type="button" onClick={() => router.push("/dashboard")}>
            Retour à l&apos;accueil
          </BoutonPrincipal>
        </div>
      </main>
    );
  }

  return (
    <main className={`${FOND_PAGE} pb-28`}>
      <EnTeteFormulaire titre="Rotation et achalandage" sousTitre="Visite de suivi" />

      <div className="mx-auto max-w-xl space-y-4 px-4 pt-4">
        {!pointVente ? (
          <Carte titre="Rechercher le point de vente" icone={Search} accent="bleu">
            <PointVenteSearch onSelect={setPointVente} />
          </Carte>
        ) : (
          <>
            <section className="rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <p className="font-semibold text-slate-900 dark:text-slate-100">{pointVente.nom}</p>
              <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                {pointVente.vendeur ?? "—"} · {pointVente.villeNom ?? "—"}
              </p>
            </section>

            {/* Le client peut passer une commande à tout moment, avant même
                de finir le rapport — on l'emmène directement vers le
                formulaire de réassort avec ce point de vente déjà connu. */}
            <button
              onClick={() => router.push(`/visites/reassort?pointVenteId=${pointVente.id}`)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#1e3a8a] bg-white py-3.5 text-sm font-semibold text-[#1e3a8a] dark:bg-slate-900 dark:text-blue-300"
            >
              <ShoppingCart size={18} />
              {pointVente.nom} passe une nouvelle commande
            </button>

            <form onSubmit={handleSubmit} id="rotation-form" className="space-y-4">
              <Carte titre="Photo avec le boutiquier" icone={Camera} accent="vert">
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
                      <span className="absolute left-2 top-2 rounded-lg bg-emerald-600/90 px-2.5 py-1 text-xs font-medium text-white">
                        Envoyée
                      </span>
                    )}
                  </label>
                ) : (
                  <label
                    htmlFor="photo-rotation-input"
                    className="flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 py-9 text-sm font-medium text-slate-500 hover:border-slate-400 dark:border-slate-700 dark:text-slate-400"
                  >
                    <Camera size={22} />
                    Prendre la photo
                  </label>
                )}
                <p suppressHydrationWarning className="text-xs text-slate-500 dark:text-slate-400">
                  Heure : {now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </Carte>

              <Carte titre="Rapport de visite" icone={MessageSquareText} accent="violet">
                <Champ label="Observations">
                  <ZoneTexte
                    value={observation}
                    onChange={(e) => setObservation(e.target.value)}
                    rows={5}
                    placeholder="État du rayon, achalandage, remarques..."
                  />
                </Champ>
              </Carte>

              {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-alert">{error}</p>}
            </form>
          </>
        )}
      </div>

      {pointVente && (
        <BarreAction>
          <BoutonPrincipal form="rotation-form" disabled={submitting}>
            {submitting ? "Enregistrement..." : "Valider la visite"}
          </BoutonPrincipal>
        </BarreAction>
      )}
    </main>
  );
}
