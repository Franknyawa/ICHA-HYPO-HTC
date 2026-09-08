"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Package,
  Wallet,
  CheckCircle2,
  Clock,
  Droplet,
  Sparkles,
  Download,
  Store,
  NotebookPen,
} from "lucide-react";
import { PointVenteSearch, type ResultatRecherche } from "@/components/commercial/PointVenteSearch";
import { queuePendingVisite } from "@/lib/offline/db";
import { syncPendingVisites } from "@/lib/offline/sync";
import { genererFacturePdf } from "@/lib/utils/facture-pdf";

function uuid() {
  return crypto.randomUUID();
}

type Produit = {
  id: string;
  code: string;
  nom: string;
  prixSachet: number;
  prixFilet: number | null;
  prixCarton: number;
};

type Quantites = Record<string, { sachets: number; filets: number; cartons: number }>;

function ReassortContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pointVenteIdPrefill = searchParams.get("pointVenteId");

  const [pointVente, setPointVente] = useState<ResultatRecherche | null>(null);
  const [chargementPrefill, setChargementPrefill] = useState(Boolean(pointVenteIdPrefill));
  const [session, setSession] = useState<{ nom: string; prenom: string } | null>(null);

  const [produits, setProduits] = useState<Produit[]>([]);
  const [quantites, setQuantites] = useState<Quantites>({});

  const [montantEncaisse, setMontantEncaisse] = useState(0);
  const [montantRecu, setMontantRecu] = useState(0);
  const [mobileMoneyConfirme, setMobileMoneyConfirme] = useState(false);
  const [modePaiement, setModePaiement] = useState<
    "ESPECES" | "MOBILE_MONEY" | "CREDIT_PARTIEL" | "CREDIT_TOTAL"
  >("ESPECES");
  const [dateLivraison, setDateLivraison] = useState("");
  const [observation, setObservation] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [queuedOffline, setQueuedOffline] = useState(false);
  const [facturePdfLoading, setFacturePdfLoading] = useState(false);

  useEffect(() => {
    fetch("/api/referentiels")
      .then((r) => r.json())
      .then((d) => setProduits(d.produits ?? []));
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => setSession(d));

    if (pointVenteIdPrefill) {
      fetch(`/api/points-vente/${pointVenteIdPrefill}`)
        .then((r) => r.json())
        .then((d) => {
          setPointVente({
            id: d.id,
            nom: d.nom,
            vendeur: d.vendeur,
            telephoneVendeur: d.telephoneVendeur,
            villeNom: d.ville?.nom ?? null,
            quartierNom: d.quartier?.nom ?? null,
            photoUrl: null,
          });
        })
        .finally(() => setChargementPrefill(false));
    }
  }, [pointVenteIdPrefill]);

  function updateQty(code: string, field: "sachets" | "filets" | "cartons", value: number) {
    setQuantites((prev) => ({
      ...prev,
      [code]: { sachets: 0, filets: 0, cartons: 0, ...prev[code], [field]: value },
    }));
  }

  const lignes = produits
    .map((p) => {
      const q = quantites[p.code] ?? { sachets: 0, filets: 0, cartons: 0 };
      if (q.sachets === 0 && q.filets === 0 && q.cartons === 0) return null;
      return { produit: p, ...q };
    })
    .filter(Boolean) as { produit: Produit; sachets: number; filets: number; cartons: number }[];

  const sousTotal = (l: { produit: Produit; sachets: number; filets: number; cartons: number }) =>
    l.sachets * l.produit.prixSachet +
    l.filets * (l.produit.prixFilet ?? 0) +
    l.cartons * l.produit.prixCarton;

  const montantCalcule = lignes.reduce((s, l) => s + sousTotal(l), 0);

  const resteAPayer =
    modePaiement === "CREDIT_PARTIEL"
      ? Math.max(0, montantCalcule - montantRecu)
      : modePaiement === "CREDIT_TOTAL"
      ? montantCalcule
      : 0;

  const montantEffectivementRecu =
    modePaiement === "ESPECES"
      ? montantCalcule
      : modePaiement === "MOBILE_MONEY"
      ? mobileMoneyConfirme
        ? montantCalcule
        : 0
      : modePaiement === "CREDIT_PARTIEL"
      ? montantRecu
      : 0;

  useEffect(() => {
    setMontantEncaisse(montantEffectivementRecu);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [montantEffectivementRecu]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pointVente) return;
    setError(null);
    setSubmitting(true);

    const visiteUuid = uuid();
    const payload = {
      uuidClient: visiteUuid,
      dateVisite: new Date().toISOString(),
      pointVenteId: pointVente.id,
      ...(lignes.length > 0
        ? {
            commande: {
              uuidClient: uuid(),
              lignes: lignes.map((l) => ({
                produitCode: l.produit.code,
                nbSachets: l.sachets,
                nbFilets: l.filets,
                nbCartons: l.cartons,
              })),
              dateLivraisonPrevue: dateLivraison
                ? new Date(dateLivraison).toISOString()
                : undefined,
            },
          }
        : {}),
      observation: observation || undefined,
      photos: [],
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

  async function telechargerFacture() {
    if (!pointVente) return;
    setFacturePdfLoading(true);
    try {
      await genererFacturePdf({
        numero: new Date().toISOString().slice(0, 10).replace(/-/g, ""),
        date: new Date(),
        pointVenteNom: pointVente.nom,
        villeNom: pointVente.villeNom,
        commercialNom: session ? `${session.prenom} ${session.nom}` : "—",
        lignes: lignes.map((l) => ({
          produitCode: l.produit.code,
          nbSachets: l.sachets,
          nbFilets: l.filets,
          nbCartons: l.cartons,
        })),
        montantTotal: montantCalcule,
        montantRecu: montantEffectivementRecu,
        resteAPayer: resteAPayer > 0 ? resteAPayer : undefined,
      });
    } finally {
      setFacturePdfLoading(false);
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
          <p className="mb-4 font-semibold text-slate-800">
            {queuedOffline ? "Données en attente de synchronisation" : "Réassort enregistré"}
          </p>
          {success && lignes.length > 0 && (
            <button
              onClick={telechargerFacture}
              disabled={facturePdfLoading}
              className="mb-2 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              <Download size={16} />
              {facturePdfLoading ? "Génération..." : "Télécharger la facture"}
            </button>
          )}
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
        style={{ background: "linear-gradient(135deg, #0f766e 0%, #0d9488 60%, #14b8a6 100%)" }}
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15">
              <Package size={16} />
            </span>
            <p className="text-xs font-bold uppercase tracking-widest text-teal-100">
              HYPO / HTC / ICHA IMPORT
            </p>
          </div>
          <Link href="/dashboard" className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15">
            <ArrowLeft size={16} />
          </Link>
        </div>
        <h1 className="text-2xl font-extrabold">Visite de réassort</h1>
      </div>

      <div className="-mt-3 space-y-4 px-4 pt-1">
        {chargementPrefill ? (
          <p className="text-sm text-slate-400">Chargement du point de vente...</p>
        ) : !pointVente ? (
          <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
            <h2 className="mb-3 text-sm font-bold text-slate-700">Rechercher le point de vente</h2>
            <PointVenteSearch onSelect={setPointVente} />
          </section>
        ) : (
          <>
            <section className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                <Store size={18} />
              </span>
              <div>
                <p className="font-bold text-slate-800">{pointVente.nom}</p>
                <p className="text-sm text-slate-500">
                  {pointVente.vendeur ?? "—"} · {pointVente.villeNom ?? "—"}
                </p>
              </div>
            </section>

            <form onSubmit={handleSubmit} id="reassort-form" className="space-y-4">
              <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
                <h2 className="mb-3 text-sm font-bold text-slate-700">Produits commandés</h2>
                <div className="space-y-3">
                  {produits.map((p) => {
                    const q = quantites[p.code] ?? { sachets: 0, filets: 0, cartons: 0 };
                    return (
                      <div
                        key={p.id}
                        className="rounded-xl border-l-4 p-3"
                        style={{
                          borderColor: p.code === "HYPO" ? "#3b82f6" : "#0d9488",
                          backgroundColor: p.code === "HYPO" ? "#eff6ff" : "#f0fdfa",
                        }}
                      >
                        <div className="mb-1 flex items-center gap-2">
                          {p.code === "HYPO" ? (
                            <Droplet size={16} className="text-blue-600" />
                          ) : (
                            <Sparkles size={16} className="text-teal-700" />
                          )}
                          <p className="text-sm font-bold text-slate-800">{p.nom}</p>
                        </div>
                        <div className={`grid gap-2.5 ${p.prixFilet !== null ? "grid-cols-3" : "grid-cols-2"}`}>
                          <input
                            type="number"
                            min={0}
                            placeholder="Sachets"
                            value={q.sachets || ""}
                            onWheel={(e) => (e.target as HTMLInputElement).blur()}
                            onChange={(e) => updateQty(p.code, "sachets", Number(e.target.value) || 0)}
                            className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm"
                          />
                          {p.prixFilet !== null && (
                            <input
                              type="number"
                              min={0}
                              placeholder="Filets"
                              value={q.filets || ""}
                              onWheel={(e) => (e.target as HTMLInputElement).blur()}
                              onChange={(e) => updateQty(p.code, "filets", Number(e.target.value) || 0)}
                              className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm"
                            />
                          )}
                          <input
                            type="number"
                            min={0}
                            placeholder="Cartons"
                            value={q.cartons || ""}
                            onWheel={(e) => (e.target as HTMLInputElement).blur()}
                            onChange={(e) => updateQty(p.code, "cartons", Number(e.target.value) || 0)}
                            className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-3">
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Date de livraison prévue
                  </label>
                  <input
                    type="date"
                    value={dateLivraison}
                    onChange={(e) => setDateLivraison(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-base"
                  />
                </div>
              </section>

              <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
                <h2 className="mb-3 text-sm font-bold text-slate-700">Mode de paiement</h2>
                <select
                  value={modePaiement}
                  onChange={(e) => setModePaiement(e.target.value as typeof modePaiement)}
                  className="mb-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-base"
                >
                  <option value="ESPECES">Espèces</option>
                  <option value="MOBILE_MONEY">Mobile Money</option>
                  <option value="CREDIT_PARTIEL">Crédit partiel</option>
                  <option value="CREDIT_TOTAL">Crédit total</option>
                </select>

                {modePaiement === "ESPECES" && (
                  <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                    <p className="flex items-center gap-2 text-lg font-bold text-slate-800">
                      <Wallet size={18} className="text-slate-400" />
                      {montantCalcule.toLocaleString("fr-FR")} FCFA
                    </p>
                  </div>
                )}
                {modePaiement === "MOBILE_MONEY" && (
                  <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                    <p className="mb-2 text-sm text-slate-600">
                      Montant : <span className="font-bold">{montantCalcule.toLocaleString("fr-FR")} FCFA</span>
                    </p>
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                      <input
                        type="checkbox"
                        checked={mobileMoneyConfirme}
                        onChange={(e) => setMobileMoneyConfirme(e.target.checked)}
                        className="h-5 w-5 accent-teal-700"
                      />
                      Paiement reçu par Mobile Money
                    </label>
                  </div>
                )}
                {modePaiement === "CREDIT_PARTIEL" && (
                  <div className="space-y-2.5 rounded-xl bg-slate-50 px-3 py-2.5">
                    <p className="text-sm text-slate-600">
                      Total dû : <span className="font-bold">{montantCalcule.toLocaleString("fr-FR")} FCFA</span>
                    </p>
                    <input
                      type="number"
                      min={0}
                      placeholder="Montant reçu"
                      value={montantRecu || ""}
                      onWheel={(e) => (e.target as HTMLInputElement).blur()}
                      onChange={(e) => setMontantRecu(Number(e.target.value) || 0)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-base"
                    />
                    {resteAPayer > 0 && (
                      <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700">
                        Reste à payer : {resteAPayer.toLocaleString("fr-FR")} FCFA
                      </p>
                    )}
                  </div>
                )}
                {modePaiement === "CREDIT_TOTAL" && (
                  <div className="rounded-xl bg-amber-50 px-3 py-2.5">
                    <p className="text-sm font-semibold text-amber-700">
                      Intégralement à crédit : {montantCalcule.toLocaleString("fr-FR")} FCFA
                    </p>
                  </div>
                )}
              </section>

              <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
                <div className="mb-2 flex items-center gap-2">
                  <NotebookPen size={16} className="text-teal-700" />
                  <h2 className="text-sm font-bold text-slate-700">Rapport de réassort</h2>
                </div>
                <textarea
                  value={observation}
                  onChange={(e) => setObservation(e.target.value)}
                  rows={4}
                  placeholder="Points marquants de ce réassort..."
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
            form="reassort-form"
            disabled={submitting}
            className="w-full rounded-xl py-3.5 text-base font-bold text-white shadow-md disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #0f766e, #14b8a6)" }}
          >
            {submitting ? "Enregistrement..." : "Valider le réassort"}
          </button>
        </div>
      )}
    </main>
  );
}

export default function ReassortPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <ReassortContent />
    </Suspense>
  );
}
