"use client";

// Kit de formulaire de l'espace terrain : un seul style, très épuré (fonds
// blancs, fins contours, aucune couleur d'accent décorative). Utilisé par le
// recensement, le réassort et la rotation.

import Link from "next/link";
import { ArrowLeft, ChevronDown } from "lucide-react";

const BLEU = "#1e3a8a";
const VERT = "#359980";

export const classeChamp =
  "w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-base text-slate-900 placeholder:text-slate-400 transition-colors focus:border-[#359980] focus:outline-none focus:ring-2 focus:ring-[#359980]/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500";

/** En-tête de page : retour, titre, sous-titre. Sobre, sans dégradé. */
export function EnTeteFormulaire({
  titre,
  sousTitre,
  retour = "/dashboard",
}: {
  titre: string;
  sousTitre?: string;
  retour?: string;
}) {
  return (
    <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200/80 bg-white/95 px-4 py-3.5 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
      <Link
        href={retour}
        aria-label="Retour"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        <ArrowLeft size={20} />
      </Link>
      <div className="min-w-0">
        <h1 className="truncate text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-50">{titre}</h1>
        {sousTitre && <p className="truncate text-xs text-slate-500 dark:text-slate-400">{sousTitre}</p>}
      </div>
    </header>
  );
}

/** Bloc de formulaire : un titre, du contenu, rien d'autre. */
export function Carte({
  titre,
  description,
  children,
}: {
  titre?: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      {titre && (
        <div className="mb-4">
          <h2 className="text-[15px] font-semibold text-slate-900 dark:text-slate-100">{titre}</h2>
          {description && <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{description}</p>}
        </div>
      )}
      <div className="space-y-5">{children}</div>
    </section>
  );
}

/** Champ : libellé discret au-dessus du contrôle. */
export function Champ({
  label,
  aide,
  children,
}: {
  label: string;
  aide?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
      {children}
      {aide && <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">{aide}</p>}
    </div>
  );
}

export function Saisie(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      // Évite qu'un défilement à la molette modifie silencieusement un champ
      // numérique resté actif.
      onWheel={(e) => {
        (e.target as HTMLInputElement).blur();
        props.onWheel?.(e);
      }}
      className={classeChamp}
    />
  );
}

export function ZoneTexte(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={classeChamp} />;
}

export function Liste({
  value,
  onChange,
  children,
  required,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className={`${classeChamp} appearance-none pr-10`}
      >
        {children}
      </select>
      <ChevronDown
        size={18}
        className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400"
      />
    </div>
  );
}

/** Boutons de choix (une seule réponse). `colonnes` fixe une grille ;
 * sinon les boutons passent à la ligne selon la place disponible. */
export function Choix<T extends string>({
  options,
  value,
  onChange,
  colonnes,
}: {
  options: { value: T; label: string }[];
  value: T | "";
  onChange: (v: T) => void;
  colonnes?: 2 | 3 | 4;
}) {
  const disposition = colonnes
    ? { 2: "grid grid-cols-2", 3: "grid grid-cols-3", 4: "grid grid-cols-2 sm:grid-cols-4" }[colonnes]
    : "flex flex-wrap";
  return (
    <div className={`${disposition} gap-2`} role="radiogroup">
      {options.map((o) => {
        const actif = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={actif}
            onClick={() => onChange(o.value)}
            className={`rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
              actif
                ? "border-[#1e3a8a] bg-[#1e3a8a] text-white"
                : "border-slate-300 bg-white text-slate-700 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Oui / Non en deux grands boutons. `null` = pas encore répondu. */
export function OuiNon({
  value,
  onChange,
}: {
  value: boolean | null;
  onChange: (v: boolean) => void;
}) {
  return (
    <Choix<"oui" | "non">
      colonnes={2}
      value={value === null ? "" : value ? "oui" : "non"}
      onChange={(v) => onChange(v === "oui")}
      options={[
        { value: "oui", label: "Oui" },
        { value: "non", label: "Non" },
      ]}
    />
  );
}

/** Quantités d'un produit : nom, trois saisies, sous-total. */
export function QuantitesProduit({
  nom,
  avecFilets,
  valeur,
  onChange,
  sousTotal,
}: {
  nom: string;
  avecFilets: boolean;
  valeur: { sachets: number; filets: number; cartons: number };
  onChange: (champ: "sachets" | "filets" | "cartons", v: number) => void;
  sousTotal: number;
}) {
  const champs: { cle: "sachets" | "filets" | "cartons"; label: string }[] = [
    { cle: "sachets", label: "Sachets" },
    ...(avecFilets ? [{ cle: "filets" as const, label: "Filets" }] : []),
    { cle: "cartons", label: "Cartons" },
  ];
  return (
    <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
      <p className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">{nom}</p>
      <div className={`grid gap-3 ${champs.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
        {champs.map((c) => (
          <label key={c.cle} className="block">
            <span className="mb-1 block text-xs text-slate-500 dark:text-slate-400">{c.label}</span>
            <Saisie
              type="number"
              inputMode="numeric"
              min={0}
              placeholder="0"
              value={valeur[c.cle] || ""}
              onChange={(e) => onChange(c.cle, Number(e.target.value) || 0)}
            />
          </label>
        ))}
      </div>
      {sousTotal > 0 && (
        <p className="mt-3 text-right text-sm font-semibold" style={{ color: VERT }}>
          {sousTotal.toLocaleString("fr-FR")} FCFA
        </p>
      )}
    </div>
  );
}

/** Zone d'information discrète (montant à percevoir, reste à payer…). */
export function Encart({
  children,
  ton = "neutre",
}: {
  children: React.ReactNode;
  ton?: "neutre" | "attention";
}) {
  return (
    <div
      className={`rounded-xl px-4 py-3 text-sm ${
        ton === "attention"
          ? "bg-amber-50 font-medium text-amber-800 dark:bg-amber-950/30 dark:text-amber-300"
          : "bg-slate-50 text-slate-700 dark:bg-slate-950 dark:text-slate-300"
      }`}
    >
      {children}
    </div>
  );
}

/** Barre d'action fixée en bas de l'écran. */
export function BarreAction({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200/80 bg-white/95 p-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
      <div className="mx-auto max-w-xl">{children}</div>
    </div>
  );
}

export function BoutonPrincipal({
  children,
  disabled,
  type = "submit",
  form,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  type?: "submit" | "button";
  form?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type={type}
      form={form}
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-xl py-3.5 text-base font-semibold text-white transition-opacity disabled:opacity-50"
      style={{ backgroundColor: BLEU }}
    >
      {children}
    </button>
  );
}
