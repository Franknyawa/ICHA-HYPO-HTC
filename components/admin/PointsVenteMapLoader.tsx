"use client";

import dynamic from "next/dynamic";
import type { PointVenteCarte } from "@/lib/queries/tracking";

// Leaflet a besoin de `window` : chargement côté navigateur uniquement.
const PointsVenteMap = dynamic(() => import("./PointsVenteMap").then((m) => m.PointsVenteMap), {
  ssr: false,
  loading: () => (
    <div className="flex h-[560px] items-center justify-center rounded-2xl bg-slate-100 text-sm text-slate-400 dark:bg-slate-800 dark:text-slate-500">
      Chargement de la carte...
    </div>
  ),
});

export function PointsVenteMapLoader({ points }: { points: PointVenteCarte[] }) {
  return <PointsVenteMap points={points} />;
}
