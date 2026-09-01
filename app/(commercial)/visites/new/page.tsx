"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
} from "lucide-react";
import { queuePendingVisite } from "@/lib/offline/db";
import { syncPendingVisites } from "@/lib/offline/sync";
import { compressImage } from "@/lib/utils/image";

type Ville = { id: string; nom: string };
type TypePV = { id: string; nom: string };
type Binome = { id: string; nom: string };
type Produit = {
  id: string;
  code: "HYPO" | "HTC";
  prixSachet: number;
  prixFilet: number | null;
  prixCarton: number;
};
type Session = { nom: string; prenom: string; binomeId: string | null };

function uuid() {
  return crypto.randomUUID();
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [session, setSession] = useState<Session | null>(null);
  const [villes, setVilles] = useState<Ville[]>([]);
  const [types, setTypes] = useState<TypePV[]>([]);
  const [binomes, setBinomes] = useState<Binome[]>([]);
  const [produits, setProduits] = useState<Produit[]>([]);

  const [now] = useState(() => new Date());

  const [binomeId, setBinomeId] = useState("");

  const [nom, setNom] = useState("");
  const [vendeur, setVendeur] = useState("");
  const [telephoneVendeur, setTelephoneVendeur] = useState("");
  const [villeId, setVilleId] = useState("");
  const [quartierNom, setQuartierNom] = useState("");
  const [repere, setRepere] = useState("");
  const [typeId, setTypeId] = useState("");
  const [presentoir, setPresentoir] = useState<boolean | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoUuid, setPhotoUuid] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [gps, setGps] = useState<{ lat: number; lng: number; precision: number } | null>(
    null
  );
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [villeAuto, setVilleAuto] = useState(false);

  const [hypoSachets, setHypoSachets] = useState(0);
  const [hypoCartons, setHypoCartons] = useState(0);
  const [htcSachets, setHtcSachets] = useState(0);
  const [htcFilets, setHtcFilets] = useState(0);
  const [htcCartons, setHtcCartons] = useState(0);

  const [inclureCommande, setInclureCommande] = useState(false);
  const [commandeHypoSachets, setCommandeHypoSachets] = useState(0);
  const [commandeHypoCartons, setCommandeHypoCartons] = useState(0);
  const [commandeHtcSachets, setCommandeHtcSachets] = useState(0);
  const [commandeHtcFilets, setCommandeHtcFilets] = useState(0);
  const [commandeHtcCartons, setCommandeHtcCartons] = useState(0);
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
      .then((d) => {
        setSession(d);
        if (d.binomeId) setBinomeId(d.binomeId);
      });
    fetch("/api/referentiels")
      .then((r) => r.json())
      .then((d) => {
        setVilles(d.villes ?? []);
        setTypes(d.types ?? []);
        setBinomes(d.binomes ?? []);
        setProduits(d.produits ?? []);
      });
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

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await compressImage(file, 1280, 0.7);
    setPhotoPreview(dataUrl);
    setPhotoUrl(null);

    const newUuid = uuid();
    setPhotoUuid(newUuid);

    // Upload immédiat vers le stockage objet si le réseau est disponible —
    // seule l'URL réelle sera envoyée avec la visite, jamais le contenu de
    // la photo en base (§12 doc scalabilité). Si l'upload échoue (hors
    // ligne, stockage non configuré), on garde le data URL en repli : la
    // visite continue de fonctionner, avec la limitation documentée dans le
    // README (photo alors stockée en base, à éviter en usage prolongé).
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
        // Échec silencieux : le data URL en mémoire prend le relais.
      } finally {
        setPhotoUploading(false);
      }
    }
  }

  const hypoLigne =
    hypoSachets > 0 || hypoCartons > 0
      ? { produitCode: "HYPO" as const, nbSachets: hypoSachets, nbFilets: 0, nbCartons: hypoCartons }
      : null;
  const htcLigne =
    htcSachets > 0 || htcFilets > 0 || htcCartons > 0
      ? {
          produitCode: "HTC" as const,
          nbSachets: htcSachets,
          nbFilets: htcFilets,
          nbCartons: htcCartons,
        }
      : null;
  const lignesVente = [hypoLigne, htcLigne].filter(Boolean) as NonNullable<
    typeof hypoLigne
  >[];

  // Calcul automatique à partir des quantités saisies et des prix produits
  // (75 FCFA/sachet HYPO, 8400/carton HYPO, 75/sachet HTC, 750/filet HTC,
  // 9000/carton HTC — chargés dynamiquement, jamais codés en dur ici).
  // Sous-total par ligne (affiché sur chaque carte produit) + total global
  // (champ "Montant encaissé", qui reste modifiable ensuite, ex: remise).
  const hypoProduit = produits.find((p) => p.code === "HYPO");
  const htcProduit = produits.find((p) => p.code === "HTC");

  const sousTotalHypo = hypoProduit
    ? hypoSachets * hypoProduit.prixSachet + hypoCartons * hypoProduit.prixCarton
    : 0;
  const sousTotalHtc = htcProduit
    ? htcSachets * htcProduit.prixSachet +
      htcFilets * (htcProduit.prixFilet ?? 0) +
      htcCartons * htcProduit.prixCarton
    : 0;
  const montantCalcule = sousTotalHypo + sousTotalHtc;

  // Sous-totaux de la commande à livrer plus tard (mêmes prix, calcul
  // identique à la vente immédiate) — §2 demande de Victor.
  const sousTotalCommandeHypo = hypoProduit
    ? commandeHypoSachets * hypoProduit.prixSachet + commandeHypoCartons * hypoProduit.prixCarton
    : 0;
  const sousTotalCommandeHtc = htcProduit
    ? commandeHtcSachets * htcProduit.prixSachet +
      commandeHtcFilets * (htcProduit.prixFilet ?? 0) +
      commandeHtcCartons * htcProduit.prixCarton
    : 0;
  const montantCommandeCalcule = sousTotalCommandeHypo + sousTotalCommandeHtc;

  const commandeHypoLigne =
    commandeHypoSachets > 0 || commandeHypoCartons > 0
      ? {
          produitCode: "HYPO" as const,
          nbSachets: commandeHypoSachets,
          nbFilets: 0,
          nbCartons: commandeHypoCartons,
        }
      : null;
  const commandeHtcLigne =
    commandeHtcSachets > 0 || commandeHtcFilets > 0 || commandeHtcCartons > 0
      ? {
          produitCode: "HTC" as const,
          nbSachets: commandeHtcSachets,
          nbFilets: commandeHtcFilets,
          nbCartons: commandeHtcCartons,
        }
      : null;
  const commandeLignes = [commandeHypoLigne, commandeHtcLigne].filter(
    Boolean
  ) as NonNullable<typeof commandeHypoLigne>[];

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const visiteUuid = uuid();
    const payload = {
      uuidClient: visiteUuid,
      binomeId: binomeId || undefined,
      dateVisite: new Date().toISOString(),
      latitude: gps?.lat ?? null,
      longitude: gps?.lng ?? null,
      precisionGps: gps?.precision ?? null,
      nouveauPointVente: {
        uuidClient: uuid(),
        nom,
        vendeur: vendeur || undefined,
        telephoneVendeur: telephoneVendeur || undefined,
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
      photos: photoUrl
        ? [{ uuidClient: photoUuid!, url: photoUrl, type: "DEVANTURE" }]
        : photoPreview
        ? [{ uuidClient: photoUuid ?? uuid(), url: photoPreview, type: "DEVANTURE" }]
        : [],
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
      setTimeout(() => router.push("/dashboard"), 1200);
    } catch {
      await queuePendingVisite(visiteUuid, payload);
      setQueuedOffline(true);
      syncPendingVisites();
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="max-w-sm rounded-2xl bg-white px-8 py-10 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-600">
            <CheckCircle2 size={30} />
          </div>
          <p className="font-semibold text-slate-800">Visite enregistrée avec succès</p>
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
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15">
              <Droplet size={16} />
            </span>
            <p className="text-xs font-bold uppercase tracking-widest text-blue-100">
              HYPO / HTC / ICHA IMPORT
            </p>
          </div>
          <h1 className="text-2xl font-extrabold">Nouvelle visite</h1>
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

          <FieldLabel>Binôme</FieldLabel>
          <Select value={binomeId} onChange={setBinomeId} required>
            <option value="">Sélectionner...</option>
            {binomes.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nom}
              </option>
            ))}
          </Select>
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
                <TextInput
                  placeholder="Ex : Akwa"
                  value={quartierNom}
                  onChange={(e) => setQuartierNom(e.target.value)}
                />
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

            <div className="flex items-center justify-between rounded-xl bg-blue-50/70 px-3 py-2.5">
              <span className="text-sm font-semibold text-slate-700">
                Installation du présentoir
              </span>
              <ToggleOuiNon value={presentoir} onChange={setPresentoir} />
            </div>

            <div>
              <FieldLabel>Photo de la devanture</FieldLabel>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoChange}
                className="hidden"
              />
              {photoPreview ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="relative block w-full overflow-hidden rounded-xl"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photoPreview} alt="Devanture" className="h-40 w-full object-cover" />
                  <span className="absolute bottom-2 right-2 rounded-lg bg-black/60 px-2.5 py-1 text-xs font-medium text-white">
                    Reprendre
                  </span>
                  {photoUploading && (
                    <span className="absolute left-2 top-2 rounded-lg bg-black/60 px-2.5 py-1 text-xs font-medium text-white">
                      Envoi en cours...
                    </span>
                  )}
                  {photoUrl && !photoUploading && (
                    <span className="absolute left-2 top-2 rounded-lg bg-green-600/90 px-2.5 py-1 text-xs font-medium text-white">
                      ✓ Envoyée
                    </span>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-blue-200 bg-blue-50/40 py-7 text-sm font-semibold text-brand"
                >
                  <Camera size={22} />
                  Prendre une photo
                </button>
              )}
            </div>
          </div>
        </section>

        {/* 3. Achat / commande du jour */}
        <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
          <SectionHeader icon={Package} title="Achat / commande du jour" color="#0f766e" />

          <div className="mb-3 rounded-xl border-l-4 border-blue-500 bg-blue-50/50 p-3">
            <div className="mb-1 flex items-center gap-2">
              <Droplet size={16} className="text-blue-600" />
              <p className="text-sm font-bold text-slate-800">HYPO</p>
            </div>
            <p className="mb-2.5 text-xs text-slate-500">75ml · 112 sachets/carton</p>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <FieldLabel>Sachets</FieldLabel>
                <TextInput
                  type="number"
                  min={0}
                  value={hypoSachets || ""}
                  onChange={(e) => setHypoSachets(Number(e.target.value) || 0)}
                />
              </div>
              <div>
                <FieldLabel>Cartons</FieldLabel>
                <TextInput
                  type="number"
                  min={0}
                  value={hypoCartons || ""}
                  onChange={(e) => setHypoCartons(Number(e.target.value) || 0)}
                />
              </div>
            </div>
            {sousTotalHypo > 0 && (
              <p className="mt-2.5 text-right text-sm font-bold text-blue-700">
                Sous-total : {sousTotalHypo.toLocaleString("fr-FR")} FCFA
              </p>
            )}
          </div>

          <div className="mb-4 rounded-xl border-l-4 border-teal-600 bg-teal-50/50 p-3">
            <div className="mb-1 flex items-center gap-2">
              <Sparkles size={16} className="text-teal-700" />
              <p className="text-sm font-bold text-slate-800">HTC</p>
            </div>
            <p className="mb-2.5 text-xs text-slate-500">
              60ml · 12 filets de 10 sachets · 120 sachets/carton
            </p>
            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <FieldLabel>Sachets</FieldLabel>
                <TextInput
                  type="number"
                  min={0}
                  value={htcSachets || ""}
                  onChange={(e) => setHtcSachets(Number(e.target.value) || 0)}
                />
              </div>
              <div>
                <FieldLabel>Filets</FieldLabel>
                <TextInput
                  type="number"
                  min={0}
                  value={htcFilets || ""}
                  onChange={(e) => setHtcFilets(Number(e.target.value) || 0)}
                />
              </div>
              <div>
                <FieldLabel>Cartons</FieldLabel>
                <TextInput
                  type="number"
                  min={0}
                  value={htcCartons || ""}
                  onChange={(e) => setHtcCartons(Number(e.target.value) || 0)}
                />
              </div>
            </div>
            {sousTotalHtc > 0 && (
              <p className="mt-2.5 text-right text-sm font-bold text-teal-700">
                Sous-total : {sousTotalHtc.toLocaleString("fr-FR")} FCFA
              </p>
            )}
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
              <div className="rounded-xl border-l-4 border-blue-500 bg-blue-50/50 p-3">
                <div className="mb-1 flex items-center gap-2">
                  <Droplet size={16} className="text-blue-600" />
                  <p className="text-sm font-bold text-slate-800">HYPO</p>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <FieldLabel>Sachets</FieldLabel>
                    <TextInput
                      type="number"
                      min={0}
                      value={commandeHypoSachets || ""}
                      onChange={(e) =>
                        setCommandeHypoSachets(Number(e.target.value) || 0)
                      }
                    />
                  </div>
                  <div>
                    <FieldLabel>Cartons</FieldLabel>
                    <TextInput
                      type="number"
                      min={0}
                      value={commandeHypoCartons || ""}
                      onChange={(e) =>
                        setCommandeHypoCartons(Number(e.target.value) || 0)
                      }
                    />
                  </div>
                </div>
                {sousTotalCommandeHypo > 0 && (
                  <p className="mt-2 text-right text-sm font-bold text-blue-700">
                    Sous-total : {sousTotalCommandeHypo.toLocaleString("fr-FR")} FCFA
                  </p>
                )}
              </div>

              <div className="rounded-xl border-l-4 border-teal-600 bg-teal-50/50 p-3">
                <div className="mb-1 flex items-center gap-2">
                  <Sparkles size={16} className="text-teal-700" />
                  <p className="text-sm font-bold text-slate-800">HTC</p>
                </div>
                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <FieldLabel>Sachets</FieldLabel>
                    <TextInput
                      type="number"
                      min={0}
                      value={commandeHtcSachets || ""}
                      onChange={(e) =>
                        setCommandeHtcSachets(Number(e.target.value) || 0)
                      }
                    />
                  </div>
                  <div>
                    <FieldLabel>Filets</FieldLabel>
                    <TextInput
                      type="number"
                      min={0}
                      value={commandeHtcFilets || ""}
                      onChange={(e) =>
                        setCommandeHtcFilets(Number(e.target.value) || 0)
                      }
                    />
                  </div>
                  <div>
                    <FieldLabel>Cartons</FieldLabel>
                    <TextInput
                      type="number"
                      min={0}
                      value={commandeHtcCartons || ""}
                      onChange={(e) =>
                        setCommandeHtcCartons(Number(e.target.value) || 0)
                      }
                    />
                  </div>
                </div>
                {sousTotalCommandeHtc > 0 && (
                  <p className="mt-2 text-right text-sm font-bold text-teal-700">
                    Sous-total : {sousTotalCommandeHtc.toLocaleString("fr-FR")} FCFA
                  </p>
                )}
              </div>

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
