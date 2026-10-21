"use client";

import { Clock } from "lucide-react";
import { Carte, Champ, Saisie, ZoneTexte } from "@/components/commercial/form-ui";

export type EtatIndecis = {
  actif: boolean;
  /** Date de relance au format AAAA-MM-JJ. */
  dateRelance: string;
  cartons: number;
  note: string;
};

/** Date par défaut : dans 3 jours. */
export function dateRelanceParDefaut(): string {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  return d.toISOString().slice(0, 10);
}

export const ETAT_INDECIS_INITIAL: EtatIndecis = { actif: false, dateRelance: dateRelanceParDefaut(), cartons: 0, note: "" };

/** Charge utile envoyée à l'API, ou rien si le client n'est pas indécis. */
export function payloadIndecis(e: EtatIndecis) {
  if (!e.actif || !e.dateRelance) return {};
  return {
    indecis: {
      uuidClient: crypto.randomUUID(),
      dateRelance: new Date(`${e.dateRelance}T09:00:00`).toISOString(),
      cartonsEstimes: e.cartons > 0 ? e.cartons : undefined,
      note: e.note.trim() || undefined,
    },
  };
}

/** Case « client indécis » : enregistre le point de vente pour le relancer plus tard. */
export function BlocIndecis({ valeur, onChange }: { valeur: EtatIndecis; onChange: (e: EtatIndecis) => void }) {
  return (
    <Carte titre="Client indécis ?" icone={Clock} accent="orange" description="Il n'est pas encore fixé sur le nombre de cartons : on le relancera plus tard.">
      <label className="flex items-center gap-3 text-sm font-medium text-slate-700 dark:text-slate-300">
        <input
          type="checkbox"
          checked={valeur.actif}
          onChange={(e) => onChange({ ...valeur, actif: e.target.checked })}
          className="h-5 w-5 rounded border-slate-300"
        />
        Oui, à relancer plus tard
      </label>
      {valeur.actif && (
        <div className="mt-4 min-w-0 space-y-3">
          <Champ label="Date de relance">
            <Saisie type="date" value={valeur.dateRelance} min={new Date().toISOString().slice(0, 10)} onChange={(e) => onChange({ ...valeur, dateRelance: e.target.value })} />
          </Champ>
          <Champ label="Cartons envisagés (facultatif)">
            <Saisie type="number" min={0} inputMode="numeric" value={valeur.cartons || ""} onChange={(e) => onChange({ ...valeur, cartons: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} />
          </Champ>
          <Champ label="Remarque (facultatif)">
            <ZoneTexte rows={3} value={valeur.note} onChange={(e) => onChange({ ...valeur, note: e.target.value })} placeholder="Ce qu'il hésite à prendre, ce qu'il attend…" />
          </Champ>
        </div>
      )}
    </Carte>
  );
}
