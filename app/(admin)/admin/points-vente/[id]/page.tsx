import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, MapPin, Phone, User, Store, Users2, Camera, Tag } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getPointVenteDetail } from "@/lib/queries/points-vente";
import { libelleRepondant } from "@/lib/utils/repondant";
import { ArchiveButton } from "@/components/admin/ArchiveButton";
import { ImprimerButton } from "@/components/admin/ImprimerButton";
import { PointVenteForm } from "@/components/admin/PointVenteForm";
import { requireAdminPage } from "@/lib/auth/rbac";
import { peutAcceder, peutModifier } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

const dateLongue = (d: Date) => new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
const waUrl = (tel: string | null) => (tel ? `https://wa.me/${tel.replace(/[^\d]/g, "")}` : null);

function Bloc({ icone, titre, children }: { icone: React.ReactNode; titre: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3.5 dark:bg-slate-950">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {icone}
        {titre}
      </p>
      {children}
    </div>
  );
}

function Ligne({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <p className="flex justify-between gap-3 py-0.5 text-sm">
      <span className="text-slate-500 dark:text-slate-400">{k}</span>
      <span className="text-right font-medium text-slate-800 dark:text-slate-100">{v || "—"}</span>
    </p>
  );
}

function Tel({ tel }: { tel: string | null }) {
  if (!tel) return <>—</>;
  return (
    <a href={waUrl(tel) ?? undefined} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-green-600">
      <Phone size={12} />
      {tel}
    </a>
  );
}

/**
 * Fiche d'un point de vente = ses DONNÉES RECENSÉES (identité, interlocuteur, localisation, photos),
 * modifiables. Les mouvements financiers sont sur la fiche client (/admin/clients/[id]).
 */
export default async function PointVenteDetailPage({ params }: { params: { id: string } }) {
  const session = await requireAdminPage("points-vente");
  if (!peutModifier(session.role)) redirect("/admin/points-vente");

  const [pv, brut, photos, villes, quartiers, types, aCommandeValidee] = await Promise.all([
    getPointVenteDetail(params.id),
    prisma.pointVente.findUnique({
      where: { id: params.id },
      select: { villeId: true, quartierId: true, precisionGps: true },
    }),
    prisma.photo.findMany({
      where: { pointVenteId: params.id },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: { id: true, createdAt: true },
    }),
    prisma.ville.findMany({ where: { actif: true }, orderBy: { nom: "asc" }, select: { id: true, nom: true } }),
    prisma.quartier.findMany({ where: { actif: true }, orderBy: { nom: "asc" }, select: { id: true, nom: true, villeId: true } }),
    prisma.typePointVente.findMany({ where: { actif: true }, orderBy: { ordre: "asc" }, select: { id: true, nom: true } }),
    prisma.commande.count({ where: { pointVenteId: params.id, statut: { in: ["EN_LIVRAISON", "LIVREE"] } } }),
  ]);
  if (!pv || !brut) {
    notFound();
    return null;
  }
  const lat = pv.latitude != null ? Number(pv.latitude) : null;
  const lng = pv.longitude != null ? Number(pv.longitude) : null;
  const maps = lat != null && lng != null ? `https://www.google.com/maps?q=${lat},${lng}` : null;
  const typesTxt = [...pv.typesNoms, ...(pv.typeAutre ? [pv.typeAutre] : [])].join(", ");
  const derniereVisite = pv.visites[0]?.dateVisite ?? null;

  return (
    <main>
      <div className="hidden p-6 pb-2 print:block">
        <h1 className="text-xl font-bold text-slate-900">ICHA IMPORT</h1>
        <p className="text-sm text-slate-500">Fiche point de vente — généré le {dateLongue(new Date())}</p>
      </div>

      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-4 dark:border-slate-700 dark:bg-slate-900 print:hidden md:px-6">
        <Link href="/admin/points-vente" className="flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-300">
          <ArrowLeft size={16} />
          Retour aux points de vente
        </Link>
        <div className="flex items-center gap-2">
          {session.role === "SUPER_ADMIN" && peutAcceder(session.role, "archives") && (
            <ArchiveButton
              url={`/api/points-vente/${pv.id}/archiver`}
              archive={!pv.archivedAt}
              confirmation={pv.archivedAt ? undefined : "Archiver ce point de vente ? Il disparaîtra des listes et de la recherche des commerciaux ; son historique est conservé."}
            />
          )}
          <ImprimerButton />
        </div>
      </div>

      <div className="space-y-4 p-4 md:p-6">
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                {pv.nom}
              </h1>
              <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                {typesTxt || "Type non précisé"} · {pv.ville?.nom ?? "—"}
                {pv.quartier ? ` · ${pv.quartier.nom}` : ""}
              </p>
              {pv.createdBy && (
                <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                  Recensé par {pv.createdBy.prenom} {pv.createdBy.nom} le {dateLongue(pv.createdAt)}
                  {derniereVisite ? ` · dernière visite le ${dateLongue(derniereVisite)}` : ""}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2 print:hidden">
              {aCommandeValidee > 0 && pv.nom !== "CLIENT DIVERS" && (
                <Link href={`/admin/clients/${pv.id}`} className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">
                  <Users2 size={15} />
                  Fiche client (mouvements)
                </Link>
              )}
              {maps && (
                <a href={maps} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded-xl bg-brand px-3 py-2 text-sm font-semibold text-white">
                  <MapPin size={15} />
                  Voir sur la carte
                </a>
              )}
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <Bloc icone={<User size={13} />} titre="Interlocuteur">
              <Ligne k="Nom" v={pv.vendeur} />
              <Ligne k="Fonction" v={libelleRepondant(pv.repondantRole, pv.repondantFonction)} />
              <Ligne k="Téléphone" v={<Tel tel={pv.telephoneVendeur} />} />
              <Ligne k="Patron" v={pv.patronNom} />
              <Ligne k="Tél. patron" v={<Tel tel={pv.telephonePatron} />} />
            </Bloc>
            <Bloc icone={<Store size={13} />} titre="Point de vente">
              <Ligne k="Type(s)" v={typesTxt} />
              <Ligne k="Présentoir" v={pv.presentoir ? "Installé" : "Non"} />
              <Ligne k="Visites" v={String(pv.nbVisites)} />
              <Ligne k="Statut" v={pv.archivedAt ? "Archivé" : aCommandeValidee ? "Client" : "Prospect / recensé"} />
            </Bloc>
            <Bloc icone={<MapPin size={13} />} titre="Localisation">
              <Ligne k="Ville" v={pv.ville?.nom} />
              <Ligne k="Quartier" v={pv.quartier?.nom} />
              <Ligne k="Repère" v={pv.repere} />
              <Ligne k="GPS" v={lat != null && lng != null ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : null} />
              <Ligne k="Précision" v={brut.precisionGps != null ? `${Number(brut.precisionGps).toFixed(0)} m` : null} />
            </Bloc>
          </div>
        </div>

        {session.role === "SUPER_ADMIN" && (
        <PointVenteForm
          pv={{
            id: pv.id,
            nom: pv.nom,
            vendeur: pv.vendeur,
            telephoneVendeur: pv.telephoneVendeur,
            repondantRole: pv.repondantRole,
            repondantFonction: pv.repondantFonction,
            patronNom: pv.patronNom,
            telephonePatron: pv.telephonePatron,
            villeId: brut.villeId,
            quartierId: brut.quartierId,
            repere: pv.repere,
            typesIds: pv.typesIds,
            typeAutre: pv.typeAutre,
            presentoir: pv.presentoir,
            latitude: lat,
            longitude: lng,
          }}
          villes={villes}
          quartiers={quartiers}
          types={types}
        />
        )}

        <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
          <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-800 dark:text-slate-100">
              <Camera size={15} />
              Photos ({photos.length})
            </h2>
          </div>
          {photos.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-400">Aucune photo.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 p-3 md:grid-cols-4">
              {photos.map((ph) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={ph.id} src={`/api/points-vente/photo/${ph.id}`} alt="Point de vente" className="aspect-square w-full rounded-xl object-cover" loading="lazy" />
              ))}
            </div>
          )}
        </div>
        <p className="flex items-center gap-1.5 text-xs text-slate-400 print:hidden">
          <Tag size={12} /> Les commandes, factures, encaissements et dates de passage se consultent dans l&apos;onglet Clients.
        </p>
      </div>
    </main>
  );
}
