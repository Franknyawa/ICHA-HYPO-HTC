"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Clock, Download, Search, ShoppingCart, Wallet, MessageSquareText } from "lucide-react";
import { PointVenteSearch, type ResultatRecherche } from "@/components/commercial/PointVenteSearch";
import { queuePendingVisite } from "@/lib/offline/db";
import { chargerReferentiels, chargerMe, pointVenteLocal } from "@/lib/offline/referentiels";
import { syncPendingVisites } from "@/lib/offline/sync";
import { genererFacturePdf } from "@/lib/utils/facture-pdf";
import {
  EnTeteFormulaire,
  FOND_PAGE,
  Carte,
  Champ,
  Saisie,
  ZoneTexte,
  Choix,
  Encart,
  QuantitesProduit,
  BarreAction,
  BoutonPrincipal,
} from "@/components/commercial/form-ui";

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

type PrixParType = {
  produitId: string;
  typeId: string;
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
  const [prixParType, setPrixParType] = useState<PrixParType[]>([]);
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
    chargerReferentiels()
      .then((d) => {
        setProduits(d.produits ?? []);
        setPrixParType(d.prixParType ?? []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Données indisponibles."));
    chargerMe()
      .then((d) => setSession(d))
      .catch(() => {});

    if (pointVenteIdPrefill) {
      // En ligne : fiche du serveur ; sinon (ou en cas d'échec) copie locale.
      const depuisServeur = navigator.onLine
        ? fetch(`/api/points-vente/${pointVenteIdPrefill}`)
            .then((r) => (r.ok ? r.json() : null))
            .then((d) =>
              d
                ? {
                    id: d.id,
                    nom: d.nom,
                    vendeur: d.vendeur,
                    telephoneVendeur: d.telephoneVendeur,
                    villeNom: d.ville?.nom ?? null,
                    quartierNom: d.quartier?.nom ?? null,
                    typeId: d.typeId ?? null,
                    photoUrl: null,
                  }
                : null
            )
            .catch(() => null)
        : Promise.resolve(null);
      depuisServeur
        .then(async (pv) => pv ?? (await pointVenteLocal(pointVenteIdPrefill)))
        .then((pv) => {
          if (pv) setPointVente(pv);
        })
        .finally(() => setChargementPrefill(false));
    }
  }, [pointVenteIdPrefill]);

  function updateQty(code: string, field: "sachets" | "filets" | "cartons", value: number) {
    setQuantites((prev) => {
      const base = prev[code] ?? { sachets: 0, filets: 0, cartons: 0 };
      return { ...prev, [code]: { ...base, [field]: value } };
    });
  }

  const lignes = produits
    .map((p) => {
      const q = quantites[p.code] ?? { sachets: 0, filets: 0, cartons: 0 };
      if (q.sachets === 0 && q.filets === 0 && q.cartons === 0) return null;
      return { produit: p, ...q };
    })
    .filter(Boolean) as { produit: Produit; sachets: number; filets: number; cartons: number }[];

  // Le type de boutique du point de vente est déjà connu (il a été
  // renseigné à sa création) — pas besoin de le redemander ici, le prix
  // spécifique s'applique automatiquement s'il existe, sinon repli sur le
  // prix de base du produit.
  function prixEffectif(p: Produit): Produit {
    if (!pointVente?.typeId) return p;
    const surcharge = prixParType.find(
      (pt) => pt.produitId === p.id && pt.typeId === pointVente.typeId
    );
    if (!surcharge) return p;
    return { ...p, prixSachet: surcharge.prixSachet, prixFilet: surcharge.prixFilet, prixCarton: surcharge.prixCarton };
  }

  const sousTotal = (l: { produit: Produit; sachets: number; filets: number; cartons: number }) => {
    const prix = prixEffectif(l.produit);
    return l.sachets * prix.prixSachet + l.filets * (prix.prixFilet ?? 0) + l.cartons * prix.prixCarton;
  };

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
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4 dark:bg-slate-950">
        <div className="w-full max-w-sm rounded-2xl border border-slate-200/80 bg-white px-8 py-10 text-center dark:border-slate-800 dark:bg-slate-900">
          <div
            className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full ${
              queuedOffline ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"
            }`}
          >
            {queuedOffline ? <Clock size={28} /> : <CheckCircle2 size={30} />}
          </div>
          <p className="mb-5 font-semibold text-slate-900 dark:text-slate-100">
            {queuedOffline ? "Données en attente de synchronisation" : "Réassort enregistré"}
          </p>
          <div className="space-y-2">
            {success && lignes.length > 0 && (
              <BoutonPrincipal type="button" onClick={telechargerFacture} disabled={facturePdfLoading}>
                <span className="flex items-center justify-center gap-2">
                  <Download size={16} />
                  {facturePdfLoading ? "Génération..." : "Télécharger la facture"}
                </span>
              </BoutonPrincipal>
            )}
            <button
              onClick={() => router.push("/dashboard")}
              className="w-full rounded-xl border border-slate-300 py-3 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-300"
            >
              Retour à l&apos;accueil
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className={`${FOND_PAGE} pb-28`}>
      <EnTeteFormulaire titre="Visite de réassort" sousTitre="Commande de produits" />

      <div className="mx-auto max-w-xl space-y-4 px-4 pt-4">
        {chargementPrefill ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Chargement du point de vente...</p>
        ) : !pointVente ? (
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

            <form onSubmit={handleSubmit} id="reassort-form" className="space-y-4">
              <Carte titre="Produits commandés" icone={ShoppingCart} accent="vert">
                <div className="space-y-3">
                  {produits.map((p) => (
                    <QuantitesProduit
                      key={p.id}
                      nom={p.nom || p.code}
                      avecFilets={p.prixFilet !== null}
                      valeur={quantites[p.code] ?? { sachets: 0, filets: 0, cartons: 0 }}
                      onChange={(champ, v) => updateQty(p.code, champ, v)}
                      sousTotal={sousTotal({
                        produit: p,
                        ...(quantites[p.code] ?? { sachets: 0, filets: 0, cartons: 0 }),
                      })}
                    />
                  ))}
                </div>
                <Champ label="Date de livraison prévue">
                  <Saisie type="date" value={dateLivraison} onChange={(e) => setDateLivraison(e.target.value)} />
                </Champ>
              </Carte>

              <Carte titre="Mode de paiement" icone={Wallet} accent="orange">
                <Choix<typeof modePaiement>
                  colonnes={2}
                  value={modePaiement}
                  onChange={setModePaiement}
                  options={[
                    { value: "ESPECES", label: "Espèces" },
                    { value: "MOBILE_MONEY", label: "Mobile Money" },
                    { value: "CREDIT_PARTIEL", label: "Crédit partiel" },
                    { value: "CREDIT_TOTAL", label: "Crédit total" },
                  ]}
                />

                {modePaiement === "ESPECES" && (
                  <Encart>
                    Montant à percevoir :{" "}
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {montantCalcule.toLocaleString("fr-FR")} FCFA
                    </span>
                  </Encart>
                )}
                {modePaiement === "MOBILE_MONEY" && (
                  <Encart>
                    <p className="mb-3">
                      Montant :{" "}
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {montantCalcule.toLocaleString("fr-FR")} FCFA
                      </span>
                    </p>
                    <label className="flex items-center gap-3 font-medium">
                      <input
                        type="checkbox"
                        checked={mobileMoneyConfirme}
                        onChange={(e) => setMobileMoneyConfirme(e.target.checked)}
                        className="h-5 w-5 accent-[#1e3a8a]"
                      />
                      Paiement reçu par Mobile Money
                    </label>
                  </Encart>
                )}
                {modePaiement === "CREDIT_PARTIEL" && (
                  <div className="space-y-3">
                    <Encart>
                      Total dû :{" "}
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {montantCalcule.toLocaleString("fr-FR")} FCFA
                      </span>
                    </Encart>
                    <Champ label="Montant reçu du client (FCFA)">
                      <Saisie
                        type="number"
                        inputMode="numeric"
                        min={0}
                        placeholder="0"
                        value={montantRecu || ""}
                        onChange={(e) => setMontantRecu(Number(e.target.value) || 0)}
                      />
                    </Champ>
                    {resteAPayer > 0 && (
                      <Encart ton="attention">Reste à payer : {resteAPayer.toLocaleString("fr-FR")} FCFA</Encart>
                    )}
                  </div>
                )}
                {modePaiement === "CREDIT_TOTAL" && (
                  <Encart ton="attention">
                    Intégralement à crédit : {montantCalcule.toLocaleString("fr-FR")} FCFA
                  </Encart>
                )}
              </Carte>

              <Carte titre="Rapport de réassort" icone={MessageSquareText} accent="violet">
                <ZoneTexte
                  value={observation}
                  onChange={(e) => setObservation(e.target.value)}
                  rows={4}
                  placeholder="Points marquants de ce réassort..."
                />
              </Carte>

              {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-alert">{error}</p>}
            </form>
          </>
        )}
      </div>

      {pointVente && (
        <BarreAction>
          <BoutonPrincipal form="reassort-form" disabled={submitting}>
            {submitting ? "Enregistrement..." : "Valider le réassort"}
          </BoutonPrincipal>
        </BarreAction>
      )}
    </main>
  );
}

export default function ReassortPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 dark:bg-slate-950" />}>
      <ReassortContent />
    </Suspense>
  );
}
