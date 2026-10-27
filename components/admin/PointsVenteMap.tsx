"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { PointVenteCarte } from "@/lib/queries/tracking";

const COULEURS: Record<PointVenteCarte["statut"], { couleur: string; label: string }> = {
  client: { couleur: "#059669", label: "Client (commande validée)" },
  indecis: { couleur: "#d97706", label: "Prospect indécis" },
  prospect: { couleur: "#2563eb", label: "Renseigné, sans commande" },
};

const CENTRE_DEFAUT: [number, number] = [4.0483, 9.7043];

function AjusterVue({ points }: { points: PointVenteCarte[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    map.fitBounds(L.latLngBounds(points.map((p) => [p.latitude, p.longitude])), { padding: [30, 30], maxZoom: 16 });
  }, [points, map]);
  return null;
}

/** Carte de tous les points de vente renseignés, colorés selon leur situation commerciale. */
export function PointsVenteMap({ points }: { points: PointVenteCarte[] }) {
  const compte = useMemo(() => {
    const c = { client: 0, indecis: 0, prospect: 0 };
    for (const p of points) c[p.statut] += 1;
    return c;
  }, [points]);

  return (
    <div>
      <div className="mb-3 overflow-hidden rounded-2xl ring-1 ring-slate-100 dark:ring-slate-800">
        <MapContainer center={CENTRE_DEFAUT} zoom={12} style={{ height: "560px", width: "100%" }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <AjusterVue points={points} />
          {points.map((p) => (
            <CircleMarker
              key={p.id}
              center={[p.latitude, p.longitude]}
              radius={8}
              pathOptions={{ color: "#ffffff", weight: 2, fillColor: COULEURS[p.statut].couleur, fillOpacity: 0.95 }}
            >
              <Popup>
                <div className="space-y-0.5 text-sm">
                  <p className="font-semibold">{p.nom}</p>
                  <p className="text-xs" style={{ color: COULEURS[p.statut].couleur }}>
                    {COULEURS[p.statut].label}
                    {p.nbCommandes > 0 ? ` · ${p.nbCommandes} commande${p.nbCommandes > 1 ? "s" : ""}` : ""}
                  </p>
                  <p className="text-xs text-slate-500">{[p.quartier, p.ville].filter(Boolean).join(" · ")}</p>
                  {p.type && <p className="text-xs text-slate-500">{p.type}</p>}
                  {p.vendeur && <p className="text-xs">{p.vendeur}{p.telephone ? ` · ${p.telephone}` : ""}</p>}
                  <p className="text-[11px] text-slate-400">Ajouté par {p.commercial}</p>
                  <a href={`/admin/points-vente/${p.id}`} className="mt-1 block text-xs font-semibold text-blue-700 underline">
                    Ouvrir la fiche
                  </a>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>

      <div className="flex flex-wrap gap-2">
        {(Object.keys(COULEURS) as PointVenteCarte["statut"][]).map((k) => (
          <span
            key={k}
            className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm ring-1 ring-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-800"
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COULEURS[k].couleur }} />
            {COULEURS[k].label} ({compte[k]})
          </span>
        ))}
      </div>
    </div>
  );
}
