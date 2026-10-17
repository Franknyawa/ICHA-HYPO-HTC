"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Loader2 } from "lucide-react";

/** Archive ou restaure un élément via une route POST { archive }. */
export function ArchiveButton({
  url,
  archive,
  label,
  confirmation,
  compact = false,
}: {
  url: string;
  archive: boolean;
  label?: string;
  confirmation?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [envoi, setEnvoi] = useState(false);

  async function lancer() {
    if (confirmation && !window.confirm(confirmation)) return;
    setEnvoi(true);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archive }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error ?? "Échec de l'opération.");
        return;
      }
      router.refresh();
    } finally {
      setEnvoi(false);
    }
  }

  const Icone = envoi ? Loader2 : archive ? Archive : ArchiveRestore;
  return (
    <button
      onClick={lancer}
      disabled={envoi}
      className={`flex items-center gap-1.5 rounded-xl font-semibold disabled:opacity-60 print:hidden ${
        archive
          ? "bg-orange-50 text-orange-700 hover:bg-orange-100 dark:bg-orange-950/40 dark:text-orange-300"
          : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300"
      } ${compact ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-sm"}`}
    >
      <Icone size={compact ? 13 : 15} className={envoi ? "animate-spin" : ""} />
      {label ?? (archive ? "Archiver" : "Restaurer")}
    </button>
  );
}

/** Archive toutes les commandes terminées depuis plus de N jours. */
export function ArchiverAnciennesButton({ jours = 30 }: { jours?: number }) {
  const router = useRouter();
  const [envoi, setEnvoi] = useState(false);

  async function lancer() {
    if (!window.confirm(`Archiver toutes les commandes livrées ou annulées depuis plus de ${jours} jours ?`)) return;
    setEnvoi(true);
    try {
      const res = await fetch("/api/commandes/archiver-anciennes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jours }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) return alert(d.error ?? "Échec de l'opération.");
      alert(`${d.archivees ?? 0} commande(s) archivée(s).`);
      router.refresh();
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <button
      onClick={lancer}
      disabled={envoi}
      className="flex items-center gap-1.5 rounded-xl border border-orange-200 bg-white px-3 py-2 text-sm font-semibold text-orange-700 shadow-sm hover:bg-orange-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-orange-300 print:hidden"
    >
      <Archive size={15} />
      Archiver les terminées (+{jours} j)
    </button>
  );
}
