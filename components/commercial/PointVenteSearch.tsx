"use client";

import { useState } from "react";
import { Search, MapPin, ImageOff, Phone } from "lucide-react";

export type ResultatRecherche = {
  id: string;
  nom: string;
  vendeur: string | null;
  telephoneVendeur: string | null;
  villeNom: string | null;
  quartierNom: string | null;
  typeId?: string | null;
  photoUrl: string | null;
  distanceKm?: number;
};

export function PointVenteSearch({
  onSelect,
}: {
  onSelect: (p: ResultatRecherche) => void;
}) {
  const [search, setSearch] = useState("");
  const [resultats, setResultats] = useState<ResultatRecherche[]>([]);
  const [loading, setLoading] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  async function lancerRecherche(params: { search?: string; lat?: number; lng?: number }) {
    setLoading(true);
    const sp = new URLSearchParams();
    if (params.search) sp.set("search", params.search);
    if (params.lat != null) sp.set("lat", String(params.lat));
    if (params.lng != null) sp.set("lng", String(params.lng));
    const res = await fetch(`/api/points-vente/recherche?${sp.toString()}`);
    const d = await res.json().catch(() => ({ data: [] }));
    setResultats(d.data ?? []);
    setLoading(false);
  }

  function handleSearchChange(v: string) {
    setSearch(v);
    if (v.trim().length >= 2) {
      lancerRecherche({ search: v });
    } else {
      setResultats([]);
    }
  }

  function rechercherPresDeMoi() {
    setGpsError(null);
    if (!navigator.geolocation) {
      setGpsError("Géolocalisation non supportée.");
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        lancerRecherche({ lat: pos.coords.latitude, lng: pos.coords.longitude }).finally(() =>
          setGpsLoading(false)
        );
      },
      () => {
        setGpsError("Position indisponible (autorisation refusée ?).");
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  return (
    <div>
      <div className="relative mb-2">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          type="text"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Nom de la boutique ou du vendeur..."
          className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-3 text-base text-slate-800 placeholder:text-slate-400"
        />
      </div>

      <button
        type="button"
        onClick={rechercherPresDeMoi}
        disabled={gpsLoading}
        className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-50/70 py-3 text-sm font-semibold text-brand disabled:opacity-60"
      >
        <MapPin size={17} />
        {gpsLoading ? "Localisation..." : "Rechercher près de moi"}
      </button>
      {gpsError && <p className="mb-3 text-xs text-alert">{gpsError}</p>}

      {loading && <p className="text-sm text-slate-400">Recherche...</p>}

      <div className="space-y-2">
        {resultats.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => onSelect(r)}
            className="flex w-full items-center gap-3 rounded-xl bg-white p-3 text-left shadow-sm ring-1 ring-slate-100"
          >
            {r.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={r.photoUrl} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
            ) : (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-300">
                <ImageOff size={16} />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-slate-800">{r.nom}</p>
              <p className="truncate text-xs text-slate-500">
                {r.vendeur ?? "—"} · {r.villeNom ?? "—"}
                {r.quartierNom ? ` · ${r.quartierNom}` : ""}
              </p>
              {r.distanceKm != null && (
                <p className="text-xs font-medium text-brand">
                  {r.distanceKm < 1
                    ? `${Math.round(r.distanceKm * 1000)} m`
                    : `${r.distanceKm.toFixed(1)} km`}
                </p>
              )}
            </div>
            {r.telephoneVendeur && <Phone size={15} className="shrink-0 text-green-600" />}
          </button>
        ))}
        {!loading && resultats.length === 0 && search.trim().length >= 2 && (
          <p className="text-sm text-slate-400">Aucun résultat.</p>
        )}
      </div>
    </div>
  );
}
