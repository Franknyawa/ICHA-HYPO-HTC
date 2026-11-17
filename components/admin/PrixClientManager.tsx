"use client";

import { useCallback, useEffect, useState } from "react";
import { BadgePercent, Save } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/client/apiFetch";
import { PrixClientEditeur, erreurPrix, etatVide, nbProduitsNegocies, payloadPrix, type EtatPrix, type ProduitPrix } from "./PrixClientEditeur";

type Reponse = {
  produits: ProduitPrix[];
  prixClient: { produitId: string; prixCarton: number }[];
  paliersClient: { produitId: string; minCartons: number; maxCartons: number | null; prixCarton: number }[];
};

/**
 * Prix négociés avec ce client (grossiste) sur sa fiche : prix du carton fixe et/ou grille par quantité, par produit.
 * Ils passent avant les tarifs généraux. Vide = les tarifs généraux s'appliquent.
 */
export function PrixClientManager({ pointVenteId }: { pointVenteId: string }) {
  const [produits, setProduits] = useState<ProduitPrix[]>([]);
  const [etat, setEtat] = useState<EtatPrix>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ton: "ok" | "erreur"; texte: string } | null>(null);

  const charger = useCallback(() => {
    apiFetch<Reponse>(`/api/points-vente/${pointVenteId}/prix`)
      .then((r) => {
        const liste = r.produits ?? [];
        const e = etatVide(liste);
        for (const p of r.prixClient) if (e[p.produitId]) e[p.produitId].prixCarton = p.prixCarton;
        for (const p of r.paliersClient) e[p.produitId]?.paliers.push({ minCartons: p.minCartons, maxCartons: p.maxCartons ?? "", prixCarton: p.prixCarton });
        setProduits(liste);
        setEtat(e);
      })
      .catch((err: ApiError) => {
        if (err.status !== 401) setMessage({ ton: "erreur", texte: "Impossible de charger les prix du client." });
      })
      .finally(() => setLoading(false));
  }, [pointVenteId]);

  useEffect(charger, [charger]);

  const erreur = erreurPrix(produits, etat);
  const nb = nbProduitsNegocies(etat);

  async function enregistrer() {
    if (erreur) return setMessage({ ton: "erreur", texte: erreur });
    setSaving(true);
    try {
      await apiFetch(`/api/points-vente/${pointVenteId}/prix`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadPrix(produits, etat) ?? { produits: [] }),
      });
      setMessage({ ton: "ok", texte: "Prix du client enregistrés. Ils s'appliquent aux prochaines commandes et ventes." });
      charger();
    } catch (e) {
      setMessage({ ton: "erreur", texte: e instanceof ApiError ? e.message : "Échec de l'enregistrement." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800 print:hidden">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#359980] text-white">
          <BadgePercent size={16} />
        </span>
        <h2 className="font-bold text-slate-800 dark:text-slate-100">Prix négociés de ce client</h2>
        {nb > 0 && (
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            {nb} produit{nb > 1 ? "s" : ""}
          </span>
        )}
      </div>
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
        Ces prix remplacent les tarifs généraux pour ce client uniquement. Un prix par palier prime sur le prix fixe ; hors palier, le prix fixe
        s&apos;applique, puis les tarifs généraux. Les commandes déjà saisies gardent leur prix.
      </p>

      {loading ? (
        <p className="mt-3 text-sm text-slate-400">Chargement...</p>
      ) : (
        <div className="mt-3">
          <PrixClientEditeur produits={produits} etat={etat} onChange={(e) => { setMessage(null); setEtat(e); }} />
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button onClick={enregistrer} disabled={saving || !!erreur} className="flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              <Save size={15} /> {saving ? "Enregistrement..." : "Enregistrer les prix du client"}
            </button>
            {message && <p className={`text-sm ${message.ton === "ok" ? "text-emerald-700 dark:text-emerald-400" : "text-red-600"}`}>{message.texte}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
