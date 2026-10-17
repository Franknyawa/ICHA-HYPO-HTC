"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { JourVisites } from "@/lib/queries/dashboard";

/** Points de vente visités par jour (7 ou 30 jours). Aujourd'hui en vert, les autres jours en bleu. */
export function VisitesChart({ serie }: { serie: JourVisites[] }) {
  const [jours, setJours] = useState<7 | 30>(30);
  const data = serie.slice(-jours);
  const dernier = data.length - 1;

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <div className="flex rounded-full bg-slate-100 p-0.5 dark:bg-slate-800" role="group" aria-label="Période">
          {([7, 30] as const).map((j) => (
            <button
              key={j}
              onClick={() => setJours(j)}
              className={`rounded-full px-3.5 py-1 text-xs font-semibold transition-colors ${
                jours === j ? "bg-gradient-to-r from-[#1e3a8a] to-[#2563eb] text-white shadow" : "text-slate-500 dark:text-slate-400"
              }`}
            >
              {j} jours
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={230}>
        <BarChart data={data} margin={{ top: 8, right: 6, left: -22, bottom: 0 }}>
          <defs>
            <linearGradient id="gBleu" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#1e3a8a" />
            </linearGradient>
            <linearGradient id="gVert" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4fd1a5" />
              <stop offset="100%" stopColor="#359980" />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="3 4" />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fill: "#64748b" }}
            interval={jours === 7 ? 0 : 3}
          />
          <YAxis axisLine={false} tickLine={false} allowDecimals={false} tick={{ fontSize: 11, fill: "#94a3b8" }} />
          <Tooltip
            cursor={{ fill: "rgba(37,99,235,0.06)" }}
            formatter={(value: number, name: string) => [value, name === "pointsVisites" ? "Points visités" : "Visites"]}
            labelFormatter={(l) => `Le ${l}`}
            contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
          />
          <Bar dataKey="pointsVisites" radius={[6, 6, 0, 0]} maxBarSize={26}>
            {data.map((_, i) => (
              <Cell key={i} fill={i === dernier ? "url(#gVert)" : "url(#gBleu)"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
