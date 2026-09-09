"use client";

import dynamic from "next/dynamic";
import type { PointTracking } from "./TrackingMap";

// Leaflet a besoin de `window` — chargement dynamique sans rendu serveur
// obligatoire, et ce détour par un composant client dédié est nécessaire
// car `ssr: false` n'est permis que depuis un Client Component en App
// Router (pas directement dans la page Server Component).
const TrackingMap = dynamic(
  () => import("./TrackingMap").then((m) => m.TrackingMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[420px] items-center justify-center rounded-2xl bg-slate-100 text-sm text-slate-400">
        Chargement de la carte...
      </div>
    ),
  }
);

export function TrackingMapLoader({ points }: { points: PointTracking[] }) {
  return <TrackingMap points={points} />;
}
