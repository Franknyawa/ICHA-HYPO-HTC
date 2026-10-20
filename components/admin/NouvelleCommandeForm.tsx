"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, UserPlus, X } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/client/apiFetch";
import { preparerCommande, type ProduitForm, type QuantitesParCode } from "@/lib/utils/commande-terrain";
import type { PalierTarif, PrixTypeTarif } from "@/lib/utils/tarifs";
import { BlocPaiement, type ModePaiementTerrain } from "@/components/commercial/form-ui";
import { formatFcfa } from "@/lib/utils/format";

type PV = {
  id: string;
  nom: string;
  vendeur: string | null;
  telephoneVendeur: string | null;
  typeId: string | null;
  villeNom: string | null;
  quartierNom: string | null;
};

const champ =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#359980] focus:outline-none focus:ring-2 focus:ring-[#359980]/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";

function Section({ titre, aide, children }: { titre: string; aide?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
      <h2 className="text-sm font-bold uppercase tracking-wide text-[#1e3a8a] dark:text-blue-300">{titre}</h2>
      {aide && <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">{aide}</p>}
      <div className={aide ? "" : "mt-3"}>{children}</div>
    </section>
  );
}

function Etiquette({ texte, children }: { texte: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{texte}</span>
      {children}
    </label>
  );
}

export function NouvelleCommandeForm({
  villes,
  types,
  commerciaux,
  produits,
  prixParType,
  paliers,
}: {
  villes: { id: string; nom: string }[];
  types: { id: string; nom: string }[];
  commerciaux: { id: string; nom: string; prenom: string }[];
  produits: ProduitForm[];
  prixParType: PrixTypeTarif[];
  paliers: PalierTarif[];
}) {
  const router = useRouter();

  const [mode, setMode] = useState<"EXISTANT" | "NOUVEAU">("EXISTANT");
  const [recherche, setRecherche] = useState("");
  const [resultats, setResultats] = useState<PV[]>([]);
  const [choisi, setChoisi] = useState<PV | null>(null);

  const [nom, setNom] = useState("");
  const [contact, setContact] = useState("");
  const [telephone, setTelephone] = useState("");
  const [villeId, setVilleId] = useState("");
  const [quartier, setQuartier] = useState("");
  const [repere, setRepere] = useState("");
  const [typeId, setTypeId] = useState("");

  const [quantites, setQuantites] = useState<QuantitesParCode>({});
  const [modePaiement, setModePaiement] = useState<ModePaiementTerrain>("ESPECES");
  const [acompte, setAcompte] = useState(0);
  const [livraison, setLivraison] = useState("");
  const [commercialId, setCommercialId] = useState("");

  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== "EXISTANT" || choisi || recherche.trim().length < 2) {
      setResultats([]);
      return;
    }
    const t = setTimeout(() => {
      apiFetch<{ data: PV[] }>(`/api/commandes/points-vente?search=${encodeURIComponent(recherche.trim())}`)
        .then((d) => setResultats(d.data ?? []))
        .catch(() => setResultats([]));
    }, 250);
    return () => clearTimeout(t);
  }, [recherche, mode, choisi]);

  const typeEffectif = mode === "EXISTANT" ? choisi?.typeId ?? null : typeId || null;
  const commande = useMemo(
    () => preparerCommande(produits, quantites, { typeId: typeEffectif, prixParType, paliers }),
    [produits, quantites, typeEffectif, prixParType, paliers]
  );

  function majQuantite(code: string, cle: "sachets" | "filets" | "cartons", v: number) {
    setQuantites((prev) => ({ ...prev, [code]: { ...(prev[code] ?? { sachets: 0, filets: 0, cartons: 0 }), [cle]: v } }));
  }

  async function valider(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    if (mode === "EXISTANT" && !choisi) return setErreur("Choisissez le point de vente dans la liste.");
    if (mode === "NOUVEAU" && (nom.trim().length < 2 || !villeId)) return setErreur("Indiquez le nom du client et sa ville.");
    if (commande.lignes.length === 0) return setErreur("Indiquez au moins une quantité.");

    setEnvoi(true);
    try {
      await apiFetch("/api/commandes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(mode === "EXISTANT"
            ? { pointVenteId: choisi!.id }
            : {
                nouveauPointVente: {
                  nom: nom.trim(),
                  vendeur: contact.trim() || undefined,
                  telephoneVendeur: telephone.trim() || undefined,
                  villeId,
                  quartierNom: quartier.trim() || undefined,
                  repere: repere.trim() || undefined,
                  typeId: typeId || undefined,
                },
              }),
          commercialId: commercialId || undefined,
          lignes: commande.lignes.map((l) => ({
            produitCode: l.produitCode,
            nbSachets: l.nbSachets,
            nbFilets: l.nbFilets,
            nbCartons: l.nbCartons,
          })),
          modePaiement,
          dateLivraisonPrevue: livraison ? new Date(livraison).toISOString() : undefined,
        }),
      });
      router.push("/admin/commandes");
      router.refresh();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Échec de l'enregistrement.");
      setEnvoi(false);
    }
  }

  return (
    <form onSubmit={valider} className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-[1.4fr_1fr]">
      <div className="space-y-4">
        <Section titre="Client" aide="Un nouveau client est ajouté automatiquement à la liste des points de vente.">
          <div className="mb-4 grid grid-cols-2 gap-1.5 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
            {([
              ["EXISTANT", "Point de vente existant", Search],
              ["NOUVEAU", "Nouveau client", UserPlus],
            ] as const).map(([id, label, Icone]) => (
              <button
                key={id}
                type="button"
                onClick={() => setMode(id)}
                className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-2.5 text-xs font-semibold transition-all ${
                  mode === id ? "bg-white text-[#1e3a8a] shadow dark:bg-slate-950 dark:text-blue-300" : "text-slate-500 dark:text-slate-400"
                }`}
              >
                <Icone size={14} /> {label}
              </button>
            ))}
          </div>

          {mode === "EXISTANT" ? (
            choisi ? (
              <div className="flex items-start justify-between gap-3 rounded-xl bg-blue-50 px-4 py-3 dark:bg-slate-800">
                <div>
                  <p className="font-semibold text-slate-800 dark:text-slate-100">{choisi.nom}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {[choisi.vendeur, choisi.quartierNom, choisi.villeNom].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <button type="button" onClick={() => setChoisi(null)} aria-label="Changer de client" className="rounded-lg p-1.5 text-slate-400 hover:bg-white dark:hover:bg-slate-900">
                  <X size={15} />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search size={15} className="pointer-events-none absolute left-3.5 top-3 text-slate-400" />
                <input className={`${champ} pl-9`} placeholder="Nom du point de vente, contact ou téléphone…" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
                {resultats.length > 0 && (
                  <ul className="mt-2 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
                    {resultats.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setChoisi(p);
                            setResultats([]);
                          }}
                          className="w-full px-4 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800"
                        >
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{p.nom}</p>
                          <p className="text-xs text-slate-500">{[p.vendeur, p.quartierNom, p.villeNom].filter(Boolean).join(" · ")}</p>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {recherche.trim().length >= 2 && resultats.length === 0 && (
                  <p className="mt-2 text-xs text-slate-500">
                    Aucun résultat.{" "}
                    <button type="button" onClick={() => { setMode("NOUVEAU"); setNom(recherche.trim()); }} className="font-semibold text-[#1e3a8a] underline dark:text-blue-300">
                      Créer ce client
                    </button>
                  </p>
                )}
              </div>
            )
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Etiquette texte="Nom du point de vente *">
                  <input className={champ} value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex : Boutique Mbarga" />
                </Etiquette>
              </div>
              <Etiquette texte="Personne à contacter">
                <input className={champ} value={contact} onChange={(e) => setContact(e.target.value)} />
              </Etiquette>
              <Etiquette texte="Téléphone">
                <input className={champ} inputMode="tel" value={telephone} onChange={(e) => setTelephone(e.target.value)} />
              </Etiquette>
              <Etiquette texte="Ville *">
                <select className={champ} value={villeId} onChange={(e) => setVilleId(e.target.value)}>
                  <option value="">Choisir…</option>
                  {villes.map((v) => (
                    <option key={v.id} value={v.id}>{v.nom}</option>
                  ))}
                </select>
              </Etiquette>
              <Etiquette texte="Quartier">
                <input className={champ} value={quartier} onChange={(e) => setQuartier(e.target.value)} placeholder="Écrire le quartier" />
              </Etiquette>
              <div className="sm:col-span-2">
                <Etiquette texte="Repère exact">
                  <input className={champ} value={repere} onChange={(e) => setRepere(e.target.value)} placeholder="Ex : en face de la pharmacie" />
                </Etiquette>
              </div>
              <div className="sm:col-span-2">
                <Etiquette texte="Type de boutique (détermine les prix)">
                  <select className={champ} value={typeId} onChange={(e) => setTypeId(e.target.value)}>
                    <option value="">Non précisé — prix de base</option>
                    {types.map((t) => (
                      <option key={t.id} value={t.id}>{t.nom}</option>
                    ))}
                  </select>
                </Etiquette>
              </div>
            </div>
          )}
        </Section>

        <Section titre="Produits commandés" aide="Les prix sont appliqués automatiquement : prix de base, type de boutique, puis grille par quantité.">
          <div className="space-y-3">
            {produits.map((p) => {
              const q = quantites[p.code] ?? { sachets: 0, filets: 0, cartons: 0 };
              const montant = commande.sousTotaux.get(p.code) ?? 0;
              return (
                <div key={p.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                  <div className="mb-2 flex items-baseline justify-between gap-2">
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{p.nom}</p>
                    {montant > 0 && <p className="text-sm font-semibold tabular-nums text-[#359980]">{formatFcfa(montant)}</p>}
                  </div>
                  <div className={`grid gap-3 ${p.prixFilet !== null ? "grid-cols-3" : "grid-cols-2"}`}>
                    {(["sachets", ...(p.prixFilet !== null ? ["filets"] : []), "cartons"] as ("sachets" | "filets" | "cartons")[]).map((cle) => (
                      <Etiquette key={cle} texte={cle === "sachets" ? "Sachets" : cle === "filets" ? "Filets" : "Cartons"}>
                        <input
                          type="number"
                          min={0}
                          inputMode="numeric"
                          placeholder="0"
                          className={champ}
                          value={q[cle] || ""}
                          onChange={(e) => majQuantite(p.code, cle, Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                          onWheel={(e) => (e.target as HTMLInputElement).blur()}
                        />
                      </Etiquette>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      </div>

      <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
        <Section titre="Paiement">
          <div className="space-y-3">
            <BlocPaiement mode={modePaiement} onMode={setModePaiement} montant={commande.total} acompte={acompte} onAcompte={setAcompte} libelle="Paiement prévu" />
          </div>
        </Section>

        <Section titre="Livraison et suivi">
          <div className="space-y-3">
            <Etiquette texte="Date de livraison prévue">
              <input type="date" className={champ} value={livraison} onChange={(e) => setLivraison(e.target.value)} />
            </Etiquette>
            <Etiquette texte="Commercial concerné">
              <select className={champ} value={commercialId} onChange={(e) => setCommercialId(e.target.value)}>
                <option value="">Bureau (moi)</option>
                {commerciaux.map((c) => (
                  <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>
                ))}
              </select>
            </Etiquette>
          </div>
        </Section>

        <section className="rounded-2xl bg-[#1e3a8a] p-5 text-white shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-white/80">Total de la commande</p>
          <p className="mt-1 text-3xl font-bold tabular-nums">{formatFcfa(commande.total)}</p>
          {erreur && <p className="mt-3 rounded-lg bg-white/15 px-3 py-2 text-sm">{erreur}</p>}
          <button
            type="submit"
            disabled={envoi}
            className="mt-4 w-full rounded-xl bg-white py-3 text-sm font-bold text-[#1e3a8a] disabled:opacity-60"
          >
            {envoi ? "Enregistrement…" : "Enregistrer la commande"}
          </button>
          <Link href="/admin/commandes" className="mt-2 block text-center text-xs text-white/80 underline">
            Annuler
          </Link>
        </section>
      </div>
    </form>
  );
}
