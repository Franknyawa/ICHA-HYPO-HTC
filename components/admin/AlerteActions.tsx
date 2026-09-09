"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, RefreshCw } from "lucide-react";

export function ResoudreButton({ id }: { id: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function resoudre() {
    setLoading(true);
    await fetch(`/api/alertes/${id}`, { method: "PATCH" });
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
