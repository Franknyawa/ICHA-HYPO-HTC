"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Store,
  Users2,
  FileBarChart,
  UserCog,
  Droplet,
  Truck,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/admin/dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/admin/points-vente", label: "Points de vente", icon: Store },
  { href: "/admin/commandes", label: "Commandes", icon: Truck },
  { href: "/admin/clients", label: "Clients", icon: Users2 },
  { href: "/admin/rapports", label: "Rapports", icon: FileBarChart },
  { href: "/admin/utilisateurs", label: "Utilisateurs", icon: UserCog },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

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
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Contenu */}
      <div className="min-h-screen flex-1 pb-20 md:pb-0">{children}</div>

      {/* Barre de navigation — mobile uniquement */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-slate-200 bg-white/95 backdrop-blur md:hidden">
        {NAV_ITEMS.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium ${
                active ? "text-brand" : "text-slate-400"
              }`}
            >
              <Icon size={19} strokeWidth={active ? 2.4 : 2} />
              {item.label.split(" ")[0]}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
