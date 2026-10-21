import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  MapPin,
  Phone,
  User,
  CalendarDays,
  ShoppingBag,
  Wallet,
  ClipboardList,
  BookOpen,
} from "lucide-react";
import { getPointVenteDetail } from "@/lib/queries/points-vente";
import { getCompteClient, type TypeEcriture } from "@/lib/queries/compte-client";
import { CorrectionButton } from "@/components/admin/CorrectionButton";
import { FicheClientButton } from "@/components/admin/FicheClientButton";
import { libelleRepondant } from "@/lib/utils/repondant";
import { formatMontant } from "@/lib/utils/format";
import { ArchiveButton } from "@/components/admin/ArchiveButton";
import { ImprimerButton } from "@/components/admin/ImprimerButton";
import { requireAdminPage } from "@/lib/auth/rbac";
import { peutAcceder, peutModifier } from "@/lib/auth/permissions";

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

const ETIQUETTE: Record<TypeEcriture, string> = {
  FACTURE: "Facture",
  PAIEMENT: "Encaissement",
  AVOIR: "Avoir",
  RETOUR: "Retour",
  REMBOURSEMENT: "Remboursement",
};

function Tuile({ icone, titre, valeur, sous, couleur }: { icone: React.ReactNode; titre: string; valeur: string; sous?: string; couleur?: string }) {
  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900 p-4 shadow-sm ring-1 ring-slate-100 dark:ring-slate-800">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {icone}
        {titre}
      </p>
      <p className={`mt-1.5 text-xl font-bold ${couleur ?? "text-slate-800 dark:text-slate-100"}`}>{valeur}</p>
      {sous && <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">{sous}</p>}
    </div>
  );
}

export default async function PointVenteDetailPage({ params }: { params: { id: string } }) {
  const session = await requireAdminPage("points-vente");
  // Le superviseur ne consulte pas la fiche détaillée d'un point de vente ou d'un client.
  if (!peutModifier(session.role)) redirect("/admin/points-vente");
  const [pv, compte] = await Promise.all([getPointVenteDetail(params.id), getCompteClient(params.id)]);
  if (!pv) {
    notFound();
    return null;
  }

  const maps = mapsUrl(pv.latitude, pv.longitude);
  const waVendeur = waUrl(pv.telephoneVendeur);
  const peutCorriger = peutAcceder(session.role, "factures");

  return (
    <main>
      {/* En-tête print-only, cohérent avec /admin/rapports */}
      <div className="hidden print:block p-6 pb-2">
        <h1 className="text-xl font-bold text-slate-900">ICHA IMPORT</h1>
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
        <div className="flex items-center gap-2">
          {peutAcceder(session.role, "archives") && (
            <ArchiveButton
              url={`/api/points-vente/${pv.id}/archiver`}
              archive={!pv.archivedAt}
              confirmation={pv.archivedAt ? undefined : "Archiver ce point de vente ? Il disparaîtra des listes et de la recherche des commerciaux ; son historique est conservé."}
            />
          )}
          <FicheClientButton
            data={{
              nom: pv.nom,
              interlocuteur: pv.vendeur,
              telephone: pv.telephoneVendeur,
              type: [...pv.typesNoms, ...(pv.typeAutre ? [pv.typeAutre] : [])].join(", ") || "—",
              adresse: [pv.quartier?.nom, pv.ville?.nom, pv.repere].filter(Boolean).join(", ") || "—",
              synthese: {
                facture: compte.totalFacture,
                encaisse: compte.totalPaye - compte.totalRembourse,
                avoirs: compte.totalAvoirs,
                retours: compte.totalRetours,
                reste: compte.soldeDu,
              },
              factures: compte.factures
                .slice()
                .reverse()
                .map((f) => ({ piece: f.piece, date: f.date.toISOString(), produits: f.produits, montant: f.montant, avoirs: f.avoirs, retours: f.retours, paye: f.paye - f.rembourse, reste: f.reste })),
              ecritures: compte.ecritures.map((e) => ({ date: e.date.toISOString(), piece: e.piece, libelle: e.libelle, debit: e.debit, credit: e.credit, solde: e.solde })),
            }}
          />
          <ImprimerButton />
        </div>
      </div>

      <div className="space-y-4 p-4 md:p-6">
        {/* Carte d'en-tête */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 p-5 shadow-sm ring-1 ring-slate-100 dark:ring-slate-800">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">{pv.nom}</h1>
              <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                {[...pv.typesNoms, ...(pv.typeAutre ? [pv.typeAutre] : [])].join(", ") || "—"} · {pv.ville?.nom ?? "—"}
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
              <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                {pv.vendeur ?? "—"}
                {libelleRepondant(pv.repondantRole, pv.repondantFonction) && (
                  <span className="ml-1.5 text-xs font-normal text-slate-500 dark:text-slate-400">
                    ({libelleRepondant(pv.repondantRole, pv.repondantFonction)})
                  </span>
                )}
              </p>
              <div className="mt-1 flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-300">
                {pv.telephoneVendeur && (
                  <a
                    href={waVendeur ?? undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-green-600"
                  >
                    <Phone size={13} />
                    {pv.telephoneVendeur}
                  </a>
                )}
                {!pv.telephoneVendeur && <span className="text-slate-400">—</span>}
              </div>
              {pv.repondantRole !== "PATRON" && (pv.patronNom || pv.telephonePatron) && (
                <div className="mt-3 border-t border-slate-200 pt-2.5 dark:border-slate-800">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Patron</p>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{pv.patronNom ?? "—"}</p>
                  {pv.telephonePatron && (
                    <a
                      href={waUrl(pv.telephonePatron) ?? undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 flex items-center gap-1.5 text-sm text-green-600"
                    >
                      <Phone size={13} />
                      {pv.telephonePatron}
                    </a>
                  )}
                </div>
              )}
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

        {/* Compte client : synthèse */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Tuile icone={<CalendarDays size={13} />} titre="Visite(s)" valeur={String(pv.nbVisites)} />
          <Tuile icone={<ShoppingBag size={13} />} titre="Facturation (débit)" valeur={`${formatMontant(compte.totalFacture)} FCFA`} sous="Commandes validées" />
          <Tuile
            icone={<Wallet size={13} />}
            titre="Caisse (crédit)"
            valeur={`${formatMontant(compte.totalPaye - compte.totalRembourse + compte.totalAvoirs + compte.totalRetours)} FCFA`}
            sous={`Encaissé ${formatMontant(compte.totalPaye - compte.totalRembourse)} · avoirs ${formatMontant(compte.totalAvoirs)} · retours ${formatMontant(compte.totalRetours)}`}
          />
          <Tuile
            icone={<Wallet size={13} />}
            titre="Reste à encaisser"
            valeur={`${formatMontant(compte.soldeDu)} FCFA`}
            sous={compte.soldeDu > 0 ? "Le client doit" : "Compte soldé"}
            couleur={compte.soldeDu > 0 ? "text-red-600" : "text-teal-600"}
          />
        </div>

        {/* Relevé de compte */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 shadow-sm ring-1 ring-slate-100 dark:ring-slate-800">
          <div className="border-b border-slate-100 dark:border-slate-800 px-4 py-3">
            <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-800 dark:text-slate-100">
              <BookOpen size={15} />
              Factures et situation ({compte.factures.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-2 font-semibold">Facture</th>
                  <th className="px-2 py-2 font-semibold">Date</th>
                  <th className="px-2 py-2 text-right font-semibold">Montant</th>
                  <th className="px-2 py-2 text-right font-semibold">Avoirs</th>
                  <th className="px-2 py-2 text-right font-semibold">Retours</th>
                  <th className="px-2 py-2 text-right font-semibold">Encaissé</th>
                  <th className="px-2 py-2 text-right font-semibold">Reste</th>
                  {peutCorriger && <th className="px-4 py-2" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {compte.factures.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-6 text-center text-slate-400">Aucune facture : le compte se remplit dès qu&apos;une commande est validée.</td></tr>
                )}
                {compte.factures.map((f) => (
                  <tr key={f.commandeId}>
                    <td className="px-4 py-2.5">
                      <p className="font-semibold text-slate-800 dark:text-slate-100">{f.piece}</p>
                      <p className="text-xs text-slate-400">{f.produits}</p>
                    </td>
                    <td className="px-2 py-2.5 text-slate-500">{formatDate(f.date)}</td>
                    <td className="px-2 py-2.5 text-right font-medium">{formatMontant(f.montant)}</td>
                    <td className="px-2 py-2.5 text-right text-slate-500">{f.avoirs ? `−${formatMontant(f.avoirs)}` : "—"}</td>
                    <td className="px-2 py-2.5 text-right text-slate-500">{f.retours ? `−${formatMontant(f.retours)}` : "—"}</td>
                    <td className="px-2 py-2.5 text-right text-slate-500">{formatMontant(f.paye - f.rembourse)}</td>
                    <td className={`px-2 py-2.5 text-right font-semibold ${f.reste > 0 ? "text-red-600" : "text-teal-600"}`}>{formatMontant(f.reste)}</td>
                    {peutCorriger && (
                      <td className="px-4 py-2.5 text-right print:hidden"><CorrectionButton commandeId={f.commandeId} /></td>
                    )}
                  </tr>
                ))}
              </tbody>
              {compte.factures.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-slate-200 font-bold dark:border-slate-700">
                    <td className="px-4 py-2.5" colSpan={2}>Total</td>
                    <td className="px-2 py-2.5 text-right">{formatMontant(compte.totalFacture)}</td>
                    <td className="px-2 py-2.5 text-right">{compte.totalAvoirs ? `−${formatMontant(compte.totalAvoirs)}` : "—"}</td>
                    <td className="px-2 py-2.5 text-right">{compte.totalRetours ? `−${formatMontant(compte.totalRetours)}` : "—"}</td>
                    <td className="px-2 py-2.5 text-right">{formatMontant(compte.totalPaye - compte.totalRembourse)}</td>
                    <td className={`px-2 py-2.5 text-right ${compte.soldeDu > 0 ? "text-red-600" : "text-teal-600"}`}>{formatMontant(compte.soldeDu)}</td>
                    {peutCorriger && <td />}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        <div className="rounded-2xl bg-white dark:bg-slate-900 shadow-sm ring-1 ring-slate-100 dark:ring-slate-800">
          <div className="border-b border-slate-100 dark:border-slate-800 px-4 py-3">
            <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-800 dark:text-slate-100">
              <BookOpen size={15} />
              Relevé de compte (journal débit / crédit)
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-2 font-semibold">Date</th>
                  <th className="px-2 py-2 font-semibold">Pièce</th>
                  <th className="px-2 py-2 font-semibold">Libellé</th>
                  <th className="px-2 py-2 text-right font-semibold">Débit</th>
                  <th className="px-2 py-2 text-right font-semibold">Crédit</th>
                  <th className="px-4 py-2 text-right font-semibold">Solde</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {compte.ecritures.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">Aucune écriture.</td></tr>
                )}
                {compte.ecritures.map((e) => (
                  <tr key={e.cle}>
                    <td className="px-4 py-2.5 text-slate-500">{formatDate(e.date)}</td>
                    <td className="px-2 py-2.5 font-medium text-slate-800 dark:text-slate-100">
                      {e.piece}
                      <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">{ETIQUETTE[e.type]}</span>
                    </td>
                    <td className="px-2 py-2.5 text-slate-600 dark:text-slate-300">{e.libelle}</td>
                    <td className="px-2 py-2.5 text-right">{e.debit ? formatMontant(e.debit) : ""}</td>
                    <td className="px-2 py-2.5 text-right text-teal-700">{e.credit ? formatMontant(e.credit) : ""}</td>
                    <td className={`px-4 py-2.5 text-right font-semibold ${e.solde > 0 ? "text-red-600" : "text-slate-700 dark:text-slate-200"}`}>{formatMontant(e.solde)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {compte.enAttente.length > 0 && (
            <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-400 dark:border-slate-800">
              {compte.enAttente.length} commande(s) en attente de validation, non facturée(s) :{" "}
              {formatMontant(compte.enAttente.reduce((s, c) => s + c.montant, 0))} FCFA.
            </p>
          )}
        </div>

        {/* Ventes */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 shadow-sm ring-1 ring-slate-100 dark:ring-slate-800">
          <div className="border-b border-slate-100 dark:border-slate-800 px-4 py-3">
            <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-800 dark:text-slate-100">
              <ShoppingBag size={15} />
              Ventes saisies sur le terrain ({pv.ventes.length})
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
