"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, RefreshCw, X } from "lucide-react";

export function ResoudreButton({ id }: { id: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function resoudre() {
    setLoading(true);
    await fetch(`/api/alertes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "resoudre" }),
    });
    router.refresh();
    setLoading(false);
  }

  return (
    <button
      onClick={resoudre}
      disabled={loading}
      className="flex items-center gap-1 rounded-lg bg-green-50 px-2.5 py-1.5 text-xs font-semibold text-green-700 disabled:opacity-50"
    >
      <Check size={13} />
      Résolue
    </button>
  );
}

/**
 * Pour une alerte EN_ATTENTE_VERIFICATION (le commercial a déclaré un
 * crédit réglé) : l'admin confirme (-> RESOLUE, le crédit sort du suivi)
 * ou rejette (-> ACTIVE, la déclaration est écartée, le crédit reste dû).
 */
export function VerifierAlerteButtons({ id }: { id: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<"confirmer" | "rejeter" | null>(null);

  async function agir(action: "resoudre" | "rejeter") {
    setLoading(action === "resoudre" ? "confirmer" : "rejeter");
    await fetch(`/api/alertes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    router.refresh();
    setLoading(null);
  }

  return (
    <div className="flex gap-1.5">
      <button
        onClick={() => agir("resoudre")}
        disabled={loading !== null}
        className="flex items-center gap-1 rounded-lg bg-green-50 px-2.5 py-1.5 text-xs font-semibold text-green-700 disabled:opacity-50"
      >
        <Check size={13} />
        {loading === "confirmer" ? "..." : "Confirmer"}
      </button>
      <button
        onClick={() => agir("rejeter")}
        disabled={loading !== null}
        className="flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-alert disabled:opacity-50"
      >
        <X size={13} />
        {loading === "rejeter" ? "..." : "Rejeter"}
      </button>
    </div>
  );
}

export function GenererAlertesButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function generer() {
    setLoading(true);
    await fetch("/api/alertes/generer", { method: "POST" });
    router.refresh();
    setLoading(false);
  }

  return (
    <button
      onClick={generer}
      disabled={loading}
      className="flex items-center gap-1.5 rounded-xl bg-brand px-3 py-2 text-sm font-semibold text-white disabled:opacity-70"
    >
      <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
      {loading ? "Génération..." : "Générer maintenant"}
    </button>
  );
}
