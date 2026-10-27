import Link from "next/link";
import { getVisitesAvecPosition, getPositionsActuelles, getPointsVenteCarte } from "@/lib/queries/tracking";
import { listerVilles } from "@/lib/geo/synchro-villes";
import { PointsVenteMapLoader } from "@/components/admin/PointsVenteMapLoader";
import { prisma } from "@/lib/prisma";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { TrackingMapLoader } from "@/components/admin/TrackingMapLoader";
import { MapPin, History, Radio, Store } from "lucide-react";
import { requireAdminPage } from "@/lib/auth/rbac";

// Données live (base de données) : jamais pré-généré statiquement au build
// (évite d'épuiser le pool de connexions Prisma pendant `next build`, et
// une page admin ne doit de toute façon jamais servir de données figées).
export const dynamic = "force-dynamic";

export default async function TrackingPage({
  searchParams,
}: {
  searchParams: { commercialId?: string; binomeId?: string; date?: string; mode?: string; villeId?: string; typeId?: string; statut?: string };
}) {
  await requireAdminPage("tracking");
  const commercialId = searchParams.commercialId ?? "";
  const binomeId = searchParams.binomeId ?? "";
  const date = searchParams.date ?? new Date().toISOString().slice(0, 10);
  const mode = searchParams.mode === "positions" ? "positions" : searchParams.mode === "points-vente" ? "points-vente" : "visites";
  const villeId = searchParams.villeId ?? "";
  const typeId = searchParams.typeId ?? "";
  const statutPv = searchParams.statut ?? "";

  const [carte, villes, types] =
    mode === "points-vente"
      ? await Promise.all([
          getPointsVenteCarte({ villeId, typeId, statut: statutPv, commercialId }),
          listerVilles(),
          prisma.typePointVente.findMany({ where: { actif: true }, orderBy: { ordre: "asc" }, select: { id: true, nom: true } }),
        ])
      : [null, [], []];

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

  const points = mode === "visites" ? pointsVisites : mode === "positions" ? pointsPositions : [];

  function buildQuery(overrides: Record<string, string | undefined>) {
    const sp = new URLSearchParams();
    const params = { commercialId, binomeId, date, mode, villeId, typeId, statut: statutPv, ...overrides };
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
    return sp.toString();
  }

  return (
    <main>
      <AdminPageHeader
        title="Tracking terrain"
        subtitle={
          mode === "points-vente"
            ? `${carte?.points.length ?? 0} point(s) de vente sur la carte`
            : `${points.length} ${mode === "visites" ? "visite(s) géolocalisée(s)" : "commercial(aux) localisé(s)"}`
        }
      />

      <div className="p-4 md:p-6">
        {/* Bascule Visites du jour / Position actuelle */}
        <div className="mb-4 inline-flex rounded-xl bg-white dark:bg-slate-900 p-1 shadow-sm ring-1 ring-slate-100 dark:ring-slate-800">
          <Link
            href={`/admin/tracking?${buildQuery({ mode: "visites" })}`}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold ${
              mode === "visites" ? "bg-brand text-white" : "text-slate-500 dark:text-slate-400 dark:text-slate-500"
            }`}
          >
            <History size={14} />
            Visites du jour
          </Link>
          <Link
            href={`/admin/tracking?${buildQuery({ mode: "positions" })}`}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold ${
              mode === "positions" ? "bg-brand text-white" : "text-slate-500 dark:text-slate-400 dark:text-slate-500"
            }`}
          >
            <Radio size={14} />
            Position actuelle
          </Link>
          <Link
            href={`/admin/tracking?${buildQuery({ mode: "points-vente" })}`}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold ${
              mode === "points-vente" ? "bg-brand text-white" : "text-slate-500 dark:text-slate-400 dark:text-slate-500"
            }`}
          >
            <Store size={14} />
            Points de vente
          </Link>
        </div>

        {mode === "points-vente" && (
          <>
            <form className="mb-4 grid grid-cols-2 gap-2 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800 md:grid-cols-5" action="/admin/tracking">
              <input type="hidden" name="mode" value="points-vente" />
              {[
                { name: "villeId", value: villeId, vide: "Toutes les villes", options: villes.map((v) => ({ id: v.id, nom: v.nom })) },
                { name: "typeId", value: typeId, vide: "Tous les types", options: types },
                {
                  name: "statut",
                  value: statutPv,
                  vide: "Tous les statuts",
                  options: [
                    { id: "client", nom: "Clients (commande validée)" },
                    { id: "indecis", nom: "Prospects indécis" },
                    { id: "prospect", nom: "Sans commande" },
                  ],
                },
                { name: "commercialId", value: commercialId, vide: "Ajoutés par : tous", options: commerciaux.map((c) => ({ id: c.id, nom: `${c.prenom} ${c.nom}` })) },
              ].map((f) => (
                <select key={f.name} name={f.name} defaultValue={f.value} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
                  <option value="">{f.vide}</option>
                  {f.options.map((o) => (
                    <option key={o.id} value={o.id}>{o.nom}</option>
                  ))}
                </select>
              ))}
              <button type="submit" className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white">Filtrer</button>
            </form>
            {carte && carte.sansPosition > 0 && (
              <p className="mb-4 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                {carte.sansPosition} point(s) de vente sur {carte.total} n&apos;ont pas de position GPS enregistrée : ils ne peuvent pas apparaître sur la carte.
              </p>
            )}
            {carte && carte.points.length > 0 ? (
              <PointsVenteMapLoader points={carte.points} />
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-white py-16 shadow-sm ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
                <MapPin size={28} className="text-slate-300" />
                <p className="text-sm text-slate-400 dark:text-slate-500">Aucun point de vente géolocalisé pour ces filtres.</p>
              </div>
            )}
          </>
        )}

        {mode === "positions" && (
          <p className="mb-4 rounded-xl bg-blue-50 px-3 py-2 text-xs text-blue-800">
            Position envoyée par le téléphone tant que l'app reste ouverte — pas un
            suivi permanent en arrière-plan. L'heure indiquée est celle du dernier
            battement reçu.
          </p>
        )}

        {mode === "visites" && (
          <p className="mb-4 rounded-xl bg-blue-50 px-3 py-2 text-xs text-blue-800 dark:bg-blue-950/40 dark:text-blue-300">
            La ligne pointillée relie les visites de chaque commercial dans
            l'ordre chronologique — c'est son itinéraire de la journée
            sélectionnée. Clique sur un point pour voir son numéro d'étape.
          </p>
        )}

        {mode !== "points-vente" && (<>
        <form className="mb-4 grid grid-cols-2 gap-2 rounded-2xl bg-white dark:bg-slate-900 p-4 shadow-sm ring-1 ring-slate-100 dark:ring-slate-800 md:grid-cols-4" action="/admin/tracking">
          <input type="hidden" name="mode" value={mode} />
          {mode === "visites" && (
            <input
              type="date"
              name="date"
              defaultValue={date}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-100"
            />
          )}
          <select name="commercialId" defaultValue={commercialId} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-100">
            <option value="">Tous les commerciaux</option>
            {commerciaux.map((c) => (
              <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>
            ))}
          </select>
          <select name="binomeId" defaultValue={binomeId} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-100">
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
          <div className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-white dark:bg-slate-900 py-16 shadow-sm ring-1 ring-slate-100 dark:ring-slate-800">
            <MapPin size={28} className="text-slate-300" />
            <p className="text-sm text-slate-400 dark:text-slate-500">
              {mode === "visites"
                ? "Aucune visite géolocalisée pour ces filtres."
                : "Aucune position récente — les commerciaux doivent avoir l'app ouverte."}
            </p>
          </div>
        )}
        </>)}
      </div>
    </main>
  );
}
