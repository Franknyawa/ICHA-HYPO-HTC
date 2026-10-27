"use client";

import { trierProduits } from "@/lib/utils/produits-ordre";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Camera, CheckCircle2, Clock, Download, Store, ShoppingCart, MessageSquareText } from "lucide-react";
import { queuePendingVisite } from "@/lib/offline/db";
import { chargerReferentiels, chargerMe } from "@/lib/offline/referentiels";
import { syncPendingVisites } from "@/lib/offline/sync";
import { compressImage } from "@/lib/utils/image";
import { genererBonCommandePdf, referenceBonCommande } from "@/lib/utils/bon-commande-pdf";
import { BlocIndecis, ETAT_INDECIS_INITIAL, payloadIndecis, type EtatIndecis } from "@/components/commercial/BlocIndecis";
import { lignesDocument, numeroBonCommande } from "@/lib/utils/documents";
import { preparerCommande, type ProduitForm } from "@/lib/utils/commande-terrain";
import type { PalierTarif } from "@/lib/utils/tarifs";
import { COORDONNEES_VILLES } from "@/lib/geo/cameroun";
import {
  EnTeteFormulaire,
  Carte,
  Champ,
  Saisie,
  ZoneTexte,
  Liste,
  Choix,
  ChoixMultiple,
  FOND_PAGE,
  OuiNon,
  QuantitesProduit,
  QuantitesDetail,
  CaseVenteDetail,
  Encart,
  BarreAction,
  BoutonPrincipal,
  BlocPaiement,
  type ModePaiementTerrain,
} from "@/components/commercial/form-ui";

type Ville = { id: string; nom: string };
type TypePV = { id: string; nom: string };
type Produit = ProduitForm;
type Session = { nom: string; prenom: string; binomeId: string | null; binomeNom: string | null };
type PrixParType = {
  produitId: string;
  typeId: string;
  prixSachet: number;
  prixFilet: number | null;
  prixCarton: number;
};

function uuid() {
  return crypto.randomUUID();
}

/** Met à jour une quantité (sachets/filets/cartons) pour un produit donné,
 * dans une map { [code]: {sachets, filets, cartons} } — partagé par
 * l'achat du jour et la commande future intégrée. */
function updateQuantite(
  setter: React.Dispatch<
    React.SetStateAction<Record<string, { sachets: number; filets: number; cartons: number }>>
  >,
  code: string,
  field: "sachets" | "filets" | "cartons",
  value: number
) {
  setter((prev) => {
    const base = prev[code] ?? { sachets: 0, filets: 0, cartons: 0 };
    return { ...prev, [code]: { ...base, [field]: value } };
  });
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function nearestVille(
  point: { lat: number; lng: number },
  villes: Ville[]
): Ville | null {
  let best: Ville | null = null;
  let bestDist = Infinity;
  for (const v of villes) {
    const coords = COORDONNEES_VILLES[v.nom];
    if (!coords) continue;
    const d = haversineKm(point, coords);
    if (d < bestDist) {
      bestDist = d;
      best = v;
    }
  }
  return best;
}

type RoleRepondant = "PATRON" | "GERANT" | "EMPLOYE" | "AUTRE";
const ROLES: { value: RoleRepondant; label: string }[] = [
  { value: "PATRON", label: "Patron" },
  { value: "GERANT", label: "Gérant" },
  { value: "EMPLOYE", label: "Employé" },
  { value: "AUTRE", label: "Autre" },
];
const TYPE_AUTRE = "__autre__";

export default function NouvelleVisitePage() {
  const router = useRouter();
  const fileInputRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];

  const [session, setSession] = useState<Session | null>(null);
  const [villes, setVilles] = useState<Ville[]>([]);
  const [types, setTypes] = useState<TypePV[]>([]);
  const [produits, setProduits] = useState<Produit[]>([]);
  const [prixParType, setPrixParType] = useState<PrixParType[]>([]);
  const [paliers, setPaliers] = useState<PalierTarif[]>([]);

  const [now] = useState(() => new Date());

  const [nom, setNom] = useState("");
  // « Qui nous répond ? » : rôle, nom et téléphone du répondant ; si ce n'est
  // pas le patron, on demande aussi le nom et le téléphone du patron.
  const [role, setRole] = useState<RoleRepondant | "">("");
  const [fonctionAutre, setFonctionAutre] = useState("");
  const [repondantNom, setRepondantNom] = useState("");
  const [repondantTel, setRepondantTel] = useState("");
  const [patronNom, setPatronNom] = useState("");
  const [patronTel, setPatronTel] = useState("");
  const [villeId, setVilleId] = useState("");
  const [quartierNom, setQuartierNom] = useState("");
  const [repere, setRepere] = useState("");
  // Types de boutique : plusieurs choix possibles, plus « Autre » avec une saisie libre.
  // Le premier type coché détermine les prix du catalogue.
  const [typesChoisis, setTypesChoisis] = useState<string[]>([]);
  const [typeAutre, setTypeAutre] = useState("");
  const autreActif = typesChoisis.includes(TYPE_AUTRE);
  const typesIds = typesChoisis.filter((t) => t !== TYPE_AUTRE);
  const typeId = typesIds[0] ?? "";
  function basculerType(v: string) {
    setTypesChoisis((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));
  }
  const [presentoir, setPresentoir] = useState<boolean | null>(null);
  const [presentoirAuto, setPresentoirAuto] = useState(false);
  // Deux photos de devanture (demande de Victor) — tableaux de taille 2,
  // chaque index traité indépendamment (compression + upload propres).
  const [photoPreviews, setPhotoPreviews] = useState<(string | null)[]>([null, null]);
  const [photoUrls, setPhotoUrls] = useState<(string | null)[]>([null, null]);
  const [photoUuids, setPhotoUuids] = useState<(string | null)[]>([null, null]);
  const [photoUploading, setPhotoUploading] = useState<boolean[]>([false, false]);
  const [gps, setGps] = useState<{ lat: number; lng: number; precision: number } | null>(
    null
  );
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [villeAuto, setVilleAuto] = useState(false);

  // Quantités par produit — généralisé à n'importe quel produit actif
  // (plus limité à HYPO/HTC), clé = produit.code.
  const [quantites, setQuantites] = useState<
    Record<string, { sachets: number; filets: number; cartons: number }>
  >({});

  // « Le client veut commander » (achat du jour) et « commander plus tard »
  // (commande à livrer) : deux questions Oui/Non indépendantes.
  // Vente en détail (sachets / filets) : section activée par une case à cocher.
  const [detailActif, setDetailActif] = useState(false);
  const [quantitesDetail, setQuantitesDetail] = useState<
    Record<string, { sachets: number; filets: number; cartons: number }>
  >({});
  const [veutCommander, setVeutCommander] = useState<boolean | null>(null);
  const [commanderPlusTard, setCommanderPlusTard] = useState<boolean | null>(null);
  const [quantitesCommande, setQuantitesCommande] = useState<
    Record<string, { sachets: number; filets: number; cartons: number }>
  >({});
  const [commandeDateLivraison, setCommandeDateLivraison] = useState("");

  // Montant effectivement reçu en cas de crédit partiel — distinct du
  // montant calculé (valeur catalogue), qui sert alors de référence pour
  // calculer le reste à payer.
  const [montantRecu, setMontantRecu] = useState(0);
  const [modePaiement, setModePaiement] = useState<ModePaiementTerrain>("ESPECES");
  // Mode annoncé pour la commande à livrer plus tard (même choix, indépendant de l'achat du jour).
  const [modePaiementCommande, setModePaiementCommande] = useState<ModePaiementTerrain>("ESPECES");
  const [acompteCommande, setAcompteCommande] = useState(0);

  const [submitting, setSubmitting] = useState(false);
  const [observation, setObservation] = useState("");
  const [indecis, setIndecis] = useState<EtatIndecis>(ETAT_INDECIS_INITIAL);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [queuedOffline, setQueuedOffline] = useState(false);

  useEffect(() => {
    chargerMe()
      .then((d) => setSession(d))
      .catch(() => {});
    chargerReferentiels()
      .then((d) => {
        setVilles(d.villes ?? []);
        setTypes(d.types ?? []);
        setProduits(trierProduits(d.produits ?? []));
        setPrixParType(d.prixParType ?? []);
        setPaliers(d.paliers ?? []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Données indisponibles."));
  }, []);

  function captureGps() {
    setGpsError(null);
    if (!navigator.geolocation) {
      setGpsError("Géolocalisation non supportée par ce navigateur.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const point = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setGps({ ...point, precision: pos.coords.accuracy });

        // Ville déduite automatiquement de la position, mais reste
        // modifiable au cas où le commercial est en périphérie d'une ville
        // ou que le GPS est imprécis.
        const detected = nearestVille(point, villes);
        if (detected) {
          setVilleId(detected.id);
          setVilleAuto(true);
        }
      },
      () => setGpsError("Impossible de récupérer la position (autorisation refusée ?)."),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function handlePhotoChange(index: number, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await compressImage(file, 1280, 0.7);

    setPhotoPreviews((prev) => prev.map((p, i) => (i === index ? dataUrl : p)));
    setPhotoUrls((prev) => prev.map((p, i) => (i === index ? null : p)));

    const newUuid = uuid();
    setPhotoUuids((prev) => prev.map((p, i) => (i === index ? newUuid : p)));

    // Upload immédiat vers le stockage objet si le réseau est disponible —
    // seule l'URL réelle sera envoyée avec la visite, jamais le contenu de
    // la photo en base (§12 doc scalabilité). Si l'upload échoue (hors
    // ligne, stockage non configuré), on garde le data URL en repli : la
    // visite continue de fonctionner, avec la limitation documentée dans le
    // README (photo alors stockée en base, à éviter en usage prolongé).
    if (navigator.onLine) {
      setPhotoUploading((prev) => prev.map((p, i) => (i === index ? true : p)));
      try {
        const res = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dataUrl, uuidClient: newUuid }),
        });
        if (res.ok) {
          const data = await res.json();
          setPhotoUrls((prev) => prev.map((p, i) => (i === index ? data.url : p)));
        }
      } catch {
        // Échec silencieux : le data URL en mémoire prend le relais.
      } finally {
        setPhotoUploading((prev) => prev.map((p, i) => (i === index ? false : p)));
      }
    }
  }

  const achatActif = veutCommander === true;
  const commandeActive = commanderPlusTard === true;

  // Prix : base → type de boutique → grille tarifaire (selon les cartons
  // commandés). Les prix appliqués sont figés sur chaque ligne et servent à
  // la facture. Toutes les valeurs viennent des référentiels (jamais codées).
  const ctxPrix = { typeId, prixParType, paliers };
  // La vente en détail fait partie de l'achat du jour (même paiement, même bon de commande).
  const achat = preparerCommande(
    achatActif || detailActif ? produits : [],
    achatActif ? quantites : {},
    ctxPrix,
    detailActif ? quantitesDetail : undefined
  );
  const commandeFuture = preparerCommande(commandeActive ? produits : [], quantitesCommande, ctxPrix);
  // Sous-totaux affichés sous chaque produit (même quand le bloc est replié).
  const sousTotauxParProduit = preparerCommande(produits, quantites, ctxPrix).sousTotaux;
  const sousTotauxCommandeParProduit = preparerCommande(produits, quantitesCommande, ctxPrix).sousTotaux;
  const sousTotauxDetailParProduit = preparerCommande(produits, {}, ctxPrix, quantitesDetail).sousTotauxDetail;
  const lignesVente = achat.lignes;
  const commandeLignes = commandeFuture.lignes;
  const montantCalcule = achat.total;
  const montantCommandeCalcule = commandeFuture.total;

  // Le commercial n'encaisse rien : il annonce le mode de paiement et le
  // montant à encaisser. Le superviseur encaisse plus tard, l'admin valide.
  const montantAnnonce =
    modePaiement === "CREDIT_PARTIEL" ? montantRecu : modePaiement === "CREDIT_TOTAL" ? 0 : montantCalcule;

  // Auto-détection du présentoir (demande de Victor) : si les sachets
  // dépassent 30 ET les cartons dépassent 1 pour l'un des produits actifs
  // (plus limité à HYPO/HTC), on marque "Oui" automatiquement. Reste
  // modifiable ensuite — c'est une suggestion, pas un verrou.
  useEffect(() => {
    const unProduitQualifie =
      achatActif &&
      Object.entries(quantites).some(([code, q]) => q.cartons > 1 && (quantitesDetail[code]?.sachets ?? 0) > 30);
    if (unProduitQualifie && presentoir !== true) {
      setPresentoir(true);
      setPresentoirAuto(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quantites, quantitesDetail, achatActif]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const visiteUuid = uuid();
    const maintenant = new Date();
    setBonRef({ reference: referenceBonCommande(maintenant, visiteUuid), date: maintenant });
    const photosPayload = photoUrls
      .map((url, i) => {
        const finalUrl = url ?? photoPreviews[i];
        if (!finalUrl) return null;
        return {
          uuidClient: photoUuids[i] ?? uuid(),
          url: finalUrl,
          type: i === 0 ? "DEVANTURE_1" : "DEVANTURE_2",
        };
      })
      .filter(Boolean) as { uuidClient: string; url: string; type: string }[];

    const payload = {
      uuidClient: visiteUuid,
      dateVisite: new Date().toISOString(),
      latitude: gps?.lat ?? null,
      longitude: gps?.lng ?? null,
      precisionGps: gps?.precision ?? null,
      nouveauPointVente: {
        uuidClient: uuid(),
        nom,
        // Le répondant reste l'interlocuteur du point de vente (champs
        // historiques vendeur / téléphone) ; le patron est renseigné à part.
        vendeur: repondantNom.trim() || undefined,
        telephoneVendeur: repondantTel.trim() || undefined,
        repondantRole: role || undefined,
        repondantFonction: role === "AUTRE" ? fonctionAutre.trim() || undefined : undefined,
        patronNom: (role === "PATRON" ? repondantNom : patronNom).trim() || undefined,
        telephonePatron: (role === "PATRON" ? repondantTel : patronTel).trim() || undefined,
        villeId,
        quartierNom: quartierNom || undefined,
        typeId: typeId || undefined,
        typesIds: typesIds.length > 0 ? typesIds : undefined,
        typeAutre: autreActif ? typeAutre.trim() || undefined : undefined,
        repere: repere || undefined,
        presentoir: presentoir ?? false,
      },
      ...(lignesVente.length > 0
        ? {
            vente: {
              uuidClient: uuid(),
              lignes: lignesVente,
              // Valeur catalogue de la vente — distincte de ce qui a été
              // effectivement perçu (paiement.montant), qui peut être
              // inférieur en cas de crédit partiel/total.
              montantTotal: montantCalcule,
              paiement: {
                uuidClient: uuid(),
                montant: montantAnnonce,
                modePaiement,
              },
            },
          }
        : {}),
      ...(commandeActive && commandeLignes.length > 0
        ? {
            commande: {
              uuidClient: uuid(),
              lignes: commandeLignes,
              montantTotal: montantCommandeCalcule,
              modePaiement: modePaiementCommande,
              dateLivraisonPrevue: commandeDateLivraison
                ? new Date(commandeDateLivraison).toISOString()
                : undefined,
            },
          }
        : {}),
      ...payloadIndecis(indecis),
      photos: photosPayload,
      observation: observation || undefined,
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
      if (!aUneCommande) {
        setTimeout(() => router.push("/dashboard"), 1200);
      }
    } catch {
      await queuePendingVisite(visiteUuid, payload);
      setQueuedOffline(true);
      syncPendingVisites();
    } finally {
      setSubmitting(false);
    }
  }

  const [bonPdfLoading, setBonPdfLoading] = useState(false);
  const [bonPdfError, setBonPdfError] = useState<string | null>(null);
  // Référence et date du bon de commande, fixées au moment de la validation.
  const [bonRef, setBonRef] = useState<{ reference: string; date: Date } | null>(null);
  const aUneCommande = lignesVente.length > 0 || commandeLignes.length > 0;

  async function telechargerBonCommande() {
    if (!bonRef) return;
    setBonPdfLoading(true);
    setBonPdfError(null);
    try {
      const ville = villes.find((v) => v.id === villeId)?.nom ?? null;
      await genererBonCommandePdf({
        reference: bonRef.reference,
        date: bonRef.date,
        commercialNom: session ? `${session.prenom} ${session.nom}` : "—",
        client: {
          nom: nom || "—",
          ville,
          quartier: quartierNom.trim() || null,
          repere: repere.trim() || null,
          telephone: (repondantTel || patronTel).trim() || null,
        },
        sections: [
          { titre: commandeLignes.length > 0 ? "Commande du jour" : undefined, lignes: lignesDocument(achat.sources) },
          {
            titre: "Commande à livrer",
            livraisonPrevue: commandeDateLivraison ? new Date(commandeDateLivraison) : null,
            lignes: lignesDocument(commandeFuture.sources),
          },
        ],
      });
    } catch {
      setBonPdfError("Impossible de générer le bon de commande pour le moment.");
    } finally {
      setBonPdfLoading(false);
    }
  }

  const boutonBonCommande = aUneCommande && bonRef && (
    <div className="space-y-2">
      <BoutonPrincipal type="button" onClick={telechargerBonCommande} disabled={bonPdfLoading}>
        <span className="flex items-center justify-center gap-2">
          <Download size={16} />
          {bonPdfLoading ? "Génération..." : "Télécharger le bon de commande"}
        </span>
      </BoutonPrincipal>
      {bonPdfError && <p className="text-xs text-alert">{bonPdfError}</p>}
    </div>
  );

  if (success) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4 dark:bg-slate-950">
        <div className="w-full max-w-sm rounded-2xl border border-slate-200/80 bg-white px-8 py-10 text-center dark:border-slate-800 dark:bg-slate-900">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <CheckCircle2 size={30} />
          </div>
          <p className="mb-5 font-semibold text-slate-900 dark:text-slate-100">Visite enregistrée avec succès</p>
          {aUneCommande && (
            <div className="space-y-2">
              {boutonBonCommande}
              <button
                onClick={() => router.push("/dashboard")}
                className="w-full rounded-xl border border-slate-300 py-3 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-300"
              >
                Retour à l&apos;accueil
              </button>
            </div>
          )}
        </div>
      </main>
    );
  }

  if (queuedOffline) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4 dark:bg-slate-950">
        <div className="w-full max-w-sm rounded-2xl border border-slate-200/80 bg-white px-8 py-10 text-center dark:border-slate-800 dark:bg-slate-900">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-600">
            <Clock size={28} />
          </div>
          <p className="mb-2 font-semibold text-slate-900 dark:text-slate-100">Données en attente de synchronisation</p>
          <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
            La visite a été enregistrée sur ton téléphone et sera envoyée automatiquement dès que la connexion
            reviendra.
          </p>
          <div className="space-y-2">
            {boutonBonCommande}
            <BoutonPrincipal type="button" onClick={() => router.push("/dashboard")}>
              Retour à l&apos;accueil
            </BoutonPrincipal>
          </div>
        </div>
      </main>
    );
  }

  const roleChoisi = role !== "";

  return (
    <main className={`${FOND_PAGE} pb-28`}>
      <EnTeteFormulaire titre="Nouveau recensement" sousTitre="Recensement terrain du jour" />

      <form onSubmit={handleSubmit} id="visite-form" className="mx-auto max-w-xl space-y-4 px-4 pt-4">
        {/* Équipe : simple rappel, rien à saisir */}
        <section className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-2xl bg-gradient-to-br from-[#1e3a8a] to-[#359980] p-5 text-sm text-white shadow-md shadow-blue-900/15 [&_p.t]:text-white/70">
          <div>
            <p className="text-xs text-white/70">Date</p>
            <p suppressHydrationWarning className="mt-0.5 font-medium text-white">
              {now.toLocaleDateString("fr-FR")}
            </p>
          </div>
          <div>
            <p className="text-xs text-white/70">Heure</p>
            <p suppressHydrationWarning className="mt-0.5 font-medium text-white">
              {now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
          <div>
            <p className="text-xs text-white/70">Agent commercial</p>
            <p className="mt-0.5 font-medium text-white">
              {session ? `${session.prenom} ${session.nom}` : "..."}
            </p>
          </div>
          <div>
            <p className="text-xs text-white/70">Binôme</p>
            <p className="mt-0.5 font-medium text-white">
              {session?.binomeNom ?? "Non assigné"}
            </p>
          </div>
        </section>

        {/* Point de vente — on commence par « Qui nous répond ? » */}
        <Carte titre="Point de vente" icone={Store} accent="bleu">
          <Champ label="Qui nous répond ?">
            <Choix<RoleRepondant> options={ROLES} value={role} onChange={setRole} colonnes={4} />
          </Champ>

          {roleChoisi && (
            <div className="space-y-4 rounded-xl border border-blue-100 bg-blue-50/60 p-4 dark:border-slate-800 dark:bg-slate-950">
              {role === "AUTRE" && (
                <Champ label="Sa fonction">
                  <Saisie
                    placeholder="Ex : fils du patron, caissière..."
                    value={fonctionAutre}
                    onChange={(e) => setFonctionAutre(e.target.value)}
                  />
                </Champ>
              )}
              <Champ label="Nom du répondant">
                <Saisie
                  placeholder="Nom et prénom"
                  value={repondantNom}
                  onChange={(e) => setRepondantNom(e.target.value)}
                />
              </Champ>
              <Champ label="Téléphone du répondant (WhatsApp)">
                <Saisie
                  type="tel"
                  inputMode="tel"
                  placeholder="6XX XX XX XX"
                  value={repondantTel}
                  onChange={(e) => setRepondantTel(e.target.value)}
                />
              </Champ>

              {role !== "PATRON" && (
                <>
                  <div className="border-t border-slate-200 pt-4 dark:border-slate-800" />
                  <Champ label="Nom du patron">
                    <Saisie
                      placeholder="Nom et prénom"
                      value={patronNom}
                      onChange={(e) => setPatronNom(e.target.value)}
                    />
                  </Champ>
                  <Champ label="Téléphone du patron (WhatsApp)">
                    <Saisie
                      type="tel"
                      inputMode="tel"
                      placeholder="6XX XX XX XX"
                      value={patronTel}
                      onChange={(e) => setPatronTel(e.target.value)}
                    />
                  </Champ>
                </>
              )}
            </div>
          )}

          <Champ label="Nom du point de vente">
            <Saisie placeholder="Ex : Boutique Grâce" value={nom} onChange={(e) => setNom(e.target.value)} required />
          </Champ>

          <Champ
            label="Position GPS"
            aide={
              gps
                ? `${gps.lat.toFixed(5)}, ${gps.lng.toFixed(5)} (± ${Math.round(gps.precision)} m)`
                : "Détecte aussi la ville automatiquement."
            }
          >
            <button
              type="button"
              onClick={captureGps}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white py-3 text-sm font-medium text-slate-700 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              <MapPin size={18} />
              {gps ? "Position mise à jour" : "Récupérer la position"}
            </button>
            {gpsError && <p className="mt-1.5 text-xs text-alert">{gpsError}</p>}
          </Champ>

          <div className="grid grid-cols-2 gap-3">
            <Champ label={villeAuto && villeId ? "Ville (détectée)" : "Ville"}>
              <Liste
                value={villeId}
                onChange={(v) => {
                  setVilleId(v);
                  setVilleAuto(false);
                }}
                required
              >
                <option value="">Choisir...</option>
                {villes.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.nom}
                  </option>
                ))}
              </Liste>
            </Champ>
            <Champ label="Quartier">
              <Saisie placeholder="Ex : Akwa" value={quartierNom} onChange={(e) => setQuartierNom(e.target.value)} />
            </Champ>
          </div>

          <Champ label="Repère exact">
            <Saisie placeholder="Ex : PK8 entrée Lycée" value={repere} onChange={(e) => setRepere(e.target.value)} />
          </Champ>

          <Champ label="Type de boutique" aide="Plusieurs choix possibles. Les prix suivent le premier type coché.">
            <ChoixMultiple
              options={[...types.map((t) => ({ value: t.id, label: t.nom })), { value: TYPE_AUTRE, label: "Autre" }]}
              values={typesChoisis}
              onToggle={basculerType}
            />
            {autreActif && (
              <div className="mt-3">
                <Saisie
                  placeholder="Précisez le type de boutique"
                  value={typeAutre}
                  onChange={(e) => setTypeAutre(e.target.value)}
                />
              </div>
            )}
          </Champ>

          <Champ label="Photos de la devanture">
            <div className="grid grid-cols-2 gap-3">
              {[0, 1].map((index) => (
                <div key={index}>
                  <input
                    ref={fileInputRefs[index]}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => handlePhotoChange(index, e)}
                    className="hidden"
                  />
                  {photoPreviews[index] ? (
                    <button
                      type="button"
                      onClick={() => fileInputRefs[index].current?.click()}
                      className="relative block w-full overflow-hidden rounded-xl"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photoPreviews[index]!} alt={`Devanture ${index + 1}`} className="h-32 w-full object-cover" />
                      <span className="absolute bottom-1.5 right-1.5 rounded-lg bg-black/60 px-2 py-1 text-[10px] font-medium text-white">
                        Reprendre
                      </span>
                      {photoUploading[index] && (
                        <span className="absolute left-1.5 top-1.5 rounded-lg bg-black/60 px-2 py-1 text-[10px] font-medium text-white">
                          Envoi...
                        </span>
                      )}
                      {photoUrls[index] && !photoUploading[index] && (
                        <span className="absolute left-1.5 top-1.5 rounded-lg bg-emerald-600/90 px-2 py-1 text-[10px] font-medium text-white">
                          Envoyée
                        </span>
                      )}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRefs[index].current?.click()}
                      className="flex h-32 w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 text-xs font-medium text-slate-500 hover:border-slate-400 dark:border-slate-700 dark:text-slate-400"
                    >
                      <Camera size={20} />
                      Photo {index + 1}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </Champ>
        </Carte>

        {/* Achat et commande */}
        <Carte titre="Achat et commande du jour" icone={ShoppingCart} accent="vert">
          <Champ label="Le client veut commander ?">
            <OuiNon value={veutCommander} onChange={setVeutCommander} />
          </Champ>

          {achatActif && (
            <div className="space-y-3">
              {produits.map((p) => (
                <QuantitesProduit
                  key={p.id}
                  nom={p.nom || p.code}
                  valeur={quantites[p.code] ?? { sachets: 0, filets: 0, cartons: 0 }}
                  onChange={(champ, v) => updateQuantite(setQuantites, p.code, champ, v)}
                  sousTotal={sousTotauxParProduit.get(p.code) ?? 0}
                />
              ))}
            </div>
          )}

          <CaseVenteDetail actif={detailActif} onChange={setDetailActif} />

          {detailActif && (
            <div className="space-y-3">
              {produits.map((p) => (
                <QuantitesDetail
                  key={p.id}
                  nom={p.nom || p.code}
                  avecFilets={p.prixFilet !== null}
                  valeur={quantitesDetail[p.code] ?? { sachets: 0, filets: 0, cartons: 0 }}
                  onChange={(champ, v) => updateQuantite(setQuantitesDetail, p.code, champ, v)}
                  sousTotal={sousTotauxDetailParProduit.get(p.code) ?? 0}
                />
              ))}
            </div>
          )}

          {(achatActif || detailActif) && (
            <BlocPaiement
              mode={modePaiement}
              onMode={setModePaiement}
              montant={montantCalcule}
              acompte={montantRecu}
              onAcompte={setMontantRecu}
            />
          )}

          <Champ label="Veut-il commander plus tard ?">
            <OuiNon value={commanderPlusTard} onChange={setCommanderPlusTard} />
          </Champ>

          {commandeActive && (
            <>
              <div className="space-y-3">
                {produits.map((p) => (
                  <QuantitesProduit
                    key={p.id}
                    nom={p.nom || p.code}
                    valeur={quantitesCommande[p.code] ?? { sachets: 0, filets: 0, cartons: 0 }}
                    onChange={(champ, v) => updateQuantite(setQuantitesCommande, p.code, champ, v)}
                    sousTotal={sousTotauxCommandeParProduit.get(p.code) ?? 0}
                  />
                ))}
              </div>
              <Champ label="Date de livraison prévue">
                <Saisie type="date" value={commandeDateLivraison} onChange={(e) => setCommandeDateLivraison(e.target.value)} />
              </Champ>
              {montantCommandeCalcule > 0 && (
                <BlocPaiement
                  libelle="Mode de paiement à la livraison"
                  mode={modePaiementCommande}
                  onMode={setModePaiementCommande}
                  montant={montantCommandeCalcule}
                  acompte={acompteCommande}
                  onAcompte={setAcompteCommande}
                />
              )}
            </>
          )}

          {/* Présentoir : suggéré automatiquement d'après les quantités
              achetées, reste modifiable. */}
          <Champ
            label="Installation du présentoir"
            aide={presentoirAuto && presentoir === true ? "Suggéré d'après les quantités achetées." : undefined}
          >
            <OuiNon
              value={presentoir}
              onChange={(v) => {
                setPresentoir(v);
                setPresentoirAuto(false);
              }}
            />
          </Champ>
        </Carte>

        {/* Observations */}
        <BlocIndecis valeur={indecis} onChange={setIndecis} />

        <Carte titre="Observations" icone={MessageSquareText} accent="orange">
          <Champ label="Points importants à signaler (optionnel)">
            <ZoneTexte
              value={observation}
              onChange={(e) => setObservation(e.target.value)}
              placeholder="Ex : manque de présentoir, délai de paiement demandé, concurrent présent sur la zone..."
              rows={4}
            />
          </Champ>
        </Carte>

        {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-alert">{error}</p>}
      </form>

      <BarreAction>
        <BoutonPrincipal form="visite-form" disabled={submitting || !nom || !villeId}>
          {submitting ? "Enregistrement..." : "Valider la visite"}
        </BoutonPrincipal>
      </BarreAction>
    </main>
  );
}
