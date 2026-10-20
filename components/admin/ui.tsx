// Éléments visuels communs aux pages admin : chiffres clés colorés, panneaux à
// en-tête teinté. Composants serveur (aucun état).

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export type Ton = "bleu" | "vert" | "rose" | "ambre" | "violet" | "ardoise";

// Palette sobre : pastilles unies en tons éteints, fonds quasi neutres.
const TONS: Record<Ton, { puce: string; fond: string; texte: string; barre: string }> = {
  bleu: {
    puce: "from-[#2b4a8f] to-[#2b4a8f]",
    fond: "from-slate-50 to-white dark:from-slate-800/40 dark:to-slate-900",
    texte: "text-slate-500 dark:text-slate-400",
    barre: "bg-[#2b4a8f]",
  },
  vert: {
    puce: "from-[#3f8f7a] to-[#3f8f7a]",
    fond: "from-slate-50 to-white dark:from-slate-800/40 dark:to-slate-900",
    texte: "text-emerald-700 dark:text-emerald-300",
    barre: "bg-[#3f8f7a]",
  },
  rose: {
    puce: "from-[#a85c5c] to-[#a85c5c]",
    fond: "from-slate-50 to-white dark:from-slate-800/40 dark:to-slate-900",
    texte: "text-rose-700 dark:text-rose-300",
    barre: "bg-[#a85c5c]",
  },
  ambre: {
    puce: "from-[#a8864a] to-[#a8864a]",
    fond: "from-slate-50 to-white dark:from-slate-800/40 dark:to-slate-900",
    texte: "text-amber-700 dark:text-amber-300",
    barre: "bg-[#a8864a]",
  },
  violet: {
    puce: "from-[#5b6b8c] to-[#5b6b8c]",
    fond: "from-slate-50 to-white dark:from-slate-800/40 dark:to-slate-900",
    texte: "text-slate-500 dark:text-slate-400",
    barre: "bg-[#5b6b8c]",
  },
  ardoise: {
    puce: "from-slate-600 to-slate-600",
    fond: "from-slate-50 to-white dark:from-slate-800/40 dark:to-slate-900",
    texte: "text-slate-600 dark:text-slate-300",
    barre: "bg-slate-500",
  },
};

export type Icone = LucideIcon;

export function KpiCard({
  label,
  valeur,
  sous,
  icone: Icone,
  ton = "bleu",
  href,
}: {
  label: string;
  valeur: ReactNode;
  sous?: ReactNode;
  icone: Icone;
  ton?: Ton;
  href?: string;
}) {
  const t = TONS[ton];
  const contenu = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${t.puce} text-white shadow-sm`}>
          <Icone size={17} />
        </span>
      </div>
      <p className={`mt-3 text-2xl font-bold tracking-tight tabular-nums text-slate-900 dark:text-slate-50`}>{valeur}</p>
      {sous && <p className={`mt-1 text-xs font-medium ${t.texte}`}>{sous}</p>}
    </>
  );
  const classe = `block rounded-2xl border border-slate-200/70 bg-gradient-to-br ${t.fond} p-4 shadow-sm dark:border-slate-800`;
  return href ? (
    <Link href={href} className={`${classe} transition-shadow hover:shadow-md`}>
      {contenu}
    </Link>
  ) : (
    <div className={classe}>{contenu}</div>
  );
}

export function Panneau({
  titre,
  sousTitre,
  icone: Icone,
  ton = "bleu",
  action,
  children,
  className = "",
}: {
  titre: string;
  sousTitre?: string;
  icone?: Icone;
  ton?: Ton;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const t = TONS[ton];
  return (
    <section className={`overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 ${className}`}>
      <div className={`h-1 bg-gradient-to-r ${t.puce}`} />
      <div className="flex items-center justify-between gap-3 px-5 pb-1 pt-4">
        <div className="flex min-w-0 items-center gap-3">
          {Icone && (
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${t.puce} text-white`}>
              <Icone size={16} />
            </span>
          )}
          <div className="min-w-0">
            <h2 className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">{titre}</h2>
            {sousTitre && <p className="truncate text-xs text-slate-500 dark:text-slate-400">{sousTitre}</p>}
          </div>
        </div>
        {action}
      </div>
      <div className="p-5 pt-3">{children}</div>
    </section>
  );
}

/** Titre de section discret mais coloré (puce dégradée + libellé). */
export function TitreSection({ children, ton = "bleu" }: { children: ReactNode; ton?: Ton }) {
  return (
    <h2 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
      <span className={`h-3.5 w-1 rounded-full bg-gradient-to-b ${TONS[ton].puce}`} />
      {children}
    </h2>
  );
}

export { TONS };
