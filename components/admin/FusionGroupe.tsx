"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GitMerge, Loader2, X } from "lucide-react";

type Membre = { id: string; nom: string; commandesValidees: number; commandes: number; telephone: string | null; quartier: string | null; ville: string | null };

/** Fusion d'un groupe de doublons : choix du profil conservé, du nom définitif et des fiches à fusionner. */
export function FusionGroupe({ membres }: { membres: Membre[] }) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [principal, setPrincipal] = useState(membres[0].id);
  const [inclus, setInclus] = useState<Set<string>>(new Set(membres.map((m) => m.id)));
  const [nom, setNom] = useState(membres[0].nom);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const doublons = membres.filter((m) => m.id !== principal && inclus.has(m.id));

  async function fusionner() {
    if (!window.confirm(`Fusionner ${doublons.length + 1} fiches en un seul profil « ${nom.trim()} » ?\\n\\nLes commandes, ventes, visites et photos sont regroupées. Le stock et la caisse ne changent pas. Les fiches en doublon sont archivées.`)) return;
    setEnvoi(true);
    setErreur(null);
    try {
      const res = await fetch("/api/points-vente/fusion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ principalId: principal, doublonIds: doublons.map((d) => d.id), nom }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) return setErreur(d.error ?? "Échec de la fusion.");
      setOuvert(false);
      router.refresh();
    } finally {
      setEnvoi(false);
    }
  }

  if (!ouvert) {
    return (
      <button onClick={() => setOuvert(true)} className="flex items-center gap-1.5 rounded-xl bg-brand px-3 py-1.5 text-xs font-bold text-white">
        <GitMerge size={14} /> Fusionner
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/50 p-4" onClick={(e) => e.target === e.currentTarget && setOuvert(false)}>
      <div className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-base font-extrabold text-slate-900 dark:text-slate-50">
            <GitMerge size={18} /> Fusionner ces fiches
          </h3>
          <button onClick={() => setOuvert(false)} aria-label="Fermer" className="text-slate-400"><X size={18} /></button>
        </div>

        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Fiches à regrouper — choisis celle à conserver</p>
        <div className="space-y-2">
          {membres.map((m) => (
            <label key={m.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm ${m.id === principal ? "border-brand bg-brand/5" : "border-slate-200 dark:border-slate-700"}`}>
              <input type="radio" name="principal" checked={m.id === principal} onChange={() => { setPrincipal(m.id); setInclus((s) => new Set(s).add(m.id)); }} className="mt-1" />
              <span className="min-w-0 flex-1">
                <span className="block font-bold text-slate-800 dark:text-slate-100">{m.nom}</span>
                <span className="block text-xs text-slate-500">
                  {m.commandesValidees} commande(s) validée(s) / {m.commandes} · {m.telephone ?? "pas de téléphone"} · {[m.quartier, m.ville].filter(Boolean).join(", ") || "—"}
                </span>
              </span>
              {m.id !== principal && (
                <label className="flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
                  <input type="checkbox" checked={inclus.has(m.id)} onChange={(e) => setInclus((s) => { const n = new Set(s); if (e.target.checked) n.add(m.id); else n.delete(m.id); return n; })} />
                  Fusionner
                </label>
              )}
            </label>
          ))}
        </div>

        <label className="mt-4 block text-xs font-bold uppercase tracking-wide text-slate-500">
          Nom définitif du client
          <input value={nom} onChange={(e) => setNom(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold normal-case text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" />
        </label>

        <p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs font-medium text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
          Les commandes, ventes, visites et photos sont regroupées sur la fiche conservée. Les informations manquantes (téléphone, patron, quartier…) sont complétées à partir des autres fiches.
          Le stock et la caisse ne changent pas. Les fiches fusionnées sont archivées, pas supprimées.
        </p>
        {erreur && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{erreur}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={() => setOuvert(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">Annuler</button>
          <button onClick={fusionner} disabled={envoi || doublons.length === 0 || nom.trim().length < 2} className="flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
            {envoi ? <Loader2 size={15} className="animate-spin" /> : <GitMerge size={15} />}
            Fusionner {doublons.length + 1} fiches
          </button>
        </div>
      </div>
    </div>
  );
}
