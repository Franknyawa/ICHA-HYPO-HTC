"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Truck, XCircle, RotateCcw } from "lucide-react";

type Statut = "EN_ATTENTE" | "EN_LIVRAISON" | "LIVREE" | "ANNULEE";

function versInput(d?: string | null) {
  return d ? new Date(d).toISOString().slice(0, 10) : "";
}

export function CommandeStatusActions({
  id,
  statut,
  dateLivraisonPrevue,
}: {
  id: string;
  statut: Statut;
  dateLivraisonPrevue?: string | Date | null;
}) {
  const initiale = versInput(dateLivraisonPrevue ? new Date(dateLivraisonPrevue).toISOString() : null);
  const [date, setDate] = useState(initiale);
  const modifiee = date !== initiale;
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function updateStatut(nouveauStatut: Statut) {
    setSaving(true);
    setErreur(null);
    const res = await fetch(`/api/commandes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statut: nouveauStatut, ...(modifiee ? { dateLivraisonPrevue: date || null } : {}) }),
    });
    if (res.ok) {
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setErreur(d.error ?? "Action impossible.");
    }
    setSaving(false);
  }

  async function enregistrerDate() {
    setSaving(true);
    setErreur(null);
    const res = await fetch(`/api/commandes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dateLivraisonPrevue: date || null }),
    });
    if (res.ok) router.refresh();
    else setErreur((await res.json().catch(() => ({}))).error ?? "Action impossible.");
    setSaving(false);
  }

  const champDate =
    statut === "EN_ATTENTE" || statut === "EN_LIVRAISON" ? (
      <div className="flex items-center gap-1.5">
        <label className="text-[11px] text-slate-500 dark:text-slate-400">Livraison</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
        />
        {modifiee && (
          <button
            onClick={enregistrerDate}
            disabled={saving}
            className="rounded-lg bg-brand px-2 py-1 text-xs font-semibold text-white disabled:opacity-50"
          >
            Enregistrer
          </button>
        )}
      </div>
    ) : null;

  const boutons = (() => {
  if (statut === "EN_ATTENTE") {
    return (
      <div className="flex gap-1.5">
        <button
          onClick={() => updateStatut("EN_LIVRAISON")}
          disabled={saving}
          title="Valider : autorise la livraison, débite le stock et notifie le commercial"
          className="flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-brand disabled:opacity-50"
        >
          <CheckCircle2 size={13} />
          Valider et autoriser la livraison
        </button>
        <button
          onClick={() => updateStatut("ANNULEE")}
          disabled={saving}
          className="flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-alert disabled:opacity-50"
        >
          <XCircle size={13} />
          Annuler
        </button>
      </div>
    );
  }

  if (statut === "EN_LIVRAISON") {
    return (
      <div className="flex gap-1.5">
        <button
          onClick={() => updateStatut("LIVREE")}
          disabled={saving}
          className="flex items-center gap-1 rounded-lg bg-green-50 px-2.5 py-1.5 text-xs font-semibold text-green-700 disabled:opacity-50"
        >
          <Truck size={13} />
          Livrée
        </button>
        <button
          onClick={() => updateStatut("ANNULEE")}
          disabled={saving}
          className="flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-alert disabled:opacity-50"
        >
          <XCircle size={13} />
          Annuler
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => updateStatut("EN_ATTENTE")}
      disabled={saving}
      className="flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 dark:text-slate-500 disabled:opacity-50"
    >
      <RotateCcw size={13} />
      Réactiver
    </button>
  );
  })();

  return (
    <div className="flex flex-col items-start gap-1.5">
      {champDate}
      {boutons}
      {erreur && <p className="max-w-[220px] text-[11px] text-alert">{erreur}</p>}
    </div>
  );
}
