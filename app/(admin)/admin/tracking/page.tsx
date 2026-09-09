import Link from "next/link";
import { getVisitesAvecPosition, getPositionsActuelles } from "@/lib/queries/tracking";
import { prisma } from "@/lib/prisma";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { TrackingMapLoader } from "@/components/admin/TrackingMapLoader";
import { MapPin, History, Radio } from "lucide-react";

export default async function TrackingPage({
  searchParams,
}: {
  searchParams: { commercialId?: string; binomeId?: string; date?: string; mode?: string };
}) {
  const commercialId = searchParams.commercialId ?? "";
  const binomeId = searchParams.binomeId ?? "";
  const date = searchParams.date ?? new Date().toISOString().slice(0, 10);
  const mode = searchParams.mode === "positions" ? "positions" : "visites";

  const [visites, positions, commerciaux, binomes] = await Promise.all([
    mode === "visites"
      ? getVisitesAvecPosition({ commercialId, binomeId, date })
      : Promise.resolve([]),
    mode === "positions" ? getPositionsActuelles({ binomeId }) : Promise.resolve([]),
    prisma.user.findMany({
      where: { role: "COMMERCIAL" },
      orderBy: { nom: "asc" },
      select: { id: true, nom: true, prenom: true },
    }),
    prisma.binome.findMany({ orderBy: { nom: "asc" } }),
  ]);

  const pointsVisites = visites
    .filter((v) => v.latitude != null && v.longitude != null)
    .map((v) => ({
      id: v.id,
      dateVisite: v.dateVisite.toISOString(),
      latitude: Number(v.latitude),
      longitude: Number(v.longitude),
      precisionGps: v.precisionGps ? Number(v.precisionGps) : null,
      pointVenteNom: v.pointVente.nom,
      commercialId: v.commercial.id,
      commercialNom: `${v.commercial.prenom} ${v.commercial.nom}`,
      binomeNom: v.binome?.nom ?? null,
    }));

  const pointsPositions = positions
    .filter((p) => !commercialId || p.id === commercialId)
    .map((p) => ({
      id: p.id,
      dateVisite: p.positionAt,
      latitude: p.latitude,
      longitude: p.longitude,
      precisionGps: null,
      pointVenteNom: "Position actuelle",
      commercialId: p.id,
      commercialNom: p.nom,
      binomeNom: p.binomeNom,
    }));

  const points = mode === "visites" ? pointsVisites : pointsPositions;

  function buildQuery(overrides: Record<string, string | undefined>) {
    const sp = new URLSearchParams();
    const params = { commercialId, binomeId, date, mode, ...overrides };
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
    return sp.toString();
  }

  return (
    <main>
      <AdminPageHeader
        title="Tracking terrain"
        subtitle={`${points.length} ${mode === "visites" ? "visite(s) géolocalisée(s)" : "commercial(aux) localisé(s)"}`}
      />

      <div className="p-4 md:p-6">
        {/* Bascule Visites du jour / Position actuelle */}
        <div className="mb-4 inline-flex rounded-xl bg-white p-1 shadow-sm ring-1 ring-slate-100">
          <Link
            href={`/admin/tracking?${buildQuery({ mode: "visites" })}`}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold ${
              mode === "visites" ? "bg-brand text-white" : "text-slate-500"
            }`}
          >
            <History size={14} />
            Visites du jour
          </Link>
          <Link
            href={`/admin/tracking?${buildQuery({ mode: "positions" })}`}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold ${
              mode === "positions" ? "bg-brand text-white" : "text-slate-500"
            }`}
          >
            <Radio size={14} />
            Position actuelle
          </Link>
        </div>

        {mode === "positions" && (
          <p className="mb-4 rounded-xl bg-blue-50 px-3 py-2 text-xs text-blue-800">
            Position envoyée par le téléphone tant que l'app reste ouverte — pas un
            suivi permanent en arrière-plan. L'heure indiquée est celle du dernier
            battement reçu.
          </p>
        )}

        <form className="mb-4 grid grid-cols-2 gap-2 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100 md:grid-cols-4" action="/admin/tracking">
          <input type="hidden" name="mode" value={mode} />
          {mode === "visites" && (
            <input
              type="date"
              name="date"
              defaultValue={date}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          )}
          <select name="commercialId" defaultValue={commercialId} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
            <option value="">Tous les commerciaux</option>
            {commerciaux.map((c) => (
              <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>
            ))}
          </select>
          <select name="binomeId" defaultValue={binomeId} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
            <option value="">Tous les binômes</option>
            {binomes.map((b) => (
              <option key={b.id} value={b.id}>{b.nom}</option>
            ))}
          </select>
          <button type="submit" className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white">
            Filtrer
          </button>
        </form>

        {points.length > 0 ? (
          <TrackingMapLoader points={points} />
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-white py-16 shadow-sm ring-1 ring-slate-100">
            <MapPin size={28} className="text-slate-300" />
            <p className="text-sm text-slate-400">
              {mode === "visites"
                ? "Aucune visite géolocalisée pour ces filtres."
                : "Aucune position récente — les commerciaux doivent avoir l'app ouverte."}
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
