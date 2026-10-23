"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Clock, Download, Search, ShoppingCart, Wallet, MessageSquareText } from "lucide-react";
import { PointVenteSearch, type ResultatRecherche } from "@/components/commercial/PointVenteSearch";
import { queuePendingVisite } from "@/lib/offline/db";
import { chargerReferentiels, chargerMe, pointVenteLocal } from "@/lib/offline/referentiels";
import { syncPendingVisites } from "@/lib/offline/sync";
import { genererBonCommandePdf, referenceBonCommande } from "@/lib/utils/bon-commande-pdf";
import { BlocIndecis, ETAT_INDECIS_INITIAL, payloadIndecis, type EtatIndecis } from "@/components/commercial/BlocIndecis";
import { lignesDocument, numeroBonCommande } from "@/lib/utils/documents";
import { preparerCommande, type ProduitForm, type QuantitesParCode } from "@/lib/utils/commande-terrain";
import type { PalierTarif, PrixTypeTarif } from "@/lib/utils/tarifs";
import {
  EnTeteFormulaire,
  FOND_PAGE,
  Carte,
  Champ,
  Saisie,
  ZoneTexte,
  QuantitesProduit,
  QuantitesDetail,
  CaseVenteDetail,
  BarreAction,
  BoutonPrincipal,
  BlocPaiement,
  type ModePaiementTerrain,
} from "@/components/commercial/form-ui";

function uuid() {
  return crypto.randomUUID();
}

function ReassortContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pointVenteIdPrefill = searchParams.get("pointVenteId");

  const [pointVente, setPointVente] = useState<ResultatRecherche | null>(null);
  const [chargementPrefill, setChargementPrefill] = useState(Boolean(pointVenteIdPrefill));
  const [session, setSession] = useState<{ nom: string; prenom: string } | null>(null);

  const [produits, setProduits] = useState<ProduitForm[]>([]);
  const [prixParType, setPrixParType] = useState<PrixTypeTarif[]>([]);
  const [paliers, setPaliers] = useState<PalierTarif[]>([]);
  const [quantites, setQuantites] = useState<QuantitesParCode>({});
  const [detailActif, setDetailActif] = useState(false);
  const [quantitesDetail, setQuantitesDetail] = useState<QuantitesParCode>({});

  const [acompte, setAcompte] = useState(0);
  const [modePaiement, setModePaiement] = useState<ModePaiementTerrain>("ESPECES");
  const [dateLivraison, setDateLivraison] = useState("");
  const [observation, setObservation] = useState("");
  const [indecis, setIndecis] = useState<EtatIndecis>(ETAT_INDECIS_INITIAL);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [queuedOffline, setQueuedOffline] = useState(false);
  const [bonPdfLoading, setBonPdfLoading] = useState(false);
  const [bonRef, setBonRef] = useState<{ reference: string; date: Date } | null>(null);

  useEffect(() => {
    chargerReferentiels()
      .then((d) => {
        setProduits(d.produits ?? []);
        setPrixParType(d.prixParType ?? []);
        setPaliers(d.paliers ?? []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Données indisponibles."));
    chargerMe()
      .then((d) => setSession(d))
      .catch(() => {});

    if (pointVenteIdPrefill) {
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

  function updateQtyDetail(code: string, field: "sachets" | "filets" | "cartons", value: number) {
    setQuantitesDetail((prev) => {
      const base = prev[code] ?? { sachets: 0, filets: 0, cartons: 0 };
      return { ...prev, [code]: { ...base, [field]: value } };
    });
  }

  function updateQty(code: string, field: "sachets" | "filets" | "cartons", value: number) {
    setQuantites((prev) => {
      const base = prev[code] ?? { sachets: 0, filets: 0, cartons: 0 };
      return { ...prev, [code]: { ...base, [field]: value } };
    });
  }

  // Prix : base → type de boutique du point de vente → grille tarifaire.
  const ctxPrix = { typeId: pointVente?.typeId ?? null, prixParType, paliers };
  const commande = preparerCommande(produits, quantites, ctxPrix, detailActif ? quantitesDetail : undefined);
  const sousTotauxDetail = preparerCommande(produits, {}, ctxPrix, quantitesDetail).sousTotauxDetail;
  const lignes = commande.lignes;
  const montantCalcule = commande.total;

  const montantAnnonce =
    modePaiement === "CREDIT_PARTIEL"
      ? Math.min(Math.max(0, acompte), montantCalcule)
      : modePaiement === "CREDIT_TOTAL"
      ? 0
      : montantCalcule;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pointVente) return;
    setError(null);
    setSubmitting(true);

    const visiteUuid = uuid();
    const maintenant = new Date();
    setBonRef({ reference: referenceBonCommande(maintenant, visiteUuid), date: maintenant });
    const payload = {
      uuidClient: visiteUuid,
      dateVisite: maintenant.toISOString(),
      pointVenteId: pointVente.id,
      ...(lignes.length > 0
        ? {
            commande: {
              uuidClient: uuid(),
              lignes,
              montantTotal: montantCalcule,
              modePaiement,
              montantAnnonce,
              dateLivraisonPrevue: dateLivraison ? new Date(dateLivraison).toISOString() : undefined,
            },
          }
        : {}),
      ...payloadIndecis(indecis),
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

      const d = await res.json().catch(() => null);
      if (d?.bonCommande?.numero) {
        const numero = numeroBonCommande(d.bonCommande.numero);
        setBonRef((prev) => (prev ? { ...prev, reference: numero } : prev));
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

  async function telechargerBonCommande() {
    if (!pointVente || !bonRef) return;
    setBonPdfLoading(true);
    try {
      await genererBonCommandePdf({
        reference: bonRef.reference,
        date: bonRef.date,
        commercialNom: session ? `${session.prenom} ${session.nom}` : "—",
        client: {
          nom: pointVente.nom,
          ville: pointVente.villeNom,
          quartier: pointVente.quartierNom,
          repere: null,
          telephone: pointVente.telephoneVendeur,
        },
        sections: [
          {
            lignes: lignesDocument(commande.sources),
            livraisonPrevue: dateLivraison ? new Date(dateLivraison) : null,
          },
        ],
      });
    } finally {
      setBonPdfLoading(false);
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
            {success && bonRef && lignes.length > 0 && (
              <BoutonPrincipal type="button" onClick={telechargerBonCommande} disabled={bonPdfLoading}>
                <span className="flex items-center justify-center gap-2">
                  <Download size={16} />
                  {bonPdfLoading ? "Génération..." : "Télécharger le bon de commande"}
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
                      valeur={quantites[p.code] ?? { sachets: 0, filets: 0, cartons: 0 }}
                      onChange={(champ, v) => updateQty(p.code, champ, v)}
                      sousTotal={commande.sousTotaux.get(p.code) ?? 0}
                    />
                  ))}
                </div>
                <CaseVenteDetail actif={detailActif} onChange={setDetailActif} />
                {detailActif && (
                  <div className="space-y-3">
                    {produits.map((p) => (
                      <QuantitesDetail
                        key={p.id}
                        nom={p.nom || p.code}
                        avecFilets={p.prixFilet !== null}
                        valeur={quantitesDetail[p.code] ?? { sachets: 0, filets: 0, cartons: 0 }}
                        onChange={(champ, v) => updateQtyDetail(p.code, champ, v)}
                        sousTotal={sousTotauxDetail.get(p.code) ?? 0}
                      />
                    ))}
                  </div>
                )}
                <Champ label="Date de livraison prévue">
                  <Saisie type="date" value={dateLivraison} onChange={(e) => setDateLivraison(e.target.value)} />
                </Champ>
              </Carte>

              <Carte titre="Mode de paiement" icone={Wallet} accent="orange">
                <BlocPaiement
                  mode={modePaiement}
                  onMode={setModePaiement}
                  montant={montantCalcule}
                  acompte={acompte}
                  onAcompte={setAcompte}
                  libelle="Paiement prévu"
                />
              </Carte>

              <BlocIndecis valeur={indecis} onChange={setIndecis} />

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
