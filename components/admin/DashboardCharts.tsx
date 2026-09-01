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

const BAR_COLORS = ["#1e40af", "#0f766e", "#4338ca", "#b45309", "#15803d", "#b91c1c"];

function formatFcfaShort(n: number) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${Math.round(n / 1000)}k`;
  return String(n);
}

export function CaChart({ title, items }: { title: string; items: CaItem[] }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100 print:break-inside-avoid">
      <p className="mb-3 text-sm font-bold text-slate-700">{title}</p>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={items} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
          <XAxis
            dataKey="nom"
            tick={{ fontSize: 11, fill: "#64748b" }}
            interval={0}
            angle={items.length > 4 ? -20 : 0}
            textAnchor={items.length > 4 ? "end" : "middle"}
            height={items.length > 4 ? 50 : 30}
          />
          <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={formatFcfaShort} />
          <Tooltip
            formatter={(value: number) => [`${value.toLocaleString("fr-FR")} FCFA`, "CA"]}
            contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12 }}
          />
          <Bar dataKey="montant" radius={[6, 6, 0, 0]}>
            {items.map((_, i) => (
              <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
            ))}
          </Bar>
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
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100 print:break-inside-avoid">
      <p className="mb-3 text-sm font-bold text-slate-700">Cartons vendus aujourd&apos;hui</p>
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
      className="flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-brand ring-1 ring-slate-200 print:hidden"
    >
      <Printer size={15} />
      Imprimer
    </button>
  );
}
