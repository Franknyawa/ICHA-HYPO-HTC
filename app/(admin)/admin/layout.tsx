"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/LogoutButton";
import {
  LayoutDashboard,
  Store,
  Users2,
  FileBarChart,
  UserCog,
  Droplet,
  Truck,
  Settings,
  Receipt,
  Navigation,
  MoreHorizontal,
  BellRing,
  Package,
  Target,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/admin/dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/admin/alertes", label: "Alertes", icon: BellRing },
  { href: "/admin/points-vente", label: "Points de vente", icon: Store },
  { href: "/admin/commandes", label: "Commandes", icon: Truck },
  { href: "/admin/stock", label: "Stock", icon: Package },
  { href: "/admin/objectifs", label: "Objectifs", icon: Target },
  { href: "/admin/factures", label: "Factures", icon: Receipt },
  { href: "/admin/tracking", label: "Tracking", icon: Navigation },
  { href: "/admin/clients", label: "Clients", icon: Users2 },
  { href: "/admin/rapports", label: "Rapports", icon: FileBarChart },
  { href: "/admin/parametres", label: "Paramètres", icon: Settings },
  { href: "/admin/utilisateurs", label: "Utilisateurs", icon: UserCog },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [showPlus, setShowPlus] = useState(false);
  const [alertesCount, setAlertesCount] = useState(0);

  useEffect(() => {
    fetch("/api/alertes/count")
      .then((r) => r.json())
      .then((d) => setAlertesCount(d.count ?? 0))
      .catch(() => {});
  }, [pathname]); // re-vérifie à chaque navigation, ex: après avoir résolu une alerte

  return (
    <div className="min-h-screen bg-slate-50 md:flex">
      {/* Sidebar — desktop uniquement */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        <div
          className="flex items-center gap-2 px-5 py-5"
          style={{ background: "linear-gradient(135deg, #1e3a8a, #2563eb)" }}
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 text-white">
            <Droplet size={16} />
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-blue-100">
              ICHA IMPORT
            </p>
            <p className="text-sm font-semibold text-white">Admin</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {NAV_ITEMS.map((item) => {
            const active = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-blue-50 text-brand"
                    : "text-slate-500 hover:bg-slate-50"
                }`}
              >
                <Icon size={18} strokeWidth={active ? 2.4 : 2} />
                {item.label}
                {item.href === "/admin/alertes" && alertesCount > 0 && (
                  <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-alert px-1 text-[10px] font-bold text-white">
                    {alertesCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-slate-100 p-3">
          <LogoutButton />
        </div>
      </aside>

      {/* Contenu */}
      <div className="min-h-screen flex-1 pb-20 md:pb-0">
        {/* Bouton déconnexion flottant — mobile uniquement (la sidebar,
            hors écran sur mobile, porte déjà le bouton sur desktop) */}
        <div className="fixed right-3 top-3 z-40 md:hidden">
          <LogoutButton className="flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-2 text-xs font-medium text-slate-500 shadow-sm ring-1 ring-slate-200 backdrop-blur" />
        </div>
        {children}
      </div>

      {/* Barre de navigation — mobile uniquement. 4 onglets principaux +
          un menu "Plus" pour le reste, sinon 9 onglets ne tiennent pas sur
          un petit écran. */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-slate-200 bg-white/95 backdrop-blur md:hidden">
        {NAV_ITEMS.slice(0, 4).map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium ${
                active ? "text-brand" : "text-slate-400"
              }`}
            >
              <Icon size={19} strokeWidth={active ? 2.4 : 2} />
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
              : "text-slate-400"
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
            className="w-full rounded-t-2xl bg-white p-3 pb-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200" />
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
                      active ? "bg-blue-50 text-brand" : "text-slate-500"
                    }`}
                  >
                    <Icon size={20} />
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
