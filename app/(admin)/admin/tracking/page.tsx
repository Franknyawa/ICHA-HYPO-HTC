import { getVisitesAvecPosition } from "@/lib/queries/tracking";
import { prisma } from "@/lib/prisma";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { TrackingMapLoader } from "@/components/admin/TrackingMapLoader";
import { MapPin } from "lucide-react";

export default async function TrackingPage({
  searchParams,
}: {
  searchParams: { commercialId?: string; binomeId?: string; date?: string };
}) {
  const commercialId = searchParams.commercialId ?? "";
  const binomeId = searchParams.binomeId ?? "";
  const date = searchParams.date ?? new Date().toISOString().slice(0, 10);

  const [visites, commerciaux, binomes] = await Promise.all([
    getVisitesAvecPosition({ commercialId, binomeId, date }),
    prisma.user.findMany({
      where: { role: "COMMERCIAL" },
      orderBy: { nom: "asc" },
      select: { id: true, nom: true, prenom: true },
    }),
    prisma.binome.findMany({ orderBy: { nom: "asc" } }),
  ]);

  const points = visites
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

  return (
    <main>
      <AdminPageHeader
        title="Tracking terrain"
        subtitle={`${points.length} visite${points.length > 1 ? "s" : ""} géolocalisée${points.length > 1 ? "s" : ""}`}
      />

      <div className="p-4 md:p-6">
        <form className="mb-4 grid grid-cols-2 gap-2 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100 md:grid-cols-4" action="/admin/tracking">
          <input
            type="date"
            name="date"
            defaultValue={date}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
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
            <p className="text-sm text-slate-400">Aucune visite géolocalisée pour ces filtres.</p>
          </div>
        )}
      </div>
    </main>
  );
}
