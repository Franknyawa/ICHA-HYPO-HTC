"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { apiFetch, ApiError } from "@/lib/client/apiFetch";
import { formatFcfa } from "@/lib/utils/format";
import {
  Package,
  AlertTriangle,
  CheckCircle2,
  Pencil,
  Check,
  X,
  RefreshCw,
  ClipboardList,
  Wallet,
  PackageX,
  FlaskConical,
  Gift,
  Printer,
} from "lucide-react";
import { imprimerListePdf } from "@/lib/utils/pdf-liste";

type StockItem = {
  id: string;
  produitId: string;
  produitCode: string;
  produitNom: string;
  quantiteSachets: number;
  quantiteCartons: number;
  sachetsParCarton: number;
  seuilAlerte: number;
  prixCarton: number;
  coutCarton: number | null;
  enAlerte: boolean;
  updatedAt: string;
};

type MouvementTous = {
  id: string;
  type: "ENTREE" | "SORTIE";
  quantiteSachets: number;
  referenceType: string | null;
  note: string | null;
  createdAt: string;
  produitCode: string;
  produitNom: string;
};

type SortieHorsVente = "AVARIE" | "ECHANTILLON" | "GIFT";
type ResumeSortie = { sachets: number; cartons: number; valeur: number; operations: number };

const LABEL_TYPE_MOUVEMENT: Record<string, string> = {
  VENTE: "Vente",
  AJUSTEMENT_MANUEL: "Ajustement manuel",
  AVARIE: "Avarie",
  ECHANTILLON: "Échantillon",
  GIFT: "Gift",
};

// Les trois sorties « hors vente » : le stock diminue, rien n'est facturé.
const SORTIES: {
  id: SortieHorsVente;
  titre: string;
  aide: string;
  placeholder: string;
  icone: React.ElementType;
  carte: string;
  pastille: string;
  actif: string;
}[] = [
  {
    id: "AVARIE",
    titre: "Avaries",
    aide: "Produit abîmé, périmé ou perdu",
    placeholder: "Motif (ex : cartons mouillés)",
    icone: PackageX,
    carte: "border-rose-200 bg-rose-50/70 dark:border-rose-900/60 dark:bg-rose-950/20",
    pastille: "bg-rose-600 text-white",
    actif: "ring-2 ring-rose-500",
  },
  {
    id: "ECHANTILLON",
    titre: "Échantillons",
    aide: "Offerts pour faire tester le produit",
    placeholder: "Pour qui ? (ex : prospect Akwa)",
    icone: FlaskConical,
    carte: "border-violet-200 bg-violet-50/70 dark:border-violet-900/60 dark:bg-violet-950/20",
    pastille: "bg-violet-600 text-white",
    actif: "ring-2 ring-violet-500",
  },
  {
    id: "GIFT",
    titre: "Gifts",
    aide: "Cadeaux et gestes commerciaux",
    placeholder: "Bénéficiaire (ex : client fidèle)",
    icone: Gift,
    carte: "border-amber-200 bg-amber-50/70 dark:border-amber-900/60 dark:bg-amber-950/20",
    pastille: "bg-amber-500 text-white",
    actif: "ring-2 ring-amber-500",
  },
];

const FILTRES_CATEGORIE = [
  { id: "", label: "Tous les mouvements" },
  { id: "ENTREE", label: "Entrées" },
  { id: "VENTE", label: "Ventes" },
  { id: "AVARIE", label: "Avaries" },
  { id: "ECHANTILLON", label: "Échantillons" },
  { id: "GIFT", label: "Gifts" },
  { id: "AJUSTEMENT", label: "Ajustements" },
];

const champFiltre =
  "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";

function libelleQuantite(sachets: number, sachetsParCarton: number | undefined) {
  if (!sachetsParCarton) return `${sachets} sachets`;
  const cartons = Math.floor(sachets / sachetsParCarton);
  const reste = sachets % sachetsParCarton;
  if (cartons > 0 && reste > 0) return `${cartons} carton${cartons > 1 ? "s" : ""} et ${reste} sachet${reste > 1 ? "s" : ""}`;
  if (cartons > 0) return `${cartons} carton${cartons > 1 ? "s" : ""}`;
  return `${reste} sachet${reste > 1 ? "s" : ""}`;
}

function couleurProduit(code: string) {
  return code === "HYPO" ? "#1e40af" : "#0f766e";
}

export default function StockView({ lectureSeule = false }: { lectureSeule?: boolean }) {
  const [stocks, setStocks] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [historique, setHistorique] = useState<MouvementTous[]>([]);
  const [historiqueLoading, setHistoriqueLoading] = useState(true);
  const [historiqueError, setHistoriqueError] = useState<string | null>(null);
  const [historiqueTotal, setHistoriqueTotal] = useState(0);
  const [resume, setResume] = useState<Record<SortieHorsVente, ResumeSortie> | null>(null);
  const [filtreDu, setFiltreDu] = useState("");
  const [filtreAu, setFiltreAu] = useState("");
  const [filtreProduit, setFiltreProduit] = useState("");
  const [filtreCategorie, setFiltreCategorie] = useState("");

  // --- Sortie hors vente (avarie / échantillon / gift) ----------------
  const [sortieType, setSortieType] = useState<SortieHorsVente>("AVARIE");
  const [sortieProduitId, setSortieProduitId] = useState("");
  const [sortieUnite, setSortieUnite] = useState<"cartons" | "sachets">("cartons");
  const [sortieQuantite, setSortieQuantite] = useState<number | "">("");
  const [sortieNote, setSortieNote] = useState("");
  const [sortieSaving, setSortieSaving] = useState(false);
  const [sortieError, setSortieError] = useState<string | null>(null);
  const [sortieSuccess, setSortieSuccess] = useState<string | null>(null);

  // --- Édition inline du seuil d'alerte -----------------------------
  const [seuilEnEdition, setSeuilEnEdition] = useState<string | null>(null); // produitId
  const [seuilValeur, setSeuilValeur] = useState(0);
  const [seuilSaving, setSeuilSaving] = useState(false);

  // --- Formulaire "Enregistrer un mouvement manuel" -----------------
  const [mvtProduitId, setMvtProduitId] = useState("");
  const [mvtType, setMvtType] = useState<"ENTREE" | "AJUSTEMENT">("ENTREE");
  const [mvtUnite, setMvtUnite] = useState<"cartons" | "sachets">("cartons");
  const [mvtQuantite, setMvtQuantite] = useState<number | "">("");
  const [mvtNote, setMvtNote] = useState("");
  // Achat de stock : prix payé pour l'entrée (enregistré en dépense de caisse).
  const [mvtCout, setMvtCout] = useState<number | "">("");
  const [mvtCanal, setMvtCanal] = useState<"ESPECES" | "MOBILE_MONEY" | "BANQUE">("ESPECES");
  const [mvtError, setMvtError] = useState<string | null>(null);
  const [mvtSuccess, setMvtSuccess] = useState<string | null>(null);
  const [mvtSaving, setMvtSaving] = useState(false);

  function loadStocks() {
    setLoading(true);
    setLoadError(null);
    apiFetch<{ data: StockItem[] }>("/api/stock")
      .then((d) => {
        setStocks(d.data ?? []);
        setMvtProduitId((prev) => prev || d.data?.[0]?.produitId || "");
        setSortieProduitId((prev) => prev || d.data?.[0]?.produitId || "");
      })
      .catch((e: ApiError) => {
        if (e.status !== 401) setLoadError(e.message);
      })
      .finally(() => setLoading(false));
  }

  function loadHistorique() {
    setHistoriqueLoading(true);
    setHistoriqueError(null);
    const sp = new URLSearchParams();
    if (filtreDu) sp.set("du", filtreDu);
    if (filtreAu) sp.set("au", filtreAu);
    if (filtreProduit) sp.set("produitId", filtreProduit);
    if (filtreCategorie) sp.set("categorie", filtreCategorie);
    apiFetch<{ data: MouvementTous[]; total: number; resume: Record<SortieHorsVente, ResumeSortie> }>(
      `/api/stock/mouvements?${sp.toString()}`
    )
      .then((d) => {
        setHistorique(d.data ?? []);
        setHistoriqueTotal(d.total ?? 0);
        setResume(d.resume ?? null);
      })
      .catch((e: ApiError) => {
        if (e.status !== 401) setHistoriqueError(e.message);
      })
      .finally(() => setHistoriqueLoading(false));
  }

  useEffect(() => {
    loadStocks();
  }, []);

  useEffect(() => {
    loadHistorique();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtreDu, filtreAu, filtreProduit, filtreCategorie]);

  async function soumettreSortie(e: React.FormEvent) {
    e.preventDefault();
    setSortieError(null);
    setSortieSuccess(null);
    const cible = stocks.find((s) => s.produitId === sortieProduitId);
    if (!cible) return setSortieError("Sélectionnez un produit.");
    const sachets = Math.round(
      sortieUnite === "cartons" ? Number(sortieQuantite || 0) * cible.sachetsParCarton : Number(sortieQuantite || 0)
    );
    if (!sachets || sachets <= 0) return setSortieError("Indiquez une quantité valide.");
    if (sachets > cible.quantiteSachets) {
      return setSortieError(`Stock insuffisant : il reste ${libelleQuantite(cible.quantiteSachets, cible.sachetsParCarton)}.`);
    }
    setSortieSaving(true);
    try {
      await apiFetch(`/api/stock/${cible.produitId}/ajuster`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "SORTIE",
          quantiteSachets: sachets,
          motifType: sortieType,
          motif: sortieNote.trim() || undefined,
        }),
      });
      const t = SORTIES.find((x) => x.id === sortieType)!;
      setSortieSuccess(`${t.titre.replace(/s$/, "")} enregistré : ${libelleQuantite(sachets, cible.sachetsParCarton)} de ${cible.produitNom} retirés du stock.`);
      setSortieQuantite("");
      setSortieNote("");
      loadStocks();
      loadHistorique();
    } catch (err) {
      setSortieError(err instanceof ApiError ? err.message : "Échec de l'enregistrement.");
    } finally {
      setSortieSaving(false);
    }
  }

  async function imprimerHistorique() {
    const params = new URLSearchParams({ limit: "2000" });
    if (filtreDu) params.set("du", filtreDu);
    if (filtreAu) params.set("au", filtreAu);
    if (filtreProduit) params.set("produitId", filtreProduit);
    if (filtreCategorie) params.set("categorie", filtreCategorie);
    try {
      const d = await apiFetch<{ data: MouvementTous[] }>(`/api/stock/mouvements?${params.toString()}`);
      const spc = new Map(stocks.map((x) => [x.produitCode, x.sachetsParCarton]));
      const filtres = [
        filtreDu || filtreAu ? `Période : ${filtreDu || "…"} au ${filtreAu || "…"}` : "Toutes les dates",
        FILTRES_CATEGORIE.find((c) => c.id === filtreCategorie)?.label,
        stocks.find((x) => x.produitId === filtreProduit)?.produitNom,
      ]
        .filter(Boolean)
        .join(" · ");
      await imprimerListePdf({
        titre: "Historique des mouvements de stock",
        sousTitre: filtres,
        colonnes: ["Date", "Produit", "Mouvement", "Quantité", "Précision"],
        droite: [3],
        lignes: d.data.map((m) => [
          new Date(m.createdAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }),
          `${m.produitCode} — ${m.produitNom}`,
          LABEL_TYPE_MOUVEMENT[m.referenceType ?? ""] ?? (m.type === "ENTREE" ? "Entrée" : "Sortie"),
          `${m.type === "ENTREE" ? "+" : "-"}${libelleQuantite(m.quantiteSachets, spc.get(m.produitCode))}`,
          m.note ?? "",
        ]),
      });
    } catch (e) {
      alert(e instanceof ApiError ? e.message : "Impression impossible.");
    }
  }

  const produitSelectionne = useMemo(
    () => stocks.find((s) => s.produitId === mvtProduitId) ?? null,
    [stocks, mvtProduitId]
  );

  function ouvrirEditionSeuil(item: StockItem) {
    setSeuilEnEdition(item.produitId);
    setSeuilValeur(item.seuilAlerte);
  }

  async function enregistrerSeuil(item: StockItem) {
    setSeuilSaving(true);
    try {
      await apiFetch(`/api/stock/${item.produitId}/seuil`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seuilAlerte: seuilValeur }),
      });
      setSeuilEnEdition(null);
      loadStocks();
    } catch (e) {
      alert(e instanceof ApiError ? e.message : "Échec de l'enregistrement du seuil.");
    } finally {
      setSeuilSaving(false);
    }
  }

  async function soumettreMouvement(e: React.FormEvent) {
    e.preventDefault();
    setMvtError(null);
    setMvtSuccess(null);

    const cible = stocks.find((s) => s.produitId === mvtProduitId);
    if (!cible) {
      setMvtError("Sélectionnez un produit.");
      return;
    }
    const quantiteSaisieSachets =
      mvtUnite === "cartons" ? Number(mvtQuantite || 0) * cible.sachetsParCarton : Number(mvtQuantite || 0);

    if (!quantiteSaisieSachets || quantiteSaisieSachets < 0) {
      setMvtError("Indiquez une quantité valide.");
      return;
    }

    // "Entrée" : ajoute la quantité saisie au stock existant.
    // "Ajustement" : la quantité saisie est le NOUVEAU total ; on calcule
    // le delta par rapport au stock actuel puis on réutilise le même
    // service (ENTREE si positif, SORTIE si négatif) — aucune nouvelle
    // logique de blocage à écrire, applyStockMovement empêche déjà le
    // négatif des deux côtés.
    let type: "ENTREE" | "SORTIE";
    let quantiteSachets: number;
    if (mvtType === "ENTREE") {
      type = "ENTREE";
      quantiteSachets = quantiteSaisieSachets;
    } else {
      const delta = quantiteSaisieSachets - cible.quantiteSachets;
      if (delta === 0) {
        setMvtSuccess("Aucun changement : la quantité saisie est déjà le stock actuel.");
        return;
      }
      type = delta > 0 ? "ENTREE" : "SORTIE";
      quantiteSachets = Math.abs(delta);
    }

    setMvtSaving(true);
    try {
      await apiFetch(`/api/stock/${cible.produitId}/ajuster`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          quantiteSachets,
          motif: mvtNote || undefined,
          ...(mvtType === "ENTREE" && mvtCout !== "" && Number(mvtCout) > 0
            ? { coutTotal: Number(mvtCout), canal: mvtCanal }
            : {}),
        }),
      });
      setMvtSuccess(
        `${mvtType === "ENTREE" ? "Entrée" : "Ajustement"} enregistré pour ${cible.produitNom}.`
      );
      setMvtQuantite("");
      setMvtNote("");
      setMvtCout("");
      loadStocks();
      loadHistorique();
    } catch (e) {
      setMvtError(e instanceof ApiError ? e.message : "Échec de l'enregistrement du mouvement.");
    } finally {
      setMvtSaving(false);
    }
  }

  return (
    <main>
      <AdminPageHeader title="Gestion du stock" subtitle={lectureSeule ? "Consultation uniquement" : "Vue d'ensemble et mouvements manuels"} />

      <div className="space-y-5 p-4 md:p-6">
        {/* Tableau pleine largeur ------------------------------------- */}
        {loading ? (
          <p className="text-sm text-slate-400 dark:text-slate-500">Chargement...</p>
        ) : loadError ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-white dark:bg-slate-900 p-8 text-center shadow-sm ring-1 ring-slate-100 dark:ring-slate-800">
            <AlertTriangle size={22} className="text-alert" />
            <p className="text-sm text-slate-600 dark:text-slate-300">{loadError}</p>
            <button
              onClick={loadStocks}
              className="flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white"
            >
              <RefreshCw size={14} />
              Réessayer
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl bg-white dark:bg-slate-900 shadow-sm ring-1 ring-slate-100 dark:ring-slate-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-left text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  <th className="px-4 py-3">Produit</th>
                  <th className="px-4 py-3">Stock disponible</th>
                  <th className="px-4 py-3">Valeur à la vente</th>
                  <th className="px-4 py-3">Coût moyen / carton</th>
                  <th className="px-4 py-3">Seuil d'alerte</th>
                  <th className="px-4 py-3">Statut</th>
                </tr>
              </thead>
              <tbody>
                {stocks.map((s) => (
                  <tr key={s.id} className="border-b border-slate-50 dark:border-slate-800 last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="flex h-9 w-9 items-center justify-center rounded-lg text-white"
                          style={{ backgroundColor: couleurProduit(s.produitCode) }}
                        >
                          <Package size={16} />
                        </span>
                        <div>
                          <p className="font-semibold text-slate-800 dark:text-slate-100">{s.produitNom}</p>
                          <p className="text-xs text-slate-400 dark:text-slate-500">{s.produitCode}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                      <span className="font-semibold">{s.quantiteCartons}</span> cartons
                      <span className="text-slate-400 dark:text-slate-500"> · {s.quantiteSachets} sachets</span>
                    </td>
                    <td className="px-4 py-3 font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                      {formatFcfa(Math.round((s.quantiteSachets / s.sachetsParCarton) * s.prixCarton))}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-600 dark:text-slate-300">
                      {s.coutCarton === null ? <span className="text-slate-300 dark:text-slate-600">—</span> : formatFcfa(s.coutCarton)}
                    </td>
                    <td className="px-4 py-3">
                      {seuilEnEdition === s.produitId ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min={0}
                            autoFocus
                            value={seuilValeur}
                            onChange={(e) => setSeuilValeur(Number(e.target.value) || 0)}
                            className="w-20 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1 text-sm"
                          />
                          <button
                            onClick={() => enregistrerSeuil(s)}
                            disabled={seuilSaving}
                            className="flex h-7 w-7 items-center justify-center rounded-md bg-green-50 text-green-700 disabled:opacity-50"
                            aria-label="Enregistrer le seuil"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            onClick={() => setSeuilEnEdition(null)}
                            className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                            aria-label="Annuler"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : lectureSeule ? (
                          <span className="text-slate-600 dark:text-slate-300">{s.seuilAlerte} sachets</span>
                        ) : (
                          <button
                            onClick={() => ouvrirEditionSeuil(s)}
                            className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 hover:text-brand"
                          >
                            {s.seuilAlerte} sachets
                            <Pencil size={12} className="text-slate-300 dark:text-slate-600" />
                          </button>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {s.enAlerte ? (
                        <span className="flex w-fit items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-alert">
                          <AlertTriangle size={12} />
                          Stock faible
                        </span>
                      ) : (
                        <span className="flex w-fit items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700">
                          <CheckCircle2 size={12} />
                          OK
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {stocks.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-400 dark:text-slate-500">
                      Aucun produit en stock.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Formulaire de mouvement manuel, en ligne (pas de modale) --- */}
        {!lectureSeule && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 p-4 shadow-sm ring-1 ring-slate-100 dark:ring-slate-800 md:p-5">
          <h2 className="mb-3 font-semibold text-slate-800 dark:text-slate-100">Enregistrer un mouvement manuel</h2>
          <form onSubmit={soumettreMouvement} className="grid gap-3 md:grid-cols-5">
            <select
              value={mvtProduitId}
              onChange={(e) => setMvtProduitId(e.target.value)}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 md:col-span-1"
            >
              {stocks.map((s) => (
                <option key={s.produitId} value={s.produitId}>
                  {s.produitNom}
                </option>
              ))}
            </select>

            <select
              value={mvtType}
              onChange={(e) => setMvtType(e.target.value as "ENTREE" | "AJUSTEMENT")}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 md:col-span-1"
            >
              <option value="ENTREE">Entrée</option>
              <option value="AJUSTEMENT">Ajustement</option>
            </select>

            <div className="flex gap-2 md:col-span-1">
              <select
                value={mvtUnite}
                onChange={(e) => setMvtUnite(e.target.value as "cartons" | "sachets")}
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-2 text-sm text-slate-800 dark:text-slate-100"
              >
                <option value="cartons">Cartons</option>
                <option value="sachets">Sachets</option>
              </select>
              <input
                type="number"
                min={0}
                required
                placeholder={mvtType === "AJUSTEMENT" ? "Nouveau total" : "Quantité"}
                value={mvtQuantite}
                onChange={(e) => setMvtQuantite(e.target.value === "" ? "" : Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-100"
              />
            </div>

            <input
              type="text"
              placeholder="Note (optionnel)"
              value={mvtNote}
              onChange={(e) => setMvtNote(e.target.value)}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 md:col-span-1"
            />

            <button
              type="submit"
              disabled={mvtSaving || !produitSelectionne}
              className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 md:col-span-1"
            >
              {mvtSaving ? "..." : "Valider"}
            </button>

            {mvtType === "ENTREE" && (
              <div className="grid gap-3 rounded-xl bg-emerald-50/70 p-3 dark:bg-slate-800/50 md:col-span-5 md:grid-cols-[1fr_auto]">
                <label className="block">
                  <span className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                    <Wallet size={13} /> Prix d&apos;achat total (FCFA) — facultatif
                  </span>
                  <input
                    type="number"
                    min={0}
                    placeholder="Ex : 1 200 000 — enregistré en dépense de caisse"
                    value={mvtCout}
                    onChange={(e) => setMvtCout(e.target.value === "" ? "" : Number(e.target.value))}
                    className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                </label>
                <div className="flex items-end gap-2">
                  {(["ESPECES", "MOBILE_MONEY", "BANQUE"] as const).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setMvtCanal(c)}
                      className={`rounded-xl border px-3 py-2 text-xs font-semibold ${
                        mvtCanal === c
                          ? "border-transparent bg-[#359980] text-white"
                          : "border-emerald-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                      }`}
                    >
                      {c === "ESPECES" ? "Espèces" : c === "MOBILE_MONEY" ? "OM/MOMO" : "Opération bancaire"}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </form>

          {mvtType === "AJUSTEMENT" && produitSelectionne && (
            <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
              Stock actuel de {produitSelectionne.produitNom} : {produitSelectionne.quantiteCartons} cartons (
              {produitSelectionne.quantiteSachets} sachets). La quantité saisie ci-dessus remplacera ce total.
            </p>
          )}
          {mvtError && (
            <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-alert">{mvtError}</p>
          )}
          {mvtSuccess && (
            <p className="mt-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{mvtSuccess}</p>
          )}
        </div>
        )}

        {/* Sorties hors vente : avaries, échantillons, gifts ---------- */}
        <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800 md:p-5">
          <div className="mb-3">
            <h2 className="font-semibold text-slate-800 dark:text-slate-100">Sorties hors vente</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Le stock diminue mais rien n&apos;est facturé. Les totaux suivent la période choisie dans l&apos;historique.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {SORTIES.map((t) => {
              const Icone = t.icone;
              const r = resume?.[t.id];
              const actif = !lectureSeule && sortieType === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  disabled={lectureSeule}
                  onClick={() => {
                    setSortieType(t.id);
                    setSortieError(null);
                    setSortieSuccess(null);
                  }}
                  className={`rounded-2xl border p-4 text-left transition-all ${t.carte} ${actif ? t.actif : ""} ${
                    lectureSeule ? "cursor-default" : "hover:shadow-md"
                  }`}
                >
                  <span className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl ${t.pastille}`}>
                    <Icone size={18} />
                  </span>
                  <p className="font-semibold text-slate-800 dark:text-slate-100">{t.titre}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{t.aide}</p>
                  <p className="mt-3 text-xl font-bold tabular-nums text-slate-900 dark:text-slate-50">
                    {r ? (Math.round(r.cartons * 10) / 10).toLocaleString("fr-FR") : "—"}{" "}
                    <span className="text-xs font-medium text-slate-500">cartons</span>
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {r ? `${r.operations} opération${r.operations > 1 ? "s" : ""} · valeur ${formatFcfa(r.valeur)}` : ""}
                  </p>
                </button>
              );
            })}
          </div>

          {!lectureSeule && (
            <form onSubmit={soumettreSortie} className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_1fr_auto]">
              <select
                value={sortieProduitId}
                onChange={(e) => setSortieProduitId(e.target.value)}
                className={champFiltre}
                aria-label="Produit"
              >
                {stocks.map((s) => (
                  <option key={s.produitId} value={s.produitId}>
                    {s.produitNom} — {libelleQuantite(s.quantiteSachets, s.sachetsParCarton)} en stock
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <select value={sortieUnite} onChange={(e) => setSortieUnite(e.target.value as "cartons" | "sachets")} className={champFiltre} aria-label="Unité">
                  <option value="cartons">Cartons</option>
                  <option value="sachets">Sachets</option>
                </select>
                <input
                  type="number"
                  min={1}
                  required
                  placeholder="Quantité"
                  value={sortieQuantite}
                  onChange={(e) => setSortieQuantite(e.target.value === "" ? "" : Number(e.target.value))}
                  className={`${champFiltre} w-28`}
                />
              </div>
              <input
                type="text"
                maxLength={300}
                placeholder={SORTIES.find((t) => t.id === sortieType)?.placeholder}
                value={sortieNote}
                onChange={(e) => setSortieNote(e.target.value)}
                className={champFiltre}
              />
              <button
                type="submit"
                disabled={sortieSaving || stocks.length === 0}
                className="rounded-xl bg-brand px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {sortieSaving ? "..." : `Retirer du stock`}
              </button>
            </form>
          )}
          {sortieError && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-alert">{sortieError}</p>}
          {sortieSuccess && <p className="mt-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{sortieSuccess}</p>}
        </section>

        {/* Historique combiné, tous produits confondus ---------------- */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 shadow-sm ring-1 ring-slate-100 dark:ring-slate-800">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 dark:border-slate-800 px-4 py-3">
            <ClipboardList size={16} className="text-slate-400 dark:text-slate-500" />
            <h2 className="mr-auto font-semibold text-slate-800 dark:text-slate-100">
              Historique des mouvements
              <span className="ml-2 text-xs font-normal text-slate-400">{historiqueTotal} au total</span>
            </h2>
            <button
              type="button"
              onClick={imprimerHistorique}
              className="flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
            >
              <Printer size={14} /> Imprimer
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800 md:grid-cols-5">
            <input type="date" value={filtreDu} onChange={(e) => setFiltreDu(e.target.value)} className={champFiltre} aria-label="Du" />
            <input type="date" value={filtreAu} onChange={(e) => setFiltreAu(e.target.value)} className={champFiltre} aria-label="Au" />
            <select value={filtreProduit} onChange={(e) => setFiltreProduit(e.target.value)} className={champFiltre} aria-label="Produit">
              <option value="">Tous les produits</option>
              {stocks.map((s) => (
                <option key={s.produitId} value={s.produitId}>{s.produitNom}</option>
              ))}
            </select>
            <select value={filtreCategorie} onChange={(e) => setFiltreCategorie(e.target.value)} className={`${champFiltre} col-span-2 md:col-span-1`} aria-label="Type de mouvement">
              {FILTRES_CATEGORIE.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
            {(filtreDu || filtreAu || filtreProduit || filtreCategorie) && (
              <button
                type="button"
                onClick={() => {
                  setFiltreDu("");
                  setFiltreAu("");
                  setFiltreProduit("");
                  setFiltreCategorie("");
                }}
                className="col-span-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300 md:col-span-1"
              >
                Réinitialiser
              </button>
            )}
          </div>
          {historiqueLoading ? (
            <p className="px-4 py-6 text-sm text-slate-400 dark:text-slate-500">Chargement...</p>
          ) : historiqueError ? (
            <p className="mx-4 my-3 rounded-md bg-red-50 px-3 py-2 text-sm text-alert">{historiqueError}</p>
          ) : historique.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-400 dark:text-slate-500">Aucun mouvement enregistré.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-left text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    <th className="px-4 py-2">Date</th>
                    <th className="px-4 py-2">Produit</th>
                    <th className="px-4 py-2">Type</th>
                    <th className="px-4 py-2">Quantité</th>
                    <th className="px-4 py-2">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {historique.map((m) => (
                    <tr key={m.id} className="border-b border-slate-50 dark:border-slate-800 last:border-0">
                      <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">
                        {new Date(m.createdAt).toLocaleDateString("fr-FR")}
                      </td>
                      <td className="px-4 py-2.5 text-slate-700 dark:text-slate-200">
                        {m.produitCode} — {m.produitNom}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`font-medium ${
                            m.type === "ENTREE" ? "text-green-700" : "text-alert"
                          }`}
                        >
                          {m.type === "ENTREE" ? "Entrée" : "Sortie"}
                        </span>
                        {(m.referenceType === "AVARIE" || m.referenceType === "ECHANTILLON" || m.referenceType === "GIFT") && (
                          <span className={`ml-2 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            m.referenceType === "AVARIE"
                              ? "bg-rose-100 text-rose-700"
                              : m.referenceType === "ECHANTILLON"
                              ? "bg-violet-100 text-violet-700"
                              : "bg-amber-100 text-amber-700"
                          }`}>
                            {LABEL_TYPE_MOUVEMENT[m.referenceType]}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-slate-700 dark:text-slate-200">
                        {m.type === "ENTREE" ? "+" : "-"}
                        {libelleQuantite(m.quantiteSachets, stocks.find((x) => x.produitCode === m.produitCode)?.sachetsParCarton)}
                      </td>
                      <td className="px-4 py-2.5 text-slate-400 dark:text-slate-500">
                        {m.note
                          ? m.note
                          : LABEL_TYPE_MOUVEMENT[m.referenceType ?? ""] ?? m.referenceType ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
