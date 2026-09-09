"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export type PointTracking = {
  id: string;
  dateVisite: string;
  latitude: number;
  longitude: number;
  precisionGps: number | null;
  pointVenteNom: string;
  commercialId: string;
  commercialNom: string;
  binomeNom: string | null;
};

// Palette de couleurs stable par commercial — même commercial = même
// couleur sur toute la carte, pour repérer ses trajets d'un coup d'œil.
const PALETTE = ["#1e40af", "#0f766e", "#b45309", "#7e22ce", "#be123c", "#15803d", "#0369a1"];

function couleurPour(commercialId: string) {
  let hash = 0;
  for (const ch of commercialId) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

// Douala par défaut si aucun point à afficher, plutôt qu'une carte vide
// centrée sur l'océan (0,0).
const CENTRE_DEFAUT: [number, number] = [4.0483, 9.7043];

function AjusterVue({ points }: { points: PointTracking[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    const bounds = L.latLngBounds(points.map((p) => [p.latitude, p.longitude]));
    map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
  }, [points, map]);
  return null;
}

export function TrackingMap({ points }: { points: PointTracking[] }) {
  const legende = useMemo(() => {
    const parCommercial = new Map<string, { nom: string; couleur: string; count: number }>();
    for (const p of points) {
      const existing = parCommercial.get(p.commercialId);
      if (existing) {
        existing.count += 1;
      } else {
        parCommercial.set(p.commercialId, {
          nom: p.commercialNom,
          couleur: couleurPour(p.commercialId),
          count: 1,
        });
      }
    }
    return [...parCommercial.values()];
  }, [points]);

  return (
    <div>
      <div className="mb-3 overflow-hidden rounded-2xl ring-1 ring-slate-100">
        <MapContainer
          center={CENTRE_DEFAUT}
          zoom={12}
          style={{ height: "420px", width: "100%" }}
        >
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
              pathOptions={{
                color: couleurPour(p.commercialId),
                fillColor: couleurPour(p.commercialId),
                fillOpacity: 0.8,
                weight: 2,
              }}
            >
              <Popup>
                <div className="text-sm">
                  <p className="font-semibold">{p.pointVenteNom}</p>
                  <p className="text-slate-500">{p.commercialNom}</p>
                  <p className="text-slate-400">
                    {new Date(p.dateVisite).toLocaleTimeString("fr-FR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>

      {legende.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {legende.map((l) => (
            <span
              key={l.nom}
              className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm ring-1 ring-slate-100"
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: l.couleur }}
              />
              {l.nom} ({l.count})
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
