"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, AlertTriangle, ArrowDownCircle, ArrowUpCircle, ArrowRightLeft, ArrowRight, HandCoins, Plus, Search, Trash2 } from "lucide-react";
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
  dateLivraisonPrevue: string | null;
};

type Onglet = "CREDIT" | "DEPENSE" | "RECETTE" | "TRANSFERT";
type Canal = "ESPECES" | "MOBILE_MONEY" | "BANQUE";

const LIBELLE_CANAL: Record<Canal, string> = { ESPECES: "Espèces", MOBILE_MONEY: "OM/MOMO", BANQUE: "Opération bancaire" };
const CANAUX_CREANCE: Canal[] = ["ESPECES", "MOBILE_MONEY", "BANQUE"];

const CATEGORIES_DEPENSE = ["Achat de stock", "Transport", "Salaires", "Carburant", "Loyer", "Communication", "Autre"];

const champ =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#359980] focus:outline-none focus:ring-2 focus:ring-[#359980]/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";

export function CaisseOperations({ credits, jour, soldes }: { credits: Credit[]; jour: string; soldes: Record<Canal, number> }) {
  const router = useRouter();
  const [onglet, setOnglet] = useState<Onglet>(credits.length > 0 ? "CREDIT" : "DEPENSE");
  const [canal, setCanal] = useState<Canal>("ESPECES");
  const [montant, setMontant] = useState<number | "">("");
  const [note, setNote] = useState("");
  const [categorie, setCategorie] = useState(CATEGORIES_DEPENSE[0]);
  const [cleChoisie, setCleChoisie] = useState("");
  const [versCanal, setVersCanal] = useState<Canal>("MOBILE_MONEY");
  const [frais, setFrais] = useState<number | "">("");
  const [recherche, setRecherche] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);

  // Regroupement par jour d'encaissement prévu (= jour de livraison, heure de Douala).
  const groupesCredits = useMemo(() => {
    const jourDe = (c: Credit) =>
      c.dateLivraisonPrevue ? new Date(new Date(c.dateLivraisonPrevue).getTime() + 3600000).toISOString().slice(0, 10) : null;
    return [
      { id: "retard", titre: "En retard", couleur: "text-red-700 dark:text-red-400", items: credits.filter((c) => { const j = jourDe(c); return j !== null && j < jour; }) },
      { id: "jour", titre: "À encaisser aujourd'hui", couleur: "text-amber-700 dark:text-amber-400", items: credits.filter((c) => jourDe(c) === jour) },
      { id: "venir", titre: "À venir", couleur: "text-blue-700 dark:text-blue-400", items: credits.filter((c) => { const j = jourDe(c); return j !== null && j > jour; }) },
      { id: "sans", titre: "Sans date de livraison", couleur: "text-slate-500", items: credits.filter((c) => jourDe(c) === null) },
    ];
  }, [credits, jour]);

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
      } else if (onglet === "TRANSFERT") {
        if (canal === versCanal) {
          setEnvoi(false);
          return setErreur("Choisissez deux comptes différents.");
        }
        await apiFetch("/api/caisse/transferts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ de: canal, vers: versCanal, montant: m, frais: Number(frais) || undefined, note: note.trim() || undefined }),
        });
        setSucces(`Transfert de ${formatFcfa(m)} enregistré : ${LIBELLE_CANAL[canal]} → ${LIBELLE_CANAL[versCanal]}.`);
        setFrais("");
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
    { id: "CREDIT", label: "Valider un encaissement", icone: <HandCoins size={15} />, actif: "bg-[#1e3a8a] text-white" },
    { id: "DEPENSE", label: "Dépense", icone: <ArrowUpCircle size={15} />, actif: "bg-red-700 text-white" },
    { id: "RECETTE", label: "Autre recette", icone: <ArrowDownCircle size={15} />, actif: "bg-[#359980] text-white" },
    { id: "TRANSFERT", label: "Transfert", icone: <ArrowRightLeft size={15} />, actif: "bg-slate-700 text-white" },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Nouvelle opération */}
      <section id="nouvelle-operation" className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-[#1e3a8a] dark:text-blue-300">
          <Plus size={16} /> Nouvelle opération
        </h2>

        <div className="mb-4 grid grid-cols-2 gap-1.5 rounded-xl sm:grid-cols-4 bg-slate-100 p-1 dark:bg-slate-800">
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

          {onglet === "TRANSFERT" && (
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Depuis le compte (solde disponible : {formatFcfa(soldes[canal])})
            </p>
          )}
          <div className={`grid gap-2 ${"grid-cols-3"}`}>
            {(onglet === "CREDIT" ? CANAUX_CREANCE : (["ESPECES", "MOBILE_MONEY", "BANQUE"] as Canal[])).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCanal(c)}
                className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all ${
                  canal === c
                    ? "border-transparent bg-[#359980]/80 text-white shadow-sm"
                    : "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                }`}
              >
                {LIBELLE_CANAL[c]}
              </button>
            ))}
          </div>

          {onglet === "TRANSFERT" && (
            <>
              <p className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                <ArrowRight size={14} /> Vers le compte (solde : {formatFcfa(soldes[versCanal])})
              </p>
              <div className="grid grid-cols-3 gap-2">
                {(["ESPECES", "MOBILE_MONEY", "BANQUE"] as Canal[]).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setVersCanal(c)}
                    className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all ${
                      versCanal === c
                        ? "border-transparent bg-[#1e3a8a] text-white shadow-sm"
                        : "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                    }`}
                  >
                    {LIBELLE_CANAL[c]}
                  </button>
                ))}
              </div>
              <input
                type="number"
                min={0}
                inputMode="numeric"
                className={champ}
                placeholder="Frais de transfert (optionnel, FCFA)"
                value={frais}
                onChange={(e) => setFrais(e.target.value === "" ? "" : Number(e.target.value))}
                onWheel={(e) => (e.target as HTMLInputElement).blur()}
              />
              <p className="rounded-xl bg-slate-50 px-3.5 py-2 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                À enregistrer ici quand l&apos;argent a déjà bougé en vrai (versement OM, dépôt en banque…). Ce n&apos;est ni une recette ni une dépense : les frais éventuels sont comptés en dépense.
              </p>
            </>
          )}

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
            className="w-full rounded-xl bg-[#1e3a8a] py-3 text-sm font-bold text-white shadow-sm disabled:opacity-50"
          >
            {envoi ? "Enregistrement…" : onglet === "CREDIT" ? "Encaisser" : onglet === "TRANSFERT" ? "Enregistrer le transfert" : "Enregistrer"}
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
          <div className="space-y-5">
            {groupesCredits.map((g) =>
              g.items.length === 0 ? null : (
                <div key={g.id}>
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <h3 className={`text-xs font-bold uppercase tracking-wide ${g.couleur}`}>
                      {g.titre} ({g.items.length})
                    </h3>
                    <span className="text-xs font-bold tabular-nums text-slate-700 dark:text-slate-200">
                      {formatFcfa(g.items.reduce((s, x) => s + x.du, 0))}
                    </span>
                  </div>
                  <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                    {g.items.map((c) => (
                      <li key={c.cle} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 py-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{c.pointVenteNom}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {c.commercialNom} · commandée le {new Date(c.date).toLocaleDateString("fr-FR")}
                          </p>
                          <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                            <CalendarClock size={12} />
                            {c.dateLivraisonPrevue
                              ? `Livraison / encaissement prévu le ${new Date(c.dateLivraisonPrevue).toLocaleDateString("fr-FR")}`
                              : "Aucune date de livraison"}
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
                </div>
              )
            )}
          </div>
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
