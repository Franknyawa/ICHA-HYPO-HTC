import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  MapPin,
  Phone,
  User,
  CalendarDays,
  ShoppingBag,
  Wallet,
  ClipboardList,
} from "lucide-react";
import { getPointVenteDetail } from "@/lib/queries/points-vente";
import { formatMontant } from "@/lib/utils/format";
import { ImprimerButton } from "@/components/admin/ImprimerButton";

export const dynamic = "force-dynamic";

function mapsUrl(lat: unknown, lng: unknown) {
  if (lat == null || lng == null) return null;
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

function waUrl(tel: string | null) {
  if (!tel) return null;
  const digits = tel.replace(/[^\d]/g, "");
  return `https://wa.me/${digits}`;
}

function formatDate(d: Date) {
  return new Date(d).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const STATUT_STYLES: Record<string, string> = {
  EN_ATTENTE: "bg-amber-50 text-amber-700",
  EN_LIVRAISON: "bg-blue-50 text-blue-700",
  LIVREE: "bg-teal-50 text-teal-700",
  ANNULEE: "bg-red-50 text-red-700",
};

export default async function PointVenteDetailPage({ params }: { params: { id: string } }) {
  const pv = await getPointVenteDetail(params.id);
  if (!pv) {
    notFound();
    return null;
  }

  const maps = mapsUrl(pv.latitude, pv.longitude);
  const waVendeur = waUrl(pv.telephoneVendeur);

  return (
    <main>
      {/* En-tête print-only, cohérent avec /admin/rapports */}
      <div className="hidden print:block p-6 pb-2">
        <h1 className="text-xl font-bold text-slate-900">HYPO / HTC — ICHA IMPORT</h1>
        <p className="text-sm text-slate-500">Fiche point de vente — généré le {formatDate(new Date())}</p>
      </div>

      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-4 print:hidden md:px-6">
        <Link
          href="/admin/points-vente"
          className="flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-300"
        >
          <ArrowLeft size={16} />
          Retour aux points de vente
        </Link>
        <ImprimerButton />
      </div>

      <div className="space-y-4 p-4 md:p-6">
        {/* Carte d'en-tête */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 p-5 shadow-sm ring-1 ring-slate-100 dark:ring-slate-800">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">{pv.nom}</h1>
              <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                {pv.type?.nom ?? "—"} · {pv.ville?.nom ?? "—"}
                {pv.quartier ? ` · ${pv.quartier.nom}` : ""}
              </p>
            </div>
            {maps && (
              <a
                href={maps}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-xl bg-brand px-3 py-2 text-sm font-semibold text-white print:hidden"
              >
                <MapPin size={15} />
                Voir sur la carte
              </a>
            )}
          </div>

          {pv.createdBy && (
            <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
              Recensé par {pv.createdBy.prenom} {pv.createdBy.nom} le {formatDate(pv.createdAt)}
            </p>
          )}

          {/* Interlocuteur / Localisation */}
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl bg-slate-50 dark:bg-slate-950 p-3.5">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <User size={13} />
                Interlocuteur
              </p>
              <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{pv.vendeur ?? "—"}</p>
              <div className="mt-1 flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-300">
                {pv.telephoneVendeur && (
                  <a
                    href={waVendeur ?? undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-green-600"
                  >
                    <Phone size={13} />
                    {pv.telephoneVendeur} (vendeur)
                  </a>
                )}
                {pv.telephonePatron && (
                  <span className="flex items-center gap-1.5">
                    <Phone size={13} />
                    {pv.telephonePatron} (patron)
                  </span>
                )}
                {!pv.telephoneVendeur && !pv.telephonePatron && <span className="text-slate-400">—</span>}
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 dark:bg-slate-950 p-3.5">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <MapPin size={13} />
                Localisation
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-300">{pv.repere || "Aucun repère renseigné"}</p>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {pv.presentoir ? "Présentoir installé" : "Pas de présentoir"}
              </p>
            </div>
          </div>
        </div>

        {/* Tuiles statistiques */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-white dark:bg-slate-900 p-4 shadow-sm ring-1 ring-slate-100 dark:ring-slate-800">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <CalendarDays size={13} />
              Visite(s)
            </p>
            <p className="mt-1.5 text-2xl font-bold text-slate-800 dark:text-slate-100">{pv.nbVisites}</p>
          </div>
          <div className="rounded-2xl bg-white dark:bg-slate-900 p-4 shadow-sm ring-1 ring-slate-100 dark:ring-slate-800">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <ShoppingBag size={13} />
              Total vendu (FCFA)
            </p>
            <p className="mt-1.5 text-2xl font-bold text-brand">{formatMontant(pv.totalVenteFcfa)}</p>
          </div>
          <div className="rounded-2xl bg-white dark:bg-slate-900 p-4 shadow-sm ring-1 ring-slate-100 dark:ring-slate-800">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <Wallet size={13} />
              Reste à payer (FCFA)
            </p>
            <p className={`mt-1.5 text-2xl font-bold ${pv.resteAPayerFcfa > 0 ? "text-red-600" : "text-teal-600"}`}>
              {formatMontant(pv.resteAPayerFcfa)}
            </p>
          </div>
        </div>

        {/* Ventes */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 shadow-sm ring-1 ring-slate-100 dark:ring-slate-800">
          <div className="border-b border-slate-100 dark:border-slate-800 px-4 py-3">
            <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-800 dark:text-slate-100">
              <ShoppingBag size={15} />
              Ventes ({pv.ventes.length})
            </h2>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {pv.ventes.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-slate-400 dark:text-slate-500">Aucune vente enregistrée.</p>
            )}
            {pv.ventes.map((v) => (
              <div key={v.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <div>
                  <p className="font-medium text-slate-800 dark:text-slate-100">{v.produitsResume}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    {formatDate(v.createdAt)} · {v.commercialNom}
                    {v.clientNom ? ` · ${v.clientNom}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-slate-800 dark:text-slate-100">{formatMontant(v.montantTotal)} FCFA</p>
                  {v.montantDu > 0 && (
                    <p className="text-xs font-medium text-red-600">Reste {formatMontant(v.montantDu)} FCFA</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Commandes */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 shadow-sm ring-1 ring-slate-100 dark:ring-slate-800">
          <div className="border-b border-slate-100 dark:border-slate-800 px-4 py-3">
            <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-800 dark:text-slate-100">
              <ClipboardList size={15} />
              Commandes ({pv.commandes.length})
            </h2>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {pv.commandes.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-slate-400 dark:text-slate-500">Aucune commande enregistrée.</p>
            )}
            {pv.commandes.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <div>
                  <p className="font-medium text-slate-800 dark:text-slate-100">{c.produitsResume}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    {formatDate(c.dateCommande)} · {c.commercialNom}
                    {c.dateLivraisonPrevue ? ` · Livraison prévue le ${formatDate(c.dateLivraisonPrevue)}` : ""}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    STATUT_STYLES[c.statut] ?? "bg-slate-100 text-slate-600"
                  }`}
                >
                  {c.statut}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Historique des visites */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 shadow-sm ring-1 ring-slate-100 dark:ring-slate-800">
          <div className="border-b border-slate-100 dark:border-slate-800 px-4 py-3">
            <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-800 dark:text-slate-100">
              <CalendarDays size={15} />
              Historique des visites ({pv.visites.length})
            </h2>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {pv.visites.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-slate-400 dark:text-slate-500">Aucune visite enregistrée.</p>
            )}
            {pv.visites.map((v) => (
              <div key={v.id} className="px-4 py-3 text-sm">
                <p className="font-medium text-slate-800 dark:text-slate-100">
                  {formatDate(v.dateVisite)} · {v.commercialNom}
                </p>
                {v.observation && <p className="mt-0.5 text-slate-500 dark:text-slate-400">{v.observation}</p>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
