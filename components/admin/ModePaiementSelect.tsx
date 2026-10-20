"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/client/apiFetch";
import { LIBELLE_MODE_PAIEMENT, type ModePaiementId } from "@/lib/utils/documents";

/** Liste déroulante qui corrige le mode de paiement d'une vente ou d'une commande. */
export function ModePaiementSelect({
  type,
  id,
  valeur,
  modifiable = true,
}: {
  type: "VENTE" | "COMMANDE";
  id: string;
  valeur: string | null;
  modifiable?: boolean;
}) {
  const router = useRouter();
  const [courant, setCourant] = useState(valeur ?? "");
  const [envoi, setEnvoi] = useState(false);

  if (!modifiable) {
    return (
      <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
        {courant ? LIBELLE_MODE_PAIEMENT[courant as ModePaiementId] ?? courant : "Paiement à définir"}
      </span>
    );
  }

  async function changer(nouveau: string) {
    const ancien = courant;
    setCourant(nouveau);
    setEnvoi(true);
    try {
      await apiFetch(`/api/${type === "VENTE" ? "ventes" : "commandes"}/${id}/mode-paiement`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modePaiement: nouveau }),
      });
      router.refresh();
    } catch (e) {
      setCourant(ancien);
      alert(e instanceof ApiError ? e.message : "Échec de la modification.");
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <select
        value={courant}
        onChange={(e) => changer(e.target.value)}
        disabled={envoi}
        aria-label="Mode de paiement"
        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
      >
        {!courant && <option value="">Paiement à définir</option>}
        {(Object.keys(LIBELLE_MODE_PAIEMENT) as ModePaiementId[]).map((m) => (
          <option key={m} value={m}>
            {LIBELLE_MODE_PAIEMENT[m]}
          </option>
        ))}
      </select>
      {envoi && <Loader2 size={13} className="animate-spin text-slate-400" />}
    </span>
  );
}
