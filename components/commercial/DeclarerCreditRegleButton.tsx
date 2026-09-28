"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Clock } from "lucide-react";

export function DeclarerCreditRegleButton({
  venteId,
  dejaDeclare,
}: {
  venteId: string;
  dejaDeclare: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (dejaDeclare) {
    return (
      <span className="flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700">
        <Clock size={11} />
        En attente de vérification
      </span>
    );
  }

  async function declarer() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/credits/${venteId}/declarer-regle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (res.ok) {
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Échec de la déclaration.");
    }
    setLoading(false);
  }

  return (
    <div className="mt-1">
      <button
        onClick={declarer}
        disabled={loading}
        className="flex items-center gap-1 rounded-md bg-green-50 px-2 py-1 text-[11px] font-semibold text-green-700 disabled:opacity-50"
      >
        <Check size={11} />
        {loading ? "..." : "Marquer réglé"}
      </button>
      {error && <p className="mt-1 text-[10px] text-alert">{error}</p>}
    </div>
  );
}
