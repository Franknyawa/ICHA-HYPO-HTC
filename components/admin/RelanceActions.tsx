"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, PhoneCall, RotateCcw, XCircle } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/client/apiFetch";

type Statut = "A_RELANCER" | "CONVERTI" | "ABANDONNE";

function dansJours(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Actions sur un prospect indécis : relancé (avec la prochaine date), converti, abandonné, rouvrir. */
export function RelanceActions({ id, statut, produits, cartonsEstimes }: { id: string; statut: Statut; produits: { code: string; nom: string }[]; cartonsEstimes?: number | null }) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [conversion, setConversion] = useState(false);
  const [cartons, setCartons] = useState<Record<string, number>>(() => (produits[0] && cartonsEstimes ? { [produits[0].code]: cartonsEstimes } : {}));
  const [date, setDate] = useState(dansJours(3));
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function envoyer(corps: Record<string, unknown>) {
    setSaving(true);
    setErreur(null);
    try {
      await apiFetch(`/api/relances/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corps),
      });
      setOuvert(false);
      setNote("");
      router.refresh();
    } catch (e) {
      setErreur(e instanceof ApiError ? e.message : "Action impossible.");
    } finally {
      setSaving(false);
    }
  }

  const iso = () => new Date(`${date}T09:00:00`).toISOString();
  const bouton = "flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold disabled:opacity-50";

  if (statut !== "A_RELANCER") {
    return (
      <button onClick={() => envoyer({ action: "reouvrir", dateRelance: new Date(`${dansJours(3)}T09:00:00`).toISOString() })} disabled={saving} className={`${bouton} bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400`}>
        <RotateCcw size={13} /> Rouvrir
      </button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-1.5">
        <button onClick={() => { setOuvert((v) => !v); setConversion(false); }} className={`${bouton} bg-blue-50 text-brand`}>
          <PhoneCall size={13} /> Relancé
        </button>
        <button onClick={() => { setConversion((v) => !v); setOuvert(false); }} disabled={saving} className={`${bouton} bg-green-50 text-green-700`}>
          <CheckCircle2 size={13} /> Converti
        </button>
        <button onClick={() => envoyer({ action: "abandonne" })} disabled={saving} className={`${bouton} bg-red-50 text-alert`}>
          <XCircle size={13} /> Abandonné
        </button>
      </div>
      {ouvert && (
        <div className="w-full min-w-[16rem] space-y-2 rounded-xl border border-slate-200 bg-white p-3 text-left dark:border-slate-700 dark:bg-slate-900">
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">
            Prochaine relance
            <input type="date" value={date} min={dansJours(0)} onChange={(e) => setDate(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950" />
          </label>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">
            Ce qu&apos;il a répondu (facultatif)
            <input value={note} onChange={(e) => setNote(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950" />
          </label>
          <button onClick={() => envoyer({ action: "relance", dateRelance: iso(), note })} disabled={saving} className="w-full rounded-lg bg-[#1e3a8a] py-2 text-xs font-bold text-white disabled:opacity-50">
            Enregistrer la relance
          </button>
        </div>
      )}
      {conversion && (
        <div className="w-full min-w-[16rem] space-y-2 rounded-xl border border-slate-200 bg-white p-3 text-left dark:border-slate-700 dark:bg-slate-900">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Cartons demandés</p>
          {produits.map((p) => (
            <label key={p.code} className="flex items-center justify-between gap-3 text-sm text-slate-700 dark:text-slate-200">
              {p.nom}
              <input type="number" min={0} inputMode="numeric" value={cartons[p.code] || ""} onChange={(e) => setCartons((c) => ({ ...c, [p.code]: Math.max(0, Math.floor(Number(e.target.value) || 0)) }))} className="w-24 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-right text-sm dark:border-slate-700 dark:bg-slate-950" />
            </label>
          ))}
          <button
            onClick={() => envoyer({ action: "converti", lignes: produits.map((p) => ({ produitCode: p.code, nbCartons: cartons[p.code] || 0 })) })}
            disabled={saving || !Object.values(cartons).some((n) => n > 0)}
            className="w-full rounded-lg bg-[#1e3a8a] py-2 text-xs font-bold text-white disabled:opacity-50"
          >
            Valider : créer la commande
          </button>
          <p className="text-[11px] text-slate-400">La commande part dans « Commandes » (en attente), aux prix du catalogue.</p>
        </div>
      )}
      {erreur && <p className="text-[11px] text-alert">{erreur}</p>}
    </div>
  );
}
