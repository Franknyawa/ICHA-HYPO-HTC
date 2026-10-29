"use client";

import { lancerImpression } from "@/components/admin/ImprimerButton";
import { TelechargerPdfButton } from "@/components/admin/TelechargerPdfButton";
import { Printer } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

type CaItem = { nom: string; montant: number };

function formatFcfaShort(n: number) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${Math.round(n / 1000)}k`;
  return String(n);
}

export function CaChart({ title, items, color = "#1e3a8a" }: { title: string; items: CaItem[]; color?: string }) {
  const id = `g${color.replace("#", "")}`;
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 print:break-inside-avoid">
      <div className="h-1" style={{ background: `linear-gradient(90deg, ${color}, ${color}99)` }} />
      <div className="p-5">
      <p className="mb-4 text-sm font-bold text-slate-800 dark:text-slate-200">{title}</p>
      {items.length === 0 && <p className="py-16 text-center text-sm text-slate-400">Aucune vente aujourd&apos;hui.</p>}
      {items.length > 0 && (
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={items} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.75} />
              <stop offset="100%" stopColor={color} />
            </linearGradient>
          </defs>
          <XAxis
            axisLine={false}
            tickLine={false}
            dataKey="nom"
            tick={{ fontSize: 11, fill: "#64748b" }}
            interval={0}
            angle={items.length > 4 ? -20 : 0}
            textAnchor={items.length > 4 ? "end" : "middle"}
            height={items.length > 4 ? 50 : 30}
          />
          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#94a3b8" }} tickFormatter={formatFcfaShort} />
          <Tooltip
            formatter={(value: number) => [`${value.toLocaleString("fr-FR")} FCFA`, "CA"]}
            contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12 }}
          />
          <Bar dataKey="montant" radius={[6, 6, 0, 0]} maxBarSize={44} fill={`url(#${id})`} />
        </BarChart>
      </ResponsiveContainer>
      )}
      </div>
    </div>
  );
}

export function CartonsChart({
  cartonsHypo,
  cartonsHtc,
}: {
  cartonsHypo: number;
  cartonsHtc: number;
}) {
  const data = [
    { nom: "HYPO", cartons: cartonsHypo },
    { nom: "HTC", cartons: cartonsHtc },
  ];
  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900 p-4 shadow-sm ring-1 ring-slate-100 dark:ring-slate-800 print:break-inside-avoid">
      <p className="mb-3 text-sm font-bold text-slate-700 dark:text-slate-300">Cartons vendus aujourd&apos;hui</p>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
          <XAxis dataKey="nom" tick={{ fontSize: 12, fill: "#64748b" }} />
          <YAxis tick={{ fontSize: 11, fill: "#64748b" }} allowDecimals={false} />
          <Tooltip
            formatter={(value: number) => [`${value} cartons`, ""]}
            contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12 }}
          />
          <Bar dataKey="cartons" radius={[6, 6, 0, 0]}>
            <Cell fill="#1e40af" />
            <Cell fill="#0f766e" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PrintButton() {
  return (
    <div className="hidden items-center gap-2 md:flex print:hidden">
    <button
      onClick={lancerImpression}
      className="flex items-center gap-1.5 rounded-xl border border-blue-200 bg-white px-3.5 py-2 text-sm font-semibold text-[#1e3a8a] shadow-sm hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
    >
      <Printer size={15} />
      Imprimer
    </button>
    <TelechargerPdfButton className="flex items-center gap-1.5 rounded-xl border border-blue-200 bg-white px-3.5 py-2 text-sm font-semibold text-[#1e3a8a] shadow-sm hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200" />
    </div>
  );
}
