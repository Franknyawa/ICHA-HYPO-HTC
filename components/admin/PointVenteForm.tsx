"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Save, X } from "lucide-react";

type Option = { id: string; nom: string };
export type PointVenteEditable = {
  id: string;
  nom: string;
  vendeur: string | null;
  telephoneVendeur: string | null;
  repondantRole: string | null;
  repondantFonction: string | null;
  patronNom: string | null;
  telephonePatron: string | null;
  villeId: string;
  quartierId: string | null;
  repere: string | null;
  typesIds: string[];
  typeAutre: string | null;
  presentoir: boolean;
  latitude: number | null;
  longitude: number | null;
};

const champ =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";

function Etiquette({ t, children }: { t: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">
      {t}
      <div className="mt-1">{children}</div>
    </label>
  );
}

/** Modification des données recensées d'un point de vente (administrateur). */
export function PointVenteForm({
  pv,
  villes,
  quartiers,
  types,
}: {
  pv: PointVenteEditable;
  villes: Option[];
  quartiers: (Option & { villeId: string })[];
  types: Option[];
}) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [f, setF] = useState(pv);
  const set = <K extends keyof PointVenteEditable>(k: K, v: PointVenteEditable[K]) => setF((x) => ({ ...x, [k]: v }));
  const quartiersVille = quartiers.filter((q) => q.villeId === f.villeId);

  async function enregistrer(e: React.FormEvent) {
    e.preventDefault();
    setEnvoi(true);
    setErreur(null);
    const vide = (s: string | null) => (s && s.trim() ? s.trim() : null);
    try {
      const res = await fetch(`/api/points-vente/${pv.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nom: f.nom.trim(),
          vendeur: vide(f.vendeur),
          telephoneVendeur: vide(f.telephoneVendeur),
          repondantRole: f.repondantRole || null,
          repondantFonction: f.repondantRole === "AUTRE" ? vide(f.repondantFonction) : null,
          patronNom: vide(f.patronNom),
          telephonePatron: vide(f.telephonePatron),
          villeId: f.villeId,
          quartierId: f.quartierId || null,
          repere: vide(f.repere),
          typesIds: f.typesIds,
          typeId: f.typesIds[0] ?? null,
          typeAutre: vide(f.typeAutre),
          presentoir: f.presentoir,
          latitude: f.latitude,
          longitude: f.longitude,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setErreur(d.error ?? "Échec de l'enregistrement.");
        return;
      }
      setOuvert(false);
      router.refresh();
    } finally {
      setEnvoi(false);
    }
  }

  if (!ouvert) {
    return (
      <button
        onClick={() => setOuvert(true)}
        className="flex items-center gap-1.5 rounded-xl bg-brand px-3.5 py-2 text-sm font-semibold text-white print:hidden"
      >
        <Pencil size={15} /> Mettre à jour les données
      </button>
    );
  }

  return (
    <form onSubmit={enregistrer} className="space-y-3 rounded-2xl bg-white p-5 shadow-sm ring-2 ring-brand/30 dark:bg-slate-900 print:hidden">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">Mettre à jour les données recensées</h2>
        <button type="button" onClick={() => { setF(pv); setOuvert(false); }} aria-label="Fermer" className="text-slate-400">
          <X size={18} />
        </button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Etiquette t="Nom du point de vente">
          <input required minLength={2} value={f.nom} onChange={(e) => set("nom", e.target.value)} className={champ} />
        </Etiquette>
        <Etiquette t="Qui nous répond ?">
          <select value={f.repondantRole ?? ""} onChange={(e) => set("repondantRole", e.target.value || null)} className={champ}>
            <option value="">Non précisé</option>
            <option value="PATRON">Patron</option>
            <option value="GERANT">Gérant</option>
            <option value="EMPLOYE">Employé</option>
            <option value="AUTRE">Autre</option>
          </select>
        </Etiquette>
        {f.repondantRole === "AUTRE" && (
          <Etiquette t="Précision (fonction)">
            <input value={f.repondantFonction ?? ""} onChange={(e) => set("repondantFonction", e.target.value)} className={champ} />
          </Etiquette>
        )}
        <Etiquette t="Nom de l'interlocuteur">
          <input value={f.vendeur ?? ""} onChange={(e) => set("vendeur", e.target.value)} className={champ} />
        </Etiquette>
        <Etiquette t="Téléphone de l'interlocuteur">
          <input value={f.telephoneVendeur ?? ""} onChange={(e) => set("telephoneVendeur", e.target.value)} inputMode="tel" className={champ} />
        </Etiquette>
        <Etiquette t="Nom du patron">
          <input value={f.patronNom ?? ""} onChange={(e) => set("patronNom", e.target.value)} className={champ} />
        </Etiquette>
        <Etiquette t="Téléphone du patron">
          <input value={f.telephonePatron ?? ""} onChange={(e) => set("telephonePatron", e.target.value)} inputMode="tel" className={champ} />
        </Etiquette>
        <Etiquette t="Ville">
          <select
            value={f.villeId}
            onChange={(e) => setF((x) => ({ ...x, villeId: e.target.value, quartierId: null }))}
            className={champ}
          >
            {villes.map((v) => (
              <option key={v.id} value={v.id}>{v.nom}</option>
            ))}
          </select>
        </Etiquette>
        <Etiquette t="Quartier">
          <select value={f.quartierId ?? ""} onChange={(e) => set("quartierId", e.target.value || null)} className={champ}>
            <option value="">Aucun</option>
            {quartiersVille.map((q) => (
              <option key={q.id} value={q.id}>{q.nom}</option>
            ))}
          </select>
        </Etiquette>
        <div className="md:col-span-2">
          <Etiquette t="Repère">
            <input value={f.repere ?? ""} onChange={(e) => set("repere", e.target.value)} className={champ} />
          </Etiquette>
        </div>
        <div className="md:col-span-2">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Type(s) de point de vente</p>
          <div className="mt-1 flex flex-wrap gap-2">
            {types.map((t) => {
              const actif = f.typesIds.includes(t.id);
              return (
                <button
                  type="button"
                  key={t.id}
                  onClick={() => set("typesIds", actif ? f.typesIds.filter((x) => x !== t.id) : [...f.typesIds, t.id])}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                    actif ? "border-brand bg-brand text-white" : "border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300"
                  }`}
                >
                  {t.nom}
                </button>
              );
            })}
          </div>
        </div>
        <Etiquette t="Autre type (précision libre)">
          <input value={f.typeAutre ?? ""} onChange={(e) => set("typeAutre", e.target.value)} className={champ} />
        </Etiquette>
        <label className="flex items-center gap-2 pt-5 text-sm text-slate-700 dark:text-slate-200">
          <input type="checkbox" checked={f.presentoir} onChange={(e) => set("presentoir", e.target.checked)} />
          Présentoir installé
        </label>
        <Etiquette t="Latitude">
          <input
            type="number"
            step="any"
            value={f.latitude ?? ""}
            onChange={(e) => set("latitude", e.target.value === "" ? null : Number(e.target.value))}
            className={champ}
          />
        </Etiquette>
        <Etiquette t="Longitude">
          <input
            type="number"
            step="any"
            value={f.longitude ?? ""}
            onChange={(e) => set("longitude", e.target.value === "" ? null : Number(e.target.value))}
            className={champ}
          />
        </Etiquette>
      </div>
      {erreur && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{erreur}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => { setF(pv); setOuvert(false); }} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300">
          Annuler
        </button>
        <button disabled={envoi} className="flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
          {envoi ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          Enregistrer
        </button>
      </div>
    </form>
  );
}
