"use client";

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
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 print:break-inside-avoid">
      <p className="mb-4 text-sm font-semibold text-slate-800 dark:text-slate-200">{title}</p>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={items} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
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
          <Bar dataKey="montant" radius={[4, 4, 0, 0]} maxBarSize={44} fill={color} />
        </BarChart>
      </ResponsiveContainer>
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
    <button
      onClick={() => window.print()}
      className="hidden items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 md:flex hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 print:hidden"
    >
      <Printer size={15} />
      Imprimer
    </button>
  );
}
