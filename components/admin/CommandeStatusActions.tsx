"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Truck, XCircle, RotateCcw } from "lucide-react";

type Statut = "EN_ATTENTE" | "LIVREE" | "ANNULEE";

export function CommandeStatusActions({ id, statut }: { id: string; statut: Statut }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function updateStatut(nouveauStatut: Statut) {
    setSaving(true);
    const res = await fetch(`/api/commandes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statut: nouveauStatut }),
    });
    if (res.ok) {
      router.refresh();
    }
    setSaving(false);
  }

  if (statut === "EN_ATTENTE") {
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
      className="flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-500 disabled:opacity-50"
    >
      <RotateCcw size={13} />
      Réactiver
    </button>
  );
}
