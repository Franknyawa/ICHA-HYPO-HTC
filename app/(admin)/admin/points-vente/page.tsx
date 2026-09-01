import Link from "next/link";
import { MapPin, ImageOff, Phone, ChevronLeft, ChevronRight } from "lucide-react";
import { listPointsVente } from "@/lib/queries/points-vente";
import { prisma } from "@/lib/prisma";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

function mapsUrl(lat: unknown, lng: unknown) {
  if (lat == null || lng == null) return null;
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

function waUrl(tel: string | null) {
  if (!tel) return null;
  const digits = tel.replace(/[^\d]/g, "");
  return `https://wa.me/${digits}`;
}

function buildQuery(params: Record<string, string | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) sp.set(k, v);
  }
  return sp.toString();
}

export default async function PointsVentePage({
  searchParams,
}: {
  searchParams: {
    page?: string;
    search?: string;
    villeId?: string;
    quartierId?: string;
    typeId?: string;
    triCommandes?: string;
  };
}) {
  const page = Number(searchParams.page ?? "1") || 1;
  const search = searchParams.search ?? "";
  const villeId = searchParams.villeId ?? "";
  const quartierId = searchParams.quartierId ?? "";
  const typeId = searchParams.typeId ?? "";
  const triCommandes = (searchParams.triCommandes as "asc" | "desc" | undefined) ?? undefined;

  const [{ data, pagination }, villes, quartiers, types] = await Promise.all([
    listPointsVente({ page, search, villeId, quartierId, typeId, triCommandes }),
    prisma.ville.findMany({ orderBy: { nom: "asc" } }),
    prisma.quartier.findMany({
      where: villeId ? { villeId } : undefined,
      orderBy: { nom: "asc" },
    }),
    prisma.typePointVente.findMany({ orderBy: { nom: "asc" } }),
  ]);

  const baseQuery = { search, villeId, quartierId, typeId, triCommandes };

  return (
    <main>
      <AdminPageHeader
        title="Points de vente"
        subtitle={`${pagination.total} au total`}
      />

      <div className="p-4 md:p-6">
        {/* Filtres */}
        <form className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-5" action="/admin/points-vente">
          <input
            type="text"
            name="search"
            defaultValue={search}
            placeholder="Rechercher..."
            className="col-span-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm md:col-span-1"
          />
          <select
            name="villeId"
            defaultValue={villeId}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <option value="">Toutes les villes</option>
            {villes.map((v) => (
              <option key={v.id} value={v.id}>
                {v.nom}
              </option>
            ))}
          </select>
          <select
            name="quartierId"
            defaultValue={quartierId}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <option value="">Tous les quartiers</option>
            {quartiers.map((q) => (
              <option key={q.id} value={q.id}>
                {q.nom}
              </option>
            ))}
          </select>
          <select
            name="typeId"
            defaultValue={typeId}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <option value="">Tous les types</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nom}
              </option>
            ))}
          </select>
          <select
            name="triCommandes"
            defaultValue={triCommandes ?? ""}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <option value="">Tri par date</option>
            <option value="desc">Plus de commandes d&apos;abord</option>
            <option value="asc">Moins de commandes d&apos;abord</option>
          </select>
          <button
            type="submit"
            className="col-span-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white md:col-span-5"
          >
            Filtrer
          </button>
        </form>

        {/* Tableau desktop */}
        <div className="hidden overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100 md:block">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3">Photo</th>
                <th className="px-4 py-3">Nom</th>
                <th className="px-4 py-3">Vendeur</th>
                <th className="px-4 py-3">Ville / Quartier</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Commandes</th>
                <th className="px-4 py-3">Carte</th>
              </tr>
            </thead>
            <tbody>
              {data.map((pv) => {
                const photo = pv.photos?.[0];
                const maps = mapsUrl(pv.latitude, pv.longitude);
                const wa = waUrl(pv.telephoneVendeur);
                return (
                  <tr key={pv.id} className="border-t border-slate-100">
                    <td className="px-4 py-2.5">
                      {photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={photo.url}
                          alt={pv.nom}
                          className="h-11 w-11 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-100 text-slate-300">
                          <ImageOff size={16} />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-slate-800">{pv.nom}</td>
                    <td className="px-4 py-2.5">
                      <p className="text-slate-700">{pv.vendeur ?? "—"}</p>
                      {wa && (
                        <a
                          href={wa}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs font-medium text-green-600"
                        >
                          <Phone size={11} />
                          {pv.telephoneVendeur}
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {pv.ville?.nom ?? "—"}
                      {pv.quartier ? ` · ${pv.quartier.nom}` : ""}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{pv.type?.nom ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      <span className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700">
                        {pv._count.commandes}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {maps ? (
                        <a
                          href={maps}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 font-medium text-brand"
                        >
                          <MapPin size={14} />
                          Voir
                        </a>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {data.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    Aucun point de vente trouvé.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Cartes mobile */}
        <div className="space-y-2 md:hidden">
          {data.map((pv) => {
            const photo = pv.photos?.[0];
            const maps = mapsUrl(pv.latitude, pv.longitude);
            const wa = waUrl(pv.telephoneVendeur);
            return (
              <div
                key={pv.id}
                className="flex gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-100"
              >
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photo.url}
                    alt={pv.nom}
                    className="h-14 w-14 shrink-0 rounded-xl object-cover"
                  />
                ) : (
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-300">
                    <ImageOff size={18} />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="truncate font-medium text-slate-800">{pv.nom}</p>
                    <span className="shrink-0 rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-semibold text-teal-700">
                      {pv._count.commandes} cmd.
                    </span>
                  </div>
                  <p className="text-sm text-slate-500">
                    {pv.ville?.nom ?? "—"} · {pv.quartier?.nom ?? "—"}
                  </p>
                  <div className="mt-1 flex items-center gap-3">
                    {maps && (
                      <a
                        href={maps}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs font-medium text-brand"
                      >
                        <MapPin size={12} />
                        Carte
                      </a>
                    )}
                    {wa && (
                      <a
                        href={wa}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs font-medium text-green-600"
                      >
                        <Phone size={12} />
                        WhatsApp
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Pagination */}
        <div className="mt-5 flex items-center justify-between text-sm text-slate-500">
          <span>
            Page {pagination.page} / {pagination.totalPages}
          </span>
          <div className="flex gap-2">
            <Link
              href={`/admin/points-vente?${buildQuery({ ...baseQuery, page: String(pagination.page - 1) })}`}
              aria-disabled={pagination.page <= 1}
              className={`flex items-center gap-1 rounded-xl border px-3 py-1.5 font-medium ${
                pagination.page <= 1
                  ? "pointer-events-none border-slate-100 text-slate-300"
                  : "border-slate-200 text-slate-600"
              }`}
            >
              <ChevronLeft size={15} />
              Précédent
            </Link>
            <Link
              href={`/admin/points-vente?${buildQuery({ ...baseQuery, page: String(pagination.page + 1) })}`}
              aria-disabled={pagination.page >= pagination.totalPages}
              className={`flex items-center gap-1 rounded-xl border px-3 py-1.5 font-medium ${
                pagination.page >= pagination.totalPages
                  ? "pointer-events-none border-slate-100 text-slate-300"
                  : "border-slate-200 text-slate-600"
              }`}
            >
              Suivant
              <ChevronRight size={15} />
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
