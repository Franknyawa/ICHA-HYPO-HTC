"use client";

// Kit de formulaire de l'espace terrain : un seul style, très épuré (fonds
// blancs, fins contours, aucune couleur d'accent décorative). Utilisé par le
// recensement, le réassort et la rotation.

import Link from "next/link";
import { ArrowLeft, ChevronDown, type LucideIcon } from "lucide-react";

const VERT = "#359980";

export const classeChamp =
  "w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-base text-slate-900 placeholder:text-slate-400 transition-colors focus:border-[#359980] focus:outline-none focus:ring-2 focus:ring-[#359980]/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500";

export type Accent = "bleu" | "vert" | "orange" | "rose" | "violet";

const ACCENTS: Record<Accent, { bande: string; badge: string; fond: string }> = {
  bleu: { bande: "from-blue-600 to-indigo-500", badge: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300", fond: "from-blue-50/70" },
  vert: { bande: "from-emerald-500 to-teal-400", badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300", fond: "from-emerald-50/70" },
  orange: { bande: "from-orange-500 to-amber-400", badge: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300", fond: "from-orange-50/70" },
  rose: { bande: "from-rose-500 to-pink-400", badge: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300", fond: "from-rose-50/70" },
  violet: { bande: "from-violet-600 to-fuchsia-500", badge: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300", fond: "from-violet-50/70" },
};

/** Fond de page : léger dégradé bleu → vert pour donner de la vie. */
export const FOND_PAGE =
  "min-h-screen bg-gradient-to-b from-blue-50 via-slate-50 to-emerald-50/60 dark:from-slate-950 dark:via-slate-950 dark:to-slate-950";

/** En-tête de page : dégradé bleu → vert aux couleurs ICHA, titre blanc. */
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
    <header className="sticky top-0 z-20 flex items-center gap-3 bg-gradient-to-r from-[#1e3a8a] via-[#2563eb] to-[#359980] px-4 py-4 text-white shadow-md">
      <Link
        href={retour}
        aria-label="Retour"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"
      >
        <ArrowLeft size={20} />
      </Link>
      <div className="min-w-0">
        <h1 className="truncate text-lg font-bold tracking-tight">{titre}</h1>
        {sousTitre && <p className="truncate text-xs text-white/80">{sousTitre}</p>}
      </div>
    </header>
  );
}

/** Bloc de formulaire : bande de couleur, pastille d'icône, titre. */
export function Carte({
  titre,
  description,
  children,
  icone: Icone,
  accent = "bleu",
}: {
  titre?: string;
  description?: string;
  children: React.ReactNode;
  icone?: LucideIcon;
  accent?: Accent;
}) {
  const a = ACCENTS[accent];
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className={`h-1.5 bg-gradient-to-r ${a.bande}`} />
      {titre && (
        <div className={`flex items-center gap-3 bg-gradient-to-b ${a.fond} to-transparent px-5 pb-1 pt-4 dark:from-transparent`}>
          {Icone && (
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${a.badge}`}>
              <Icone size={18} />
            </span>
          )}
          <div className="min-w-0">
            <h2 className="text-[15px] font-bold text-slate-900 dark:text-slate-100">{titre}</h2>
            {description && <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>}
          </div>
        </div>
      )}
      <div className="space-y-5 p-5">{children}</div>
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
            className={`rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all ${
              actif
                ? "border-transparent bg-gradient-to-r from-[#1e3a8a] to-[#2563eb] text-white shadow-md shadow-blue-900/20"
                : "border-slate-200 bg-slate-50 text-slate-700 hover:border-[#359980] hover:bg-emerald-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Choix multiples (plusieurs réponses possibles), en grille de cases à cocher stylées. */
export function ChoixMultiple({
  options,
  values,
  onToggle,
  colonnes = 2,
}: {
  options: { value: string; label: string }[];
  values: string[];
  onToggle: (v: string) => void;
  colonnes?: 2 | 3;
}) {
  return (
    <div className={`grid gap-2 ${colonnes === 3 ? "grid-cols-3" : "grid-cols-2"}`} role="group">
      {options.map((o) => {
        const actif = values.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            role="checkbox"
            aria-checked={actif}
            onClick={() => onToggle(o.value)}
            className={`flex items-center gap-2 rounded-xl border px-3 py-3 text-left text-sm font-semibold transition-all ${
              actif
                ? "border-transparent bg-gradient-to-r from-[#359980] to-emerald-500 text-white shadow-md shadow-emerald-900/20"
                : "border-slate-200 bg-slate-50 text-slate-700 hover:border-[#359980] hover:bg-emerald-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            }`}
          >
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-[11px] ${
                actif ? "border-white/70 bg-white/25 text-white" : "border-slate-300 bg-white text-transparent dark:bg-slate-800"
              }`}
            >
              ✓
            </span>
            <span className="leading-tight">{o.label}</span>
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
    <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4 dark:border-slate-800 dark:bg-transparent">
      <p className="mb-3 text-sm font-bold text-slate-900 dark:text-slate-100">{nom}</p>
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
          : "bg-blue-50 text-blue-900 dark:bg-slate-950 dark:text-slate-300"
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
      className="w-full rounded-xl bg-gradient-to-r from-[#1e3a8a] via-[#2563eb] to-[#359980] py-3.5 text-base font-bold text-white shadow-lg shadow-blue-900/25 transition-opacity disabled:opacity-50"
    >
      {children}
    </button>
  );
}

/** Mode de paiement annoncé par le client — l'argent est encaissé plus tard par le superviseur. */
export type ModePaiementTerrain = "ESPECES" | "MOBILE_MONEY" | "CREDIT_PARTIEL" | "CREDIT_TOTAL";

export const OPTIONS_PAIEMENT: { value: ModePaiementTerrain; label: string }[] = [
  { value: "ESPECES", label: "Espèces" },
  { value: "MOBILE_MONEY", label: "OM/MOMO" },
  { value: "CREDIT_PARTIEL", label: "Crédit partiel" },
  { value: "CREDIT_TOTAL", label: "Crédit total" },
];

/**
 * Bloc « mode de paiement » commun à tous les formulaires de commande.
 * Le commercial n'encaisse rien : il indique seulement le mode choisi et le
 * montant à encaisser ; le superviseur encaisse plus tard et l'admin valide.
 */
export function BlocPaiement({
  mode,
  onMode,
  montant,
  acompte,
  onAcompte,
  libelle = "Mode de paiement",
}: {
  mode: ModePaiementTerrain;
  onMode: (m: ModePaiementTerrain) => void;
  montant: number;
  acompte: number;
  onAcompte: (v: number) => void;
  libelle?: string;
}) {
  const fmt = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} FCFA`;
  const reste = mode === "CREDIT_PARTIEL" ? Math.max(0, montant - acompte) : mode === "CREDIT_TOTAL" ? montant : 0;
  return (
    <>
      <Champ label={libelle}>
        <Choix<ModePaiementTerrain> colonnes={2} value={mode} onChange={onMode} options={OPTIONS_PAIEMENT} />
      </Champ>

      {mode === "ESPECES" && (
        <Encart>
          Montant à encaisser en espèces :{" "}
          <span className="font-semibold text-slate-900 dark:text-slate-100">{fmt(montant)}</span>
        </Encart>
      )}

      {mode === "MOBILE_MONEY" && (
        <Encart>
          Montant à encaisser par OM/MOMO :{" "}
          <span className="font-semibold text-slate-900 dark:text-slate-100">{fmt(montant)}</span>
        </Encart>
      )}

      {mode === "CREDIT_PARTIEL" && (
        <div className="space-y-3">
          <Encart>
            Total de la commande : <span className="font-semibold text-slate-900 dark:text-slate-100">{fmt(montant)}</span>
          </Encart>
          <Champ label="Acompte annoncé par le client (FCFA)">
            <Saisie
              type="number"
              inputMode="numeric"
              min={0}
              placeholder="0"
              value={acompte || ""}
              onChange={(e) => onAcompte(Number(e.target.value) || 0)}
            />
          </Champ>
          {reste > 0 && <Encart ton="attention">Reste à payer : {fmt(reste)}</Encart>}
        </div>
      )}

      {mode === "CREDIT_TOTAL" && (
        <Encart ton="attention">Montant entièrement à crédit : {fmt(montant)}</Encart>
      )}
    </>
  );
}
