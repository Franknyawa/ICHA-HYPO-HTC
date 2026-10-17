"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArchiveRestore } from "lucide-react";

/** Réactive un compte désactivé (archivé). */
export function RestaurerUtilisateurButton({ id }: { id: string }) {
  const router = useRouter();
  const [envoi, setEnvoi] = useState(false);
  async function lancer() {
    setEnvoi(true);
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actif: true }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        return alert(d.error ?? "Échec de la réactivation.");
      }
      router.refresh();
    } finally {
      setEnvoi(false);
    }
  }
  return (
    <button
      onClick={lancer}
      disabled={envoi}
      className="flex items-center gap-1.5 rounded-xl bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60 dark:bg-emerald-950/40 dark:text-emerald-300"
    >
      <ArchiveRestore size={13} />
      Réactiver
    </button>
  );
}
