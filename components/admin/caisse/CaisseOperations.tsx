"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowDownCircle, ArrowUpCircle, HandCoins, Plus, Search, Trash2 } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/client/apiFetch";
import { formatFcfa } from "@/lib/utils/format";

type Credit = {
  cle: string;
  type: "VENTE" | "COMMANDE";
  id: string;
  modeAnnonce: string | null;
  pointVenteNom: string;
  commercialNom: string;
  date: string;
  montantTotal: number;
  paye: number;
  du: number;
};

type Onglet = "CREDIT" | "DEPENSE" | "RECETTE";
type Canal = "ESPECES" | "MOBILE_MONEY" | "BANQUE";

const LIBELLE_CANAL: Record<Canal, string> = { ESPECES: "Espèces", MOBILE_MONEY: "OM/MOMO", BANQUE: "Opération bancaire" };
const CANAUX_CREANCE: Canal[] = ["ESPECES", "MOBILE_MONEY"];

const CATEGORIES_DEPENSE = ["Achat de stock", "Transport", "Salaires", "Carburant", "Loyer", "Communication", "Autre"];

const champ =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#359980] focus:outline-none focus:ring-2 focus:ring-[#359980]/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";

export function CaisseOperations({ credits }: { credits: Credit[] }) {
  const router = useRouter();
  const [onglet, setOnglet] = useState<Onglet>(credits.length > 0 ? "CREDIT" : "DEPENSE");
  const [canal, setCanal] = useState<Canal>("ESPECES");
  const [montant, setMontant] = useState<number | "">("");
  const [note, setNote] = useState("");
  const [categorie, setCategorie] = useState(CATEGORIES_DEPENSE[0]);
  const [cleChoisie, setCleChoisie] = useState("");
  const [recherche, setRecherche] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);

  const creditChoisi = credits.find((c) => c.cle === cleChoisie) ?? null;

  const filtres = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    if (!q) return credits;
    return credits.filter((c) => `${c.pointVenteNom} ${c.commercialNom}`.toLowerCase().includes(q));
  }, [credits, recherche]);

  function choisirCredit(c: Credit) {
    setOnglet("CREDIT");
    setCleChoisie(c.cle);
    if (c.modeAnnonce === "MOBILE_MONEY") setCanal("MOBILE_MONEY");
    else if (c.modeAnnonce === "ESPECES") setCanal("ESPECES");
    setMontant(c.du);
    setErreur(null);
    setSucces(null);
    if (typeof window !== "undefined") document.getElementById("nouvelle-operation")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function valider(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    setSucces(null);
    const m = Number(montant);
    if (!m || m <= 0) return setErreur("Indiquez un montant.");
    setEnvoi(true);
    try {
      if (onglet === "CREDIT") {
        if (!creditChoisi) {
          setEnvoi(false);
          return setErreur("Choisissez la commande à encaisser.");
        }
        await apiFetch("/api/caisse/encaisser", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: creditChoisi.type, id: creditChoisi.id, montant: m, canal }),
        });
        setSucces(`${formatFcfa(m)} encaissés chez ${creditChoisi.pointVenteNom}.`);
        setCleChoisie("");
      } else {
        await apiFetch("/api/caisse/operations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: onglet,
            canal,
            montant: m,
            categorie: onglet === "DEPENSE" ? categorie : "Autre recette",
            note: note.trim() || undefined,
          }),
        });
        setSucces(onglet === "DEPENSE" ? "Dépense enregistrée." : "Recette enregistrée.");
      }
      setMontant("");
      setNote("");
      router.refresh();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Échec de l'enregistrement.");
    } finally {
      setEnvoi(false);
    }
  }

  const onglets: { id: Onglet; label: string; icone: React.ReactNode; actif: string }[] = [
    { id: "CREDIT", label: "Valider un encaissement", icone: <HandCoins size={15} />, actif: "bg-gradient-to-r from-[#1e3a8a] to-[#2563eb] text-white" },
    { id: "DEPENSE", label: "Dépense", icone: <ArrowUpCircle size={15} />, actif: "bg-gradient-to-r from-rose-600 to-orange-500 text-white" },
    { id: "RECETTE", label: "Autre recette", icone: <ArrowDownCircle size={15} />, actif: "bg-gradient-to-r from-emerald-600 to-teal-500 text-white" },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Nouvelle opération */}
      <section id="nouvelle-operation" className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-[#1e3a8a] dark:text-blue-300">
          <Plus size={16} /> Nouvelle opération
        </h2>

        <div className="mb-4 grid grid-cols-3 gap-1.5 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          {onglets.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => {
                setOnglet(o.id);
                setErreur(null);
                setSucces(null);
              }}
              className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-2.5 text-xs font-semibold transition-all ${
                onglet === o.id ? `${o.actif} shadow` : "text-slate-500 dark:text-slate-400"
              }`}
            >
              {o.icone}
              <span className="hidden sm:inline">{o.label}</span>
              <span className="sm:hidden">{o.id === "CREDIT" ? "Encaisser" : o.label}</span>
            </button>
          ))}
        </div>

        <form onSubmit={valider} className="space-y-3">
          {onglet === "CREDIT" && (
            <>
              {credits.length === 0 ? (
                <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
                  Aucun crédit en cours : toutes les ventes sont soldées.
                </p>
              ) : (
                <>
                  <div className="relative">
                    <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      className={`${champ} pl-9`}
                      placeholder="Rechercher un point de vente ou un commercial…"
                      value={recherche}
                      onChange={(e) => setRecherche(e.target.value)}
                    />
                  </div>
                  <select
                    className={champ}
                    value={cleChoisie}
                    onChange={(e) => {
                      setCleChoisie(e.target.value);
                      const c = credits.find((x) => x.cle === e.target.value);
                      setMontant(c ? c.du : "");
                      if (c?.modeAnnonce === "MOBILE_MONEY") setCanal("MOBILE_MONEY");
                      else if (c?.modeAnnonce === "ESPECES") setCanal("ESPECES");
                    }}
                  >
                    <option value="">Choisir la commande à encaisser…</option>
                    {filtres.map((c) => (
                      <option key={c.cle} value={c.cle}>
                        {c.pointVenteNom} · {c.type === "VENTE" ? "vente" : "commande"} — reste {formatFcfa(c.du)}
                      </option>
                    ))}
                  </select>
                  {creditChoisi && (
                    <p className="rounded-xl bg-blue-50 px-4 py-2.5 text-xs text-blue-900 dark:bg-slate-800 dark:text-slate-300">
                      {creditChoisi.type === "VENTE" ? "Vente" : "Commande"} de {formatFcfa(creditChoisi.montantTotal)} · déjà payé {formatFcfa(creditChoisi.paye)} ·{" "}
                      <strong>reste {formatFcfa(creditChoisi.du)}</strong>
                    </p>
                  )}
                </>
              )}
            </>
          )}

          {onglet === "DEPENSE" && (
            <select className={champ} value={categorie} onChange={(e) => setCategorie(e.target.value)}>
              {CATEGORIES_DEPENSE.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          )}

          <input
            type="number"
            min={0}
            inputMode="numeric"
            className={champ}
            placeholder={onglet === "CREDIT" ? "Montant reçu du superviseur (FCFA)" : "Montant (FCFA)"}
            value={montant}
            onChange={(e) => setMontant(e.target.value === "" ? "" : Number(e.target.value))}
            onWheel={(e) => (e.target as HTMLInputElement).blur()}
          />

          <div className={`grid gap-2 ${onglet === "CREDIT" ? "grid-cols-2" : "grid-cols-3"}`}>
            {(onglet === "CREDIT" ? CANAUX_CREANCE : (["ESPECES", "MOBILE_MONEY", "BANQUE"] as Canal[])).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCanal(c)}
                className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all ${
                  canal === c
                    ? "border-transparent bg-gradient-to-r from-[#359980] to-emerald-500 text-white shadow-md shadow-emerald-900/15"
                    : "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                }`}
              >
                {LIBELLE_CANAL[c]}
              </button>
            ))}
          </div>

          {onglet !== "CREDIT" && (
            <input className={champ} placeholder="Note (optionnel)" value={note} onChange={(e) => setNote(e.target.value)} />
          )}

          {erreur && (
            <p className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
              <AlertTriangle size={15} /> {erreur}
            </p>
          )}
          {succes && <p className="rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">{succes}</p>}

          <button
            type="submit"
            disabled={envoi || (onglet === "CREDIT" && credits.length === 0)}
            className="w-full rounded-xl bg-gradient-to-r from-[#1e3a8a] via-[#2563eb] to-[#359980] py-3 text-sm font-bold text-white shadow-md shadow-blue-900/20 disabled:opacity-50"
          >
            {envoi ? "Enregistrement…" : onglet === "CREDIT" ? "Encaisser" : "Enregistrer"}
          </button>
        </form>
      </section>

      {/* Crédits à encaisser */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400">
          <AlertTriangle size={16} /> Commandes à encaisser ({credits.length})
        </h2>
        {credits.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Aucun crédit en cours : toutes les commandes sont soldées.</p>
        ) : (
          <ul className="max-h-[360px] divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
            {credits.map((c) => (
              <li key={c.cle} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{c.pointVenteNom}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {c.commercialNom} · {new Date(c.date).toLocaleDateString("fr-FR")}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold tabular-nums text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                    {formatFcfa(c.du)}
                  </span>
                  <button
                    type="button"
                    onClick={() => choisirCredit(c)}
                    className="rounded-lg bg-[#1e3a8a] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#2563eb]"
                  >
                    Encaisser
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export function SupprimerOperation({ id }: { id: string }) {
  const router = useRouter();
  const [envoi, setEnvoi] = useState(false);
  async function supprimer() {
    if (!window.confirm("Supprimer cette opération de la caisse ?")) return;
    setEnvoi(true);
    try {
      await apiFetch(`/api/caisse/operations/${id}`, { method: "DELETE" });
      router.refresh();
    } catch (e) {
      alert(e instanceof ApiError ? e.message : "Échec de la suppression.");
    } finally {
      setEnvoi(false);
    }
  }
  return (
    <button
      onClick={supprimer}
      disabled={envoi}
      aria-label="Supprimer l'opération"
      className="rounded-md p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-600 disabled:opacity-40 dark:hover:bg-red-950/30"
    >
      <Trash2 size={14} />
    </button>
  );
}
