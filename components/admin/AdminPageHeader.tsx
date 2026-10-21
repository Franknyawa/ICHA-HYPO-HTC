"use client";

import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Store,
  Users2,
  FileBarChart,
  UserCog,
  Truck,
  Settings,
  Receipt,
  Navigation,
  BellRing,
  Package,
  Target,
  Wallet,
  Archive,
  CalendarClock,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// Chaque rubrique a son icône et sa couleur : l'en-tête les reprend
// automatiquement à partir de l'adresse de la page.
const RUBRIQUES: { prefixe: string; icone: LucideIcon; degrade: string }[] = [
  { prefixe: "/admin/dashboard", icone: LayoutDashboard, degrade: "from-slate-600 to-slate-500" },
  { prefixe: "/admin/alertes", icone: BellRing, degrade: "from-slate-600 to-slate-500" },
  { prefixe: "/admin/points-vente", icone: Store, degrade: "from-slate-600 to-slate-500" },
  { prefixe: "/admin/relances", icone: CalendarClock, degrade: "from-slate-600 to-slate-500" },
  { prefixe: "/admin/commandes", icone: Truck, degrade: "from-slate-600 to-slate-500" },
  { prefixe: "/admin/stock", icone: Package, degrade: "from-slate-600 to-slate-500" },
  { prefixe: "/admin/caisse", icone: Wallet, degrade: "from-[#1e3a8a] to-[#359980]" },
  { prefixe: "/admin/objectifs", icone: Target, degrade: "from-pink-500 to-rose-400" },
  { prefixe: "/admin/factures", icone: Receipt, degrade: "from-sky-500 to-blue-600" },
  { prefixe: "/admin/tracking", icone: Navigation, degrade: "from-slate-600 to-slate-500" },
  { prefixe: "/admin/clients", icone: Users2, degrade: "from-indigo-500 to-violet-500" },
  { prefixe: "/admin/rapports", icone: FileBarChart, degrade: "from-teal-500 to-emerald-500" },
  { prefixe: "/admin/archives", icone: Archive, degrade: "from-orange-500 to-amber-400" },
  { prefixe: "/admin/parametres", icone: Settings, degrade: "from-slate-600 to-slate-500" },
  { prefixe: "/admin/utilisateurs", icone: UserCog, degrade: "from-blue-500 to-cyan-500" },
];

export function AdminPageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  const pathname = usePathname();
  const rubrique = RUBRIQUES.find((r) => pathname.startsWith(r.prefixe));
  const Icone = rubrique?.icone;

  return (
    <div className="relative border-b border-slate-200/70 bg-white px-4 py-5 dark:border-slate-800 dark:bg-slate-900 md:px-8">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3.5">
          {Icone && (
            <span
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#1e3a8a] text-white`}
            >
              <Icone size={21} />
            </span>
          )}
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold tracking-tight text-[#1e3a8a] dark:text-slate-100">{title}</h1>
            {subtitle && <p className="mt-0.5 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
          </div>
        </div>
        {action}
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] bg-[#1e3a8a]" />
    </div>
  );
}
