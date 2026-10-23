"use client";

import { IchaLogo } from "@/components/brand/IchaLogo";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/LogoutButton";
import { ThemeToggle } from "@/components/ThemeToggle";
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
  MoreHorizontal,
  BellRing,
  Package,
  Target,
  Wallet,
  Archive,
  CalendarClock,
  type LucideIcon,
} from "lucide-react";
import { peutAcceder, type Module } from "@/lib/auth/permissions";

// Navigation sobre : icônes grises, seule la rubrique active est colorée.
const COULEURS_ICONES: Record<string, string> = {};

const TOUS_LES_ITEMS: { href: string; label: string; icon: LucideIcon; module: Module }[] = [
  { href: "/admin/dashboard", label: "Tableau de bord", icon: LayoutDashboard, module: "dashboard" },
  { href: "/admin/alertes", label: "Alertes", icon: BellRing, module: "alertes" },
  { href: "/admin/points-vente", label: "Points de vente", icon: Store, module: "points-vente" },
  { href: "/admin/relances", label: "Prospects indécis", icon: CalendarClock, module: "relances" },
  { href: "/admin/commandes", label: "Commandes", icon: Truck, module: "commandes" },
  { href: "/admin/stock", label: "Stock", icon: Package, module: "stock" },
  { href: "/admin/caisse", label: "Caisse", icon: Wallet, module: "caisse" },
  { href: "/admin/objectifs", label: "Objectifs", icon: Target, module: "objectifs" },
  { href: "/admin/factures", label: "Facturation", icon: Receipt, module: "factures" },
  { href: "/admin/tracking", label: "Tracking", icon: Navigation, module: "tracking" },
  { href: "/admin/clients", label: "Clients", icon: Users2, module: "clients" },
  { href: "/admin/rapports", label: "Rapports", icon: FileBarChart, module: "rapports" },
  { href: "/admin/archives", label: "Archives", icon: Archive, module: "archives" },
  { href: "/admin/parametres", label: "Paramètres", icon: Settings, module: "parametres" },
  { href: "/admin/utilisateurs", label: "Utilisateurs", icon: UserCog, module: "utilisateurs" },
];

export function AdminShell({
  children,
  role,
}: {
  children: React.ReactNode;
  role: string;
}) {
  const pathname = usePathname();
  const NAV_ITEMS = TOUS_LES_ITEMS.filter((i) => peutAcceder(role, i.module));
  const [showPlus, setShowPlus] = useState(false);
  const [alertesCount, setAlertesCount] = useState(0);

  // Le compteur d'alertes n'a pas besoin d'être rafraîchi à chaque clic :
  // au plus une fois par minute, et toujours juste après un passage sur la
  // page Alertes (où l'on vient de résoudre des alertes).
  const dernierFetchAlertes = useRef(0);
  useEffect(() => {
    const maintenant = Date.now();
    const surAlertes = pathname.startsWith("/admin/alertes");
    if (!surAlertes && maintenant - dernierFetchAlertes.current < 60_000) return;
    dernierFetchAlertes.current = maintenant;
    fetch("/api/alertes/count")
      .then((r) => r.json())
      .then((d) => setAlertesCount(d.count ?? 0))
      .catch(() => {});
  }, [pathname]);

  // Bulles « nouvelles commandes » / « nouveaux prospects indécis » : comptées depuis la dernière
  // visite de la rubrique (date gardée dans ce navigateur), rafraîchies chaque minute.
  const [notifs, setNotifs] = useState({ commandes: 0, prospects: 0 });
  useEffect(() => {
    const lire = (k: string) => {
      try {
        let v = localStorage.getItem(k);
        if (!v) { v = new Date().toISOString(); localStorage.setItem(k, v); }
        return v;
      } catch { return new Date().toISOString(); }
    };
    const marquerVu = (k: string) => { try { localStorage.setItem(k, new Date().toISOString()); } catch {} };
    if (pathname.startsWith("/admin/commandes")) marquerVu("icha_vu_commandes");
    if (pathname.startsWith("/admin/relances")) marquerVu("icha_vu_prospects");
    const charger = () => {
      const q = new URLSearchParams({ commandes: lire("icha_vu_commandes"), prospects: lire("icha_vu_prospects") });
      fetch(`/api/notifications/count?${q}`)
        .then((r) => r.json())
        .then((d) => setNotifs({
          commandes: pathname.startsWith("/admin/commandes") ? 0 : d.commandes ?? 0,
          prospects: pathname.startsWith("/admin/relances") ? 0 : d.prospects ?? 0,
        }))
        .catch(() => {});
    };
    charger();
    const t = setInterval(charger, 60_000);
    return () => clearInterval(t);
  }, [pathname]);
  const bulle = (href: string) =>
    href === "/admin/commandes" ? notifs.commandes : href === "/admin/relances" ? notifs.prospects : 0;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 md:flex">
      {/* Sidebar — desktop uniquement */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900 md:flex print:hidden">
        <div className="px-5 pb-4 pt-6">
          <IchaLogo height={54} />
          <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Administration
          </p>
        </div>

        <nav className="flex-1 space-y-0.5 px-3 py-2">
          {NAV_ITEMS.map((item) => {
            const active = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  active
                    ? "bg-[#1e3a8a] font-semibold text-white shadow-sm"
                    : "font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-200"
                }`}
              >
                <Icon size={18} strokeWidth={active ? 2.2 : 1.9} className={active ? "text-white" : "text-slate-400"} />
                {item.label}
                {bulle(item.href) > 0 && (
                  <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-alert px-1 text-[10px] font-bold text-white">
                    {bulle(item.href)}
                  </span>
                )}
                {item.href === "/admin/alertes" && alertesCount > 0 && (
                  <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-alert px-1 text-[10px] font-bold text-white">
                    {alertesCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 border-t border-slate-100 dark:border-slate-800 p-3 dark:border-slate-800">
          <LogoutButton className="flex flex-1 items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-500 dark:text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/60 dark:bg-slate-950 dark:text-slate-400 dark:text-slate-500 dark:hover:bg-slate-800/60" />
          <ThemeToggle className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 dark:bg-slate-800 dark:text-slate-300" />
        </div>
      </aside>

      {/* Contenu */}
      <div className="admin-vie min-h-screen flex-1 bg-slate-50 pb-20 dark:bg-slate-950 md:pb-0">
        {/* Bouton déconnexion + thème flottants — mobile uniquement (la
            sidebar, hors écran sur mobile, porte déjà ces boutons sur
            desktop) */}
        <div className="fixed right-3 top-3 z-40 flex items-center gap-2 md:hidden print:hidden">
          <ThemeToggle className="flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-slate-500 dark:text-slate-400 dark:text-slate-500 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 backdrop-blur dark:bg-slate-900/95 dark:text-slate-300 dark:ring-slate-700" />
          <LogoutButton className="flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-2 text-xs font-medium text-slate-500 dark:text-slate-400 dark:text-slate-500 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 backdrop-blur dark:bg-slate-900/95 dark:text-slate-300 dark:ring-slate-700" />
        </div>
        {children}
      </div>

      {/* Barre de navigation — mobile uniquement. 4 onglets principaux +
          un menu "Plus" pour le reste, sinon 9 onglets ne tiennent pas sur
          un petit écran. */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-slate-200 dark:border-slate-700 bg-white/95 backdrop-blur md:hidden print:hidden">
        {NAV_ITEMS.slice(0, 4).map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium ${
                active ? "text-brand" : "text-slate-400 dark:text-slate-500"
              }`}
            >
              <Icon size={19} strokeWidth={active ? 2.4 : 2} />
              {bulle(item.href) > 0 && (
                <span className="absolute right-[22%] top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-alert px-1 text-[9px] font-bold text-white">
                  {bulle(item.href)}
                </span>
              )}
              {item.href === "/admin/alertes" && alertesCount > 0 && (
                <span className="absolute right-[22%] top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-alert px-1 text-[9px] font-bold text-white">
                  {alertesCount}
                </span>
              )}
              {item.label.split(" ")[0]}
            </Link>
          );
        })}
        <button
          onClick={() => setShowPlus((v) => !v)}
          className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium ${
            showPlus || NAV_ITEMS.slice(4).some((i) => pathname.startsWith(i.href))
              ? "text-brand"
              : "text-slate-400 dark:text-slate-500"
          }`}
        >
          <MoreHorizontal size={19} />
          Plus
        </button>
      </nav>

      {/* Menu "Plus" — panneau qui remonte du bas */}
      {showPlus && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/30 md:hidden" onClick={() => setShowPlus(false)}>
          <div
            className="w-full rounded-t-2xl bg-white dark:bg-slate-900 p-3 pb-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200 dark:bg-slate-700" />
            <div className="grid grid-cols-3 gap-2">
              {NAV_ITEMS.slice(4).map((item) => {
                const active = pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setShowPlus(false)}
                    className={`flex flex-col items-center gap-1.5 rounded-xl p-3 text-xs font-medium ${
                      active ? "bg-blue-50 text-brand" : "text-slate-500 dark:text-slate-400 dark:text-slate-500"
                    }`}
                  >
                    <span className="relative">
                      <Icon size={20} />
                      {bulle(item.href) > 0 && (
                        <span className="absolute -right-2.5 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-alert px-1 text-[9px] font-bold text-white">
                          {bulle(item.href)}
                        </span>
                      )}
                    </span>
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
