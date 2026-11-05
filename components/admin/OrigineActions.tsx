"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, Trash2, X } from "lucide-react";

/** Corriger ou supprimer une ligne du détail CLIENT DIVERS (admin / super admin, commande non livrée). */
export function OrigineActions({
  commandeId,
  origineId,
  nbSachets,
  nbFilets,
  lieu,
}: {
  commandeId: string;
  origineId: string;
  nbSachets: number;
  nbFilets: number;
  lieu: string | null;
}) {
  const router = useRouter();
  const [edition, setEdition] = useState(false);
  const [s, setS] = useState(String(nbSachets));
  const [f, setF] = useState(String(nbFilets));
  const [l, setL] = useState(lieu ?? "");
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const url = `/api/commandes/${commandeId}/origines/${origineId}`;

  async function envoyer(init: RequestInit) {
    setBusy(true);
    setErreur(null);
    try {
      const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErreur(d.error ?? "Échec de la modification.");
        return;
      }
      setEdition(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const champ = "w-16 rounded-md border border-slate-200 bg-white px-1.5 py-1 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-900";

  if (!edition)
    return (
      <span className="ml-2 inline-flex items-center gap-1 align-middle">
        <button type="button" onClick={() => setEdition(true)} aria-label="Modifier" className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800">
          <Pencil size={13} />
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => confirm("Supprimer cette ligne du détail ? La facture sera recalculée.") && envoyer({ method: "DELETE" })}
          aria-label="Supprimer"
          className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950"
        >
          <Trash2 size={13} />
        </button>
        {erreur && <span className="text-[11px] text-rose-600">{erreur}</span>}
      </span>
    );

  return (
    <span className="mt-1 flex w-full flex-wrap items-center gap-1.5">
      <label className="text-[11px] text-slate-500">Sachets <input type="number" min={0} value={s} onChange={(e) => setS(e.target.value)} className={champ} /></label>
      <label className="text-[11px] text-slate-500">Filets <input type="number" min={0} value={f} onChange={(e) => setF(e.target.value)} className={champ} /></label>
      <label className="text-[11px] text-slate-500">Lieu <input value={l} onChange={(e) => setL(e.target.value)} className={`${champ} w-36`} /></label>
      <button
        type="button"
        disabled={busy}
        onClick={() => envoyer({ method: "PATCH", body: JSON.stringify({ nbSachets: Number(s) || 0, nbFilets: Number(f) || 0, lieu: l }) })}
        aria-label="Enregistrer"
        className="rounded-md bg-emerald-600 p-1.5 text-white"
      >
        <Check size={13} />
      </button>
      <button type="button" onClick={() => setEdition(false)} aria-label="Annuler" className="rounded-md bg-slate-100 p-1.5 text-slate-600 dark:bg-slate-800">
        <X size={13} />
      </button>
      {erreur && <span className="text-[11px] text-rose-600">{erreur}</span>}
    </span>
  );
}
