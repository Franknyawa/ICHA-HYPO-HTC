"use client";

import { useEffect, useState } from "react";
import { Printer, X, Loader2 } from "lucide-react";
import { SiriMark } from "@/components/brand/SiriMark";
import { formatMontant } from "@/lib/utils/format";
import type { ApercuRapport as Apercu } from "@/lib/queries/rapports";

const fcfa = (n: number) => `${formatMontant(n)} FCFA`;
const qte = (n: number) => (Number.isInteger(n) ? String(n) : String(n).replace(".", ","));

/**
 * Fiche détaillée d'une ligne de rapport, imprimable seule : à l'impression,
 * tout le reste de la page est masqué (règles `apercu-actif` dans globals.css).
 * Toujours en clair (papier), même en mode sombre.
 */
export function ApercuRapport({
  vue,
  cle,
  query,
  filtreLabel,
  onClose,
}: {
  vue: string;
  cle: string;
  /** Filtres de la page, déjà encodés (sans vue ni clé) */
  query: string;
  filtreLabel: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<Apercu | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.classList.add("apercu-actif");
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.documentElement.classList.remove("apercu-actif");
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  useEffect(() => {
    let annule = false;
    const sp = new URLSearchParams(query);
    sp.set("vue", vue);
    sp.set("cle", cle);
    fetch(`/api/rapports/detail?${sp.toString()}`)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error ?? "Aperçu indisponible.");
        if (!annule) setData(d);
      })
      .catch((e) => !annule && setErreur(e instanceof Error ? e.message : "Aperçu indisponible."));
    return () => {
      annule = true;
    };
  }, [vue, cle, query]);

  const m = data?.mesures;
  const tuiles = m
    ? vue === "vente" || vue === "produit"
      ? [
          ["Cartons vendus", qte(Math.round(m.cartons * 10) / 10)],
          ["Chiffre d'affaires", fcfa(m.ca)],
          ["Reste à payer", fcfa(m.reste)],
          ...(vue === "produit" ? [["Ventes", String(m.nbVentes)]] : []),
        ]
      : [
          ["Points de vente recensés", String(m.pointsVente)],
          ["Visites", String(m.visites)],
          ["Commandes", String(m.commandes)],
          ["Ventes", String(m.nbVentes)],
          ["Cartons vendus", qte(Math.round(m.cartons * 10) / 10)],
          ["Chiffre d'affaires", fcfa(m.ca)],
          ["Reste à payer", fcfa(m.reste)],
        ]
    : [];

  return (
    <div
      id="apercu-root"
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/50 p-3 md:p-8"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="apercu-carte w-full max-w-4xl rounded-2xl bg-white p-5 text-slate-900 shadow-2xl md:p-8">
        <div className="apercu-no-print mb-4 flex items-center justify-end gap-2">
          <button
            onClick={() => window.print()}
            disabled={!data}
            className="flex items-center gap-1.5 rounded-xl bg-[#0a1630] px-3.5 py-2 text-sm font-semibold text-[#f3dc9b] disabled:opacity-50"
          >
            <Printer size={15} />
            Imprimer
          </button>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600"
          >
            <X size={16} />
          </button>
        </div>

        {/* En-tête de marque */}
        <div className="mb-5 flex items-center justify-between border-b border-slate-200 pb-4">
          <div className="flex items-center gap-3">
            <SiriMark size={40} idSuffix="apercu" />
            <div>
              <p className="text-base font-bold tracking-widest text-[#0a1630]">SIRI IMPORT</p>
              <p className="text-xs text-slate-500">Rapport commercial</p>
            </div>
          </div>
          <p className="text-xs text-slate-500">Généré le {new Date().toLocaleDateString("fr-FR")}</p>
        </div>

        {!data && !erreur && (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
            <Loader2 size={16} className="animate-spin" /> Chargement de l&apos;aperçu...
          </div>
        )}
        {erreur && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{erreur}</p>}

        {data && (
          <>
            <h2 className="text-xl font-bold text-slate-900">{data.titre}</h2>
            {data.sousTitre && <p className="text-sm text-slate-600">{data.sousTitre}</p>}
            {filtreLabel && <p className="mt-1 text-xs text-slate-500">{filtreLabel}</p>}

            <div className="my-5 grid grid-cols-2 gap-2.5 md:grid-cols-4">
              {tuiles.map(([label, valeur]) => (
                <div key={label} className="rounded-xl border border-slate-200 px-3 py-2.5 text-center">
                  <p className="text-base font-bold text-slate-900">{valeur}</p>
                  <p className="text-[11px] text-slate-500">{label}</p>
                </div>
              ))}
            </div>

            {vue !== "produit" && (
              <>
                <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-700">Détail par produit</h3>
                <div className="mb-6 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-300 text-xs text-slate-500">
                        <th className="py-2 pr-3">Produit</th>
                        <th className="py-2 pr-3">Gamme</th>
                        <th className="py-2 pr-3">Quantités</th>
                        <th className="py-2 pr-3 text-right">Cartons</th>
                        <th className="py-2 pr-3 text-right">CA</th>
                        <th className="py-2 text-right">% du CA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.produits.map((p) => (
                        <tr key={p.code} className="border-b border-slate-100">
                          <td className="py-2 pr-3 font-medium">{p.code} — {p.nom}</td>
                          <td className="py-2 pr-3 text-slate-600">{p.gamme}</td>
                          <td className="py-2 pr-3 text-slate-600">{p.quantites}</td>
                          <td className="py-2 pr-3 text-right">{qte(p.cartons)}</td>
                          <td className="py-2 pr-3 text-right">{fcfa(p.ca)}</td>
                          <td className="py-2 text-right">{qte(p.part)} %</td>
                        </tr>
                      ))}
                      {data.produits.length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-4 text-center text-slate-400">Aucune vente sur cette période.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-700">
              {vue === "vente" ? "Informations de la vente" : "Ventes"}
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-300 text-xs text-slate-500">
                    <th className="py-2 pr-3">Date</th>
                    <th className="py-2 pr-3">Commercial</th>
                    <th className="py-2 pr-3">Point de vente</th>
                    <th className="py-2 pr-3">Ville</th>
                    <th className="py-2 pr-3 text-right">Cartons</th>
                    <th className="py-2 pr-3 text-right">CA</th>
                    <th className="py-2 pr-3 text-right">Payé</th>
                    <th className="py-2 text-right">Reste</th>
                  </tr>
                </thead>
                <tbody>
                  {data.ventes.map((v) => (
                    <tr key={v.id} className="border-b border-slate-100">
                      <td className="whitespace-nowrap py-2 pr-3">{new Date(v.date).toLocaleDateString("fr-FR")}</td>
                      <td className="py-2 pr-3">{v.commercial}</td>
                      <td className="py-2 pr-3">{v.pointVente}{v.client ? ` (${v.client})` : ""}</td>
                      <td className="py-2 pr-3">{v.ville}</td>
                      <td className="py-2 pr-3 text-right">{qte(v.cartons)}</td>
                      <td className="whitespace-nowrap py-2 pr-3 text-right">{fcfa(v.ca)}</td>
                      <td className="whitespace-nowrap py-2 pr-3 text-right">{fcfa(v.paye)}</td>
                      <td className="whitespace-nowrap py-2 text-right font-semibold">{fcfa(v.reste)}</td>
                    </tr>
                  ))}
                  {data.ventes.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-4 text-center text-slate-400">Aucune vente.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {data.ventesTronquees && (
              <p className="mt-2 text-xs text-slate-500">
                Seules les 150 ventes les plus récentes sont listées ; les totaux ci-dessus portent sur toutes les ventes.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
