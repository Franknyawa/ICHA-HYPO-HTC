"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Users,
  Store,
  MapPin,
  Camera,
  Package,
  Truck,
  Wallet,
  CheckCircle2,
  Clock,
  Droplet,
  Sparkles,
  ChevronDown,
  NotebookPen,
  ArrowLeft,
  Download,
} from "lucide-react";
import { queuePendingVisite } from "@/lib/offline/db";
import { syncPendingVisites } from "@/lib/offline/sync";
import { compressImage } from "@/lib/utils/image";
import { genererFacturePdf } from "@/lib/utils/facture-pdf";

type Ville = { id: string; nom: string };
type TypePV = { id: string; nom: string };
type Produit = {
  id: string;
  code: string;
  nom: string;
  prixSachet: number;
  prixFilet: number | null;
  prixCarton: number;
};
type Session = { nom: string; prenom: string; binomeId: string | null; binomeNom: string | null };

// Palette pour les cartes produit — HYPO/HTC gardent leurs couleurs
// habituelles, tout produit supplémentaire pioche dans la suite plutôt
// que d'hériter systématiquement du style HTC (teal).
const PALETTE_PRODUITS: { couleur: string; fond: string; icone: typeof Droplet }[] = [
  { couleur: "#3b82f6", fond: "#eff6ff", icone: Droplet },
  { couleur: "#0d9488", fond: "#f0fdfa", icone: Sparkles },
  { couleur: "#7c3aed", fond: "#f5f3ff", icone: Package },
  { couleur: "#b45309", fond: "#fffbeb", icone: Package },
  { couleur: "#be123c", fond: "#fff1f2", icone: Package },
];

function styleProduit(index: number) {
  return PALETTE_PRODUITS[index % PALETTE_PRODUITS.length];
}

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

// Coordonnées approximatives des 7 villes couvertes (§25 CDC — cartographie).
// Utilisées pour déduire automatiquement la ville depuis le GPS du
// commercial, sans dépendre d'un service de géocodage externe (aucune clé
// MAP_API_KEY n'est configurée pour l'instant).
const VILLE_COORDS: Record<string, { lat: number; lng: number }> = {
  Douala: { lat: 4.0483, lng: 9.7043 },
  Yaoundé: { lat: 3.848, lng: 11.5021 },
  Bafoussam: { lat: 5.4737, lng: 10.4176 },
  Edéa: { lat: 3.8, lng: 10.1333 },
  Kribi: { lat: 2.9394, lng: 9.9095 },
  Limbé: { lat: 4.0227, lng: 9.2042 },
  Buea: { lat: 4.156, lng: 9.2632 },
};

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
    const coords = VILLE_COORDS[v.nom];
    if (!coords) continue;
    const d = haversineKm(point, coords);
    if (d < bestDist) {
      bestDist = d;
      best = v;
    }
  }
  return best;
}

// --- Composants de mise en forme -------------------------------------------
// Chaque section a sa propre couleur d'accent (icône + liseré) pour qu'on
// s'y repère d'un coup d'œil sur un long formulaire, plutôt que trois blocs
// visuellement identiques.

function SectionHeader({
  icon: Icon,
  title,
  color,
}: {
  icon: React.ElementType;
  title: string;
  color: string;
}) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white"
        style={{ backgroundColor: color }}
      >
        <Icon size={19} strokeWidth={2.25} />
      </span>
      <h2 className="text-base font-bold text-slate-800">{title}</h2>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
      {children}
    </span>
  );
}

function Select({
  value,
  onChange,
  children,
  required,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 py-3 pr-9 text-base text-slate-800"
      >
        {children}
      </select>
      <ChevronDown
        size={18}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
      />
    </div>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      // Bug classique des <input type="number"> : un défilement à la
      // molette pendant que le champ est focus incrémente/décrémente sa
      // valeur silencieusement. On désactive ce comportement en retirant
      // le focus dès qu'un scroll est détecté sur le champ.
      onWheel={(e) => {
        (e.target as HTMLInputElement).blur();
        props.onWheel?.(e);
      }}
      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-base text-slate-800 placeholder:text-slate-400"
    />
  );
}

function ToggleOuiNon({
  value,
  onChange,
}: {
  value: boolean | null;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
      {[
        ["Non", false],
        ["Oui", true],
      ].map(([label, v]) => (
        <button
          type="button"
          key={label as string}
          onClick={() => onChange(v as boolean)}
          className={`rounded-lg px-5 py-2 text-sm font-semibold transition-colors ${
            value === v ? "bg-brand text-white" : "text-slate-500"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export default function NouvelleVisitePage() {
  const router = useRouter();
  const fileInputRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];

  const [session, setSession] = useState<Session | null>(null);
  const [villes, setVilles] = useState<Ville[]>([]);
  const [quartiers, setQuartiers] = useState<{ id: string; nom: string }[]>([]);
  const [quartierModeLibre, setQuartierModeLibre] = useState(false);
  const [types, setTypes] = useState<TypePV[]>([]);
  const [produits, setProduits] = useState<Produit[]>([]);

  const [now] = useState(() => new Date());

  const [nom, setNom] = useState("");
  const [vendeur, setVendeur] = useState("");
  const [telephoneVendeur, setTelephoneVendeur] = useState("");
  const [telephonePatron, setTelephonePatron] = useState("");
  const [villeId, setVilleId] = useState("");
  const [quartierNom, setQuartierNom] = useState("");
  const [repere, setRepere] = useState("");
  const [typeId, setTypeId] = useState("");
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

  const [inclureCommande, setInclureCommande] = useState(false);
  const [quantitesCommande, setQuantitesCommande] = useState<
    Record<string, { sachets: number; filets: number; cartons: number }>
  >({});
  const [commandeDateLivraison, setCommandeDateLivraison] = useState("");

  const [montantEncaisse, setMontantEncaisse] = useState(0);
  // Montant effectivement reçu en cas de crédit partiel — distinct du
  // montant calculé (valeur catalogue), qui sert alors de référence pour
  // calculer le reste à payer.
  const [montantRecu, setMontantRecu] = useState(0);
  const [mobileMoneyConfirme, setMobileMoneyConfirme] = useState(false);
  const [modePaiement, setModePaiement] = useState<
    "ESPECES" | "MOBILE_MONEY" | "CREDIT_PARTIEL" | "CREDIT_TOTAL"
  >("ESPECES");

  const [submitting, setSubmitting] = useState(false);
  const [observation, setObservation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [queuedOffline, setQueuedOffline] = useState(false);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => setSession(d));
    fetch("/api/referentiels")
      .then((r) => r.json())
      .then((d) => {
        setVilles(d.villes ?? []);
        setTypes(d.types ?? []);
        setProduits(d.produits ?? []);
      });
  }, []);

  // Quartiers rechargés dès que la ville change — le quartier n'est plus un
  // champ texte libre mais une liste contrainte à ceux déjà connus pour la
  // ville (limitation assumée : sans coordonnées GPS par quartier, une
  // vraie détection automatique du quartier n'est pas fiable — voir README).
  useEffect(() => {
    if (!villeId) {
      setQuartiers([]);
      return;
    }
    fetch(`/api/referentiels?villeId=${villeId}`)
      .then((r) => r.json())
      .then((d) => setQuartiers(d.quartiers ?? []));
  }, [villeId]);

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

  // Une ligne par produit ayant une quantité saisie — généralisé à
  // n'importe quel nombre de produits actifs (plus limité à HYPO/HTC).
  const lignesVente = produits
    .map((p) => {
      const q = quantites[p.code] ?? { sachets: 0, filets: 0, cartons: 0 };
      if (q.sachets === 0 && q.filets === 0 && q.cartons === 0) return null;
      return { produitCode: p.code, nbSachets: q.sachets, nbFilets: q.filets, nbCartons: q.cartons };
    })
    .filter(Boolean) as { produitCode: string; nbSachets: number; nbFilets: number; nbCartons: number }[];

  // Calcul automatique à partir des quantités saisies et des prix produits
  // (chargés dynamiquement depuis /api/referentiels, jamais codés en dur).
  function sousTotalProduit(p: Produit, q: { sachets: number; filets: number; cartons: number }) {
    return q.sachets * p.prixSachet + q.filets * (p.prixFilet ?? 0) + q.cartons * p.prixCarton;
  }

  const sousTotauxParProduit = new Map(
    produits.map((p) => [p.code, sousTotalProduit(p, quantites[p.code] ?? { sachets: 0, filets: 0, cartons: 0 })])
  );
  const montantCalcule = [...sousTotauxParProduit.values()].reduce((s, v) => s + v, 0);

  // Sous-totaux de la commande à livrer plus tard (mêmes prix, calcul
  // identique à la vente immédiate) — §2 demande de Victor.
  const sousTotauxCommandeParProduit = new Map(
    produits.map((p) => [
      p.code,
      sousTotalProduit(p, quantitesCommande[p.code] ?? { sachets: 0, filets: 0, cartons: 0 }),
    ])
  );
  const montantCommandeCalcule = [...sousTotauxCommandeParProduit.values()].reduce((s, v) => s + v, 0);

  const commandeLignes = produits
    .map((p) => {
      const q = quantitesCommande[p.code] ?? { sachets: 0, filets: 0, cartons: 0 };
      if (q.sachets === 0 && q.filets === 0 && q.cartons === 0) return null;
      return { produitCode: p.code, nbSachets: q.sachets, nbFilets: q.filets, nbCartons: q.cartons };
    })
    .filter(Boolean) as { produitCode: string; nbSachets: number; nbFilets: number; nbCartons: number }[];

  // Logique par mode de paiement (§1 demande de Victor) :
  // - Espèces : le montant calculé est versé intégralement, encaissé tout
  //   de suite.
  // - Mobile Money : pas de saisie manuelle, juste une confirmation que le
  //   montant calculé a bien été reçu par OM/MoMo.
  // - Crédit partiel : le commercial saisit ce qu'il a réellement reçu ;
  //   le reste dû est calculé automatiquement.
  // - Crédit total : rien n'est perçu maintenant, tout reste dû.
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
      ? (mobileMoneyConfirme ? montantCalcule : 0)
      : modePaiement === "CREDIT_PARTIEL"
      ? montantRecu
      : 0; // CREDIT_TOTAL

  useEffect(() => {
    setMontantEncaisse(montantEffectivementRecu);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [montantEffectivementRecu]);

  // Auto-détection du présentoir (demande de Victor) : si les sachets
  // dépassent 30 ET les cartons dépassent 1 pour l'un des produits actifs
  // (plus limité à HYPO/HTC), on marque "Oui" automatiquement. Reste
  // modifiable ensuite — c'est une suggestion, pas un verrou.
  useEffect(() => {
    const unProduitQualifie = Object.values(quantites).some(
      (q) => q.sachets > 30 && q.cartons > 1
    );
    if (unProduitQualifie && presentoir !== true) {
      setPresentoir(true);
      setPresentoirAuto(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quantites]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const visiteUuid = uuid();
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
        vendeur: vendeur || undefined,
        telephoneVendeur: telephoneVendeur || undefined,
        telephonePatron: telephonePatron || undefined,
        villeId,
        quartierNom: quartierNom || undefined,
        typeId: typeId || undefined,
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
                montant: montantEffectivementRecu,
                modePaiement,
              },
            },
          }
        : {}),
      ...(inclureCommande && commandeLignes.length > 0
        ? {
            commande: {
              uuidClient: uuid(),
              lignes: commandeLignes,
              dateLivraisonPrevue: commandeDateLivraison
                ? new Date(commandeDateLivraison).toISOString()
                : undefined,
            },
          }
        : {}),
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

      setSuccess(true);
      if (lignesVente.length === 0) {
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

  const [facturePdfLoading, setFacturePdfLoading] = useState(false);

  async function telechargerFacture() {
    setFacturePdfLoading(true);
    try {
      const modeLabel = {
        ESPECES: "Espèces",
        MOBILE_MONEY: "Mobile Money",
        CREDIT_PARTIEL: "Crédit partiel",
        CREDIT_TOTAL: "Crédit total",
      }[modePaiement];

      await genererFacturePdf({
        numero: new Date().toISOString().slice(0, 10).replace(/-/g, ""),
        date: new Date(),
        pointVenteNom: nom || "—",
        villeNom: villes.find((v) => v.id === villeId)?.nom ?? null,
        commercialNom: session ? `${session.prenom} ${session.nom}` : "—",
        lignes: lignesVente,
        montantTotal: montantCalcule,
        modePaiementLabel: modeLabel,
        montantRecu: montantEffectivementRecu,
        resteAPayer: resteAPayer > 0 ? resteAPayer : undefined,
      });
    } finally {
      setFacturePdfLoading(false);
    }
  }

  if (success) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="max-w-sm rounded-2xl bg-white px-8 py-10 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-600">
            <CheckCircle2 size={30} />
          </div>
          <p className="mb-4 font-semibold text-slate-800">Visite enregistrée avec succès</p>
          {lignesVente.length > 0 && (
            <div className="space-y-2">
              <button
                onClick={telechargerFacture}
                disabled={facturePdfLoading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                <Download size={16} />
                {facturePdfLoading ? "Génération..." : "Télécharger la facture"}
              </button>
              <button
                onClick={() => router.push("/dashboard")}
                className="w-full rounded-xl bg-slate-100 py-3 text-sm font-medium text-slate-600"
              >
                Retour à l'accueil
              </button>
            </div>
          )}
        </div>
      </main>
    );
  }

  if (queuedOffline) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="max-w-sm rounded-2xl bg-white px-8 py-10 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            <Clock size={28} />
          </div>
          <p className="mb-2 font-semibold text-amber-800">
            Données en attente de synchronisation
          </p>
          <p className="mb-5 text-sm text-slate-500">
            La visite a été enregistrée sur ton téléphone et sera envoyée
            automatiquement dès que la connexion reviendra.
          </p>
          <button
            onClick={() => router.push("/dashboard")}
            className="rounded-xl bg-amber-600 px-5 py-2.5 text-sm font-medium text-white"
          >
            Retour au dashboard
          </button>
        </div>
      </main>
    );
  }

  const step2Done = Boolean(nom && villeId);
  const step3Started = lignesVente.length > 0 || inclureCommande;

  return (
    <main className="min-h-screen bg-slate-50 pb-28">
      {/* En-tête — dégradé + motif de points, identité visuelle marquée
          plutôt qu'un simple bandeau plat. */}
      <div
        className="relative overflow-hidden px-4 pb-7 pt-6 text-white"
        style={{ background: "linear-gradient(135deg, #1e3a8a 0%, #1e40af 55%, #2563eb 100%)" }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.15]"
          style={{
            backgroundImage:
              "radial-gradient(circle, white 1px, transparent 1px)",
            backgroundSize: "16px 16px",
          }}
        />
        <div className="relative">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15">
                <Droplet size={16} />
              </span>
              <p className="text-xs font-bold uppercase tracking-widest text-blue-100">
                HYPO / HTC / ICHA IMPORT
              </p>
            </div>
            <Link
              href="/dashboard"
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15"
              aria-label="Retour à l'accueil"
            >
              <ArrowLeft size={16} />
            </Link>
          </div>
          <h1 className="text-2xl font-extrabold">Nouveau recensement</h1>
          <p className="mt-1 text-sm text-blue-100">Recensement terrain du jour</p>

          <div className="mt-5 flex gap-2">
            <div className="h-1.5 flex-1 rounded-full bg-white" />
            <div className={`h-1.5 flex-1 rounded-full ${step2Done ? "bg-white" : "bg-white/30"}`} />
            <div className={`h-1.5 flex-1 rounded-full ${step3Started ? "bg-white" : "bg-white/30"}`} />
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} id="visite-form" className="-mt-3 space-y-4 px-4 pt-1">
        {/* 1. Informations sur l'équipe */}
        <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
          <SectionHeader icon={Users} title="Informations équipe" color="#4338ca" />
          <div className="mb-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-indigo-50/70 px-3 py-2.5">
              <FieldLabel>Date</FieldLabel>
              <p className="text-sm font-semibold text-slate-700">
                {now.toLocaleDateString("fr-FR")}
              </p>
            </div>
            <div className="rounded-xl bg-indigo-50/70 px-3 py-2.5">
              <FieldLabel>Heure</FieldLabel>
              <p className="text-sm font-semibold text-slate-700">
                {now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>

          <div className="mb-4 rounded-xl bg-indigo-50/70 px-3 py-2.5">
            <FieldLabel>Agent commercial</FieldLabel>
            <p className="text-sm font-semibold text-slate-700">
              {session ? `${session.prenom} ${session.nom}` : "..."}
            </p>
          </div>

          <div className="rounded-xl bg-indigo-50/70 px-3 py-2.5">
            <FieldLabel>Binôme</FieldLabel>
            <p className="text-sm font-semibold text-slate-700">
              {session?.binomeNom ?? "Non assigné — contacte ton administrateur"}
            </p>
          </div>
        </section>

        {/* 2. Point de vente */}
        <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
          <SectionHeader icon={Store} title="Point de vente" color="#1e40af" />
          <div className="space-y-3">
            <div>
              <FieldLabel>Position GPS</FieldLabel>
              <button
                type="button"
                onClick={captureGps}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-50/70 py-3 text-sm font-semibold text-brand"
              >
                <MapPin size={18} />
                {gps ? "Position mise à jour" : "Récupérer la position (détecte la ville)"}
              </button>
              {gps && (
                <p className="mt-1.5 text-xs text-slate-400">
                  {gps.lat.toFixed(5)}, {gps.lng.toFixed(5)} (± {Math.round(gps.precision)}m)
                </p>
              )}
              {gpsError && <p className="mt-1.5 text-xs text-alert">{gpsError}</p>}
            </div>

            <div>
              <FieldLabel>Nom du point de vente</FieldLabel>
              <TextInput
                placeholder="Ex : Boutique Grâce"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                required
              />
            </div>
            <div>
              <FieldLabel>Nom du vendeur (optionnel)</FieldLabel>
              <TextInput
                placeholder="Laisser vide si non communiqué"
                value={vendeur}
                onChange={(e) => setVendeur(e.target.value)}
              />
            </div>
            <div>
              <FieldLabel>Téléphone du vendeur (WhatsApp)</FieldLabel>
              <TextInput
                type="tel"
                placeholder="Ex : 6XX XX XX XX"
                value={telephoneVendeur}
                onChange={(e) => setTelephoneVendeur(e.target.value)}
              />
            </div>

            <div>
              <FieldLabel>Numéro WhatsApp du patron (si différent)</FieldLabel>
              <TextInput
                type="tel"
                placeholder="Ex : 6XX XX XX XX"
                value={telephonePatron}
                onChange={(e) => setTelephonePatron(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <FieldLabel>Ville</FieldLabel>
                  {villeAuto && villeId && (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">
                      Détectée par GPS
                    </span>
                  )}
                </div>
                <Select
                  value={villeId}
                  onChange={(v) => {
                    setVilleId(v);
                    setVilleAuto(false);
                    setQuartierNom("");
                    setQuartierModeLibre(false);
                  }}
                  required
                >
                  <option value="">Choisir...</option>
                  {villes.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.nom}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <FieldLabel>Quartier</FieldLabel>
                {quartierModeLibre || quartiers.length === 0 ? (
                  <TextInput
                    placeholder="Ex : Akwa"
                    value={quartierNom}
                    onChange={(e) => setQuartierNom(e.target.value)}
                  />
                ) : (
                  <Select
                    value={quartierNom}
                    onChange={(v) => {
                      if (v === "__autre__") {
                        setQuartierModeLibre(true);
                        setQuartierNom("");
                      } else {
                        setQuartierNom(v);
                      }
                    }}
                  >
                    <option value="">Choisir...</option>
                    {quartiers.map((q) => (
                      <option key={q.id} value={q.nom}>
                        {q.nom}
                      </option>
                    ))}
                    <option value="__autre__">+ Autre / nouveau quartier</option>
                  </Select>
                )}
              </div>
            </div>

            <div>
              <FieldLabel>Repère exact</FieldLabel>
              <TextInput
                placeholder="Ex : PK8 entrée Lycée"
                value={repere}
                onChange={(e) => setRepere(e.target.value)}
              />
            </div>

            <div>
              <FieldLabel>Type de boutique</FieldLabel>
              <Select value={typeId} onChange={setTypeId}>
                <option value="">Choisir...</option>
                {types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nom}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <FieldLabel>Photos de la devanture (2)</FieldLabel>
              <div className="grid grid-cols-2 gap-2.5">
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
                        <img
                          src={photoPreviews[index]!}
                          alt={`Devanture ${index + 1}`}
                          className="h-32 w-full object-cover"
                        />
                        <span className="absolute bottom-1.5 right-1.5 rounded-lg bg-black/60 px-2 py-1 text-[10px] font-medium text-white">
                          Reprendre
                        </span>
                        {photoUploading[index] && (
                          <span className="absolute left-1.5 top-1.5 rounded-lg bg-black/60 px-2 py-1 text-[10px] font-medium text-white">
                            Envoi...
                          </span>
                        )}
                        {photoUrls[index] && !photoUploading[index] && (
                          <span className="absolute left-1.5 top-1.5 rounded-lg bg-green-600/90 px-2 py-1 text-[10px] font-medium text-white">
                            ✓ Envoyée
                          </span>
                        )}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => fileInputRefs[index].current?.click()}
                        className="flex h-32 w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-blue-200 bg-blue-50/40 text-xs font-semibold text-brand"
                      >
                        <Camera size={20} />
                        Photo {index + 1}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 3. Achat / commande du jour */}
        <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
          <SectionHeader icon={Package} title="Achat / commande du jour" color="#0f766e" />

          {produits.map((p, index) => {
            const q = quantites[p.code] ?? { sachets: 0, filets: 0, cartons: 0 };
            const sousTotal = sousTotauxParProduit.get(p.code) ?? 0;
            const { couleur, fond, icone: Icone } = styleProduit(index);
            return (
              <div
                key={p.id}
                className="mb-3 rounded-xl border-l-4 p-3"
                style={{ borderColor: couleur, backgroundColor: fond }}
              >
                <div className="mb-1 flex items-center gap-2">
                  <Icone size={16} style={{ color: couleur }} />
                  <p className="text-sm font-bold text-slate-800">{p.nom || p.code}</p>
                </div>
                <div className={`grid gap-2.5 ${p.prixFilet !== null ? "grid-cols-3" : "grid-cols-2"}`}>
                  <div>
                    <FieldLabel>Sachets</FieldLabel>
                    <TextInput
                      type="number"
                      min={0}
                      value={q.sachets || ""}
                      onChange={(e) =>
                        updateQuantite(setQuantites, p.code, "sachets", Number(e.target.value) || 0)
                      }
                    />
                  </div>
                  {p.prixFilet !== null && (
                    <div>
                      <FieldLabel>Filets</FieldLabel>
                      <TextInput
                        type="number"
                        min={0}
                        value={q.filets || ""}
                        onChange={(e) =>
                          updateQuantite(setQuantites, p.code, "filets", Number(e.target.value) || 0)
                        }
                      />
                    </div>
                  )}
                  <div>
                    <FieldLabel>Cartons</FieldLabel>
                    <TextInput
                      type="number"
                      min={0}
                      value={q.cartons || ""}
                      onChange={(e) =>
                        updateQuantite(setQuantites, p.code, "cartons", Number(e.target.value) || 0)
                      }
                    />
                  </div>
                </div>
                {sousTotal > 0 && (
                  <p className="mt-2.5 text-right text-sm font-bold" style={{ color: couleur }}>
                    Sous-total : {sousTotal.toLocaleString("fr-FR")} FCFA
                  </p>
                )}
              </div>
            );
          })}

          {/* Présentoir — positionné après l'achat du jour et pré-rempli
              automatiquement selon les quantités saisies (§ demande de
              Victor), mais reste modifiable. */}
          <div className="mb-4 flex items-center justify-between rounded-xl bg-blue-50/70 px-3 py-2.5">
            <div>
              <span className="text-sm font-semibold text-slate-700">
                Installation du présentoir
              </span>
              {presentoirAuto && presentoir === true && (
                <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">
                  Suggéré automatiquement
                </span>
              )}
            </div>
            <ToggleOuiNon
              value={presentoir}
              onChange={(v) => {
                setPresentoir(v);
                setPresentoirAuto(false);
              }}
            />
          </div>

          {/* Mode de paiement — chaque mode a son propre comportement
              (§1 demande de Victor). La validation du formulaire n'est
              jamais bloquée par ces champs. */}
          <div className="mb-3">
            <FieldLabel>Mode de paiement</FieldLabel>
            <Select value={modePaiement} onChange={(v) => setModePaiement(v as typeof modePaiement)}>
              <option value="ESPECES">Espèces</option>
              <option value="MOBILE_MONEY">Mobile Money</option>
              <option value="CREDIT_PARTIEL">Crédit partiel</option>
              <option value="CREDIT_TOTAL">Crédit total</option>
            </Select>
          </div>

          {modePaiement === "ESPECES" && (
            <div className="mb-4 rounded-xl bg-slate-50 px-3 py-2.5">
              <div className="mb-1 flex items-center justify-between">
                <FieldLabel>Montant à percevoir (FCFA)</FieldLabel>
                <span className="text-[10px] font-semibold text-teal-700">
                  Calculé automatiquement
                </span>
              </div>
              <p className="flex items-center gap-2 text-lg font-bold text-slate-800">
                <Wallet size={18} className="text-slate-400" />
                {montantCalcule.toLocaleString("fr-FR")} FCFA
              </p>
            </div>
          )}

          {modePaiement === "MOBILE_MONEY" && (
            <div className="mb-4 rounded-xl bg-slate-50 px-3 py-2.5">
              <p className="mb-2 text-sm text-slate-600">
                Montant à percevoir :{" "}
                <span className="font-bold text-slate-800">
                  {montantCalcule.toLocaleString("fr-FR")} FCFA
                </span>
              </p>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={mobileMoneyConfirme}
                  onChange={(e) => setMobileMoneyConfirme(e.target.checked)}
                  className="h-5 w-5 accent-brand"
                />
                Le paiement de {montantCalcule.toLocaleString("fr-FR")} FCFA a
                été reçu par Mobile Money
              </label>
            </div>
          )}

          {modePaiement === "CREDIT_PARTIEL" && (
            <div className="mb-4 space-y-2.5 rounded-xl bg-slate-50 px-3 py-2.5">
              <p className="text-sm text-slate-600">
                Total dû :{" "}
                <span className="font-bold text-slate-800">
                  {montantCalcule.toLocaleString("fr-FR")} FCFA
                </span>
              </p>
              <div>
                <FieldLabel>Montant reçu du client (FCFA)</FieldLabel>
                <input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={montantRecu || ""}
                  onChange={(e) => setMontantRecu(Number(e.target.value) || 0)}
                  onWheel={(e) => (e.target as HTMLInputElement).blur()}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-base text-slate-800"
                />
              </div>
              {resteAPayer > 0 && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700">
                  Reste à payer : {resteAPayer.toLocaleString("fr-FR")} FCFA — sera
                  suivi sur ton profil
                </p>
              )}
            </div>
          )}

          {modePaiement === "CREDIT_TOTAL" && (
            <div className="mb-4 rounded-xl bg-amber-50 px-3 py-2.5">
              <p className="text-sm font-semibold text-amber-700">
                Montant intégralement à crédit :{" "}
                {montantCalcule.toLocaleString("fr-FR")} FCFA — sera suivi sur
                ton profil après enregistrement
              </p>
            </div>
          )}

          {/* Commande à livrer plus tard — placée en dernier (§2 demande
              de Victor), mêmes champs détaillés que l'achat du jour. */}
          <label className="mb-3 flex items-center justify-between rounded-xl bg-teal-50/60 px-3 py-2.5">
            <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Truck size={17} className="text-teal-700" />
              Le client passe une commande
            </span>
            <input
              type="checkbox"
              checked={inclureCommande}
              onChange={(e) => setInclureCommande(e.target.checked)}
              className="h-5 w-5 accent-teal-700"
            />
          </label>

          {inclureCommande && (
            <div className="space-y-3 rounded-xl border border-teal-100 bg-teal-50/30 p-3">
              {produits.map((p, index) => {
                const q = quantitesCommande[p.code] ?? { sachets: 0, filets: 0, cartons: 0 };
                const sousTotal = sousTotauxCommandeParProduit.get(p.code) ?? 0;
                const { couleur, fond, icone: Icone } = styleProduit(index);
                return (
                  <div
                    key={p.id}
                    className="rounded-xl border-l-4 p-3"
                    style={{ borderColor: couleur, backgroundColor: fond }}
                  >
                    <div className="mb-1 flex items-center gap-2">
                      <Icone size={16} style={{ color: couleur }} />
                      <p className="text-sm font-bold text-slate-800">{p.nom || p.code}</p>
                    </div>
                    <div className={`grid gap-2.5 ${p.prixFilet !== null ? "grid-cols-3" : "grid-cols-2"}`}>
                      <div>
                        <FieldLabel>Sachets</FieldLabel>
                        <TextInput
                          type="number"
                          min={0}
                          value={q.sachets || ""}
                          onChange={(e) =>
                            updateQuantite(setQuantitesCommande, p.code, "sachets", Number(e.target.value) || 0)
                          }
                        />
                      </div>
                      {p.prixFilet !== null && (
                        <div>
                          <FieldLabel>Filets</FieldLabel>
                          <TextInput
                            type="number"
                            min={0}
                            value={q.filets || ""}
                            onChange={(e) =>
                              updateQuantite(setQuantitesCommande, p.code, "filets", Number(e.target.value) || 0)
                            }
                          />
                        </div>
                      )}
                      <div>
                        <FieldLabel>Cartons</FieldLabel>
                        <TextInput
                          type="number"
                          min={0}
                          value={q.cartons || ""}
                          onChange={(e) =>
                            updateQuantite(setQuantitesCommande, p.code, "cartons", Number(e.target.value) || 0)
                          }
                        />
                      </div>
                    </div>
                    {sousTotal > 0 && (
                      <p className="mt-2 text-right text-sm font-bold" style={{ color: couleur }}>
                        Sous-total : {sousTotal.toLocaleString("fr-FR")} FCFA
                      </p>
                    )}
                  </div>
                );
              })}

              <div>
                <FieldLabel>Date de livraison prévue</FieldLabel>
                <TextInput
                  type="date"
                  value={commandeDateLivraison}
                  onChange={(e) => setCommandeDateLivraison(e.target.value)}
                />
              </div>

              {montantCommandeCalcule > 0 && (
                <p className="rounded-lg bg-white px-3 py-2 text-right text-sm font-bold text-slate-800">
                  À percevoir à la livraison :{" "}
                  {montantCommandeCalcule.toLocaleString("fr-FR")} FCFA
                </p>
              )}
            </div>
          )}
        </section>

        {/* 4. Observations */}
        <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
          <SectionHeader icon={NotebookPen} title="Observations" color="#7c3aed" />
          <FieldLabel>
            Points importants à signaler (optionnel)
          </FieldLabel>
          <textarea
            value={observation}
            onChange={(e) => setObservation(e.target.value)}
            placeholder="Ex : le point de vente manque de présentoir, le client a demandé un délai de paiement, concurrent présent sur la zone..."
            rows={4}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-base text-slate-800 placeholder:text-slate-400"
          />
        </section>

        {error && (
          <p className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-alert">{error}</p>
        )}
      </form>

      {/* Barre d'action fixe — toujours accessible sur mobile, même en
          bas d'un long formulaire (§26 CDC : ergonomie tactile). */}
      <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white/95 p-3 backdrop-blur">
        <button
          type="submit"
          form="visite-form"
          disabled={submitting || !nom || !villeId}
          className="w-full rounded-xl py-3.5 text-base font-bold text-white shadow-md disabled:opacity-50"
          style={{ background: "linear-gradient(135deg, #1e40af, #2563eb)" }}
        >
          {submitting ? "Enregistrement..." : "Valider la visite"}
        </button>
      </div>
    </main>
  );
}
