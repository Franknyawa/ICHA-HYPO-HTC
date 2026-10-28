"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Hash, Loader2 } from "lucide-react";

export function AttribuerCodesButton({ manquants }: { manquants: number }) {
  const router = useRouter();
  const [envoi, setEnvoi] = useState(false);
  async function lancer() {
    if (!window.confirm(`Attribuer un code client aux ${manquants} client(s) qui n'en ont pas ? Les codes ne changent plus ensuite.`)) return;
    setEnvoi(true);
    try {
      const res = await fetch("/api/clients/codes", { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) return alert(d.error ?? "Échec de l'attribution.");
      alert(`${d.nb} code(s) client attribué(s).`);
      router.refresh();
    } finally {
      setEnvoi(false);
    }
  }
  return (
    <button onClick={lancer} disabled={envoi || manquants === 0} className="flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
      {envoi ? <Loader2 size={15} className="animate-spin" /> : <Hash size={15} />}
      Attribuer les codes clients ({manquants})
    </button>
  );
}
