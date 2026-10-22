"use client";

import { Download, Printer } from "lucide-react";
import { ExportCsvButton } from "@/components/admin/ExportCsvButton";
import { imprimerListePdf } from "@/lib/utils/pdf-liste";
import type { ClientAcheteur } from "@/lib/queries/clients-acheteurs";

const COLONNES = ["Client", "Contact", "Téléphone", "Ville", "Quartier", "Type", "Commandes", "Cartons", "Montant (FCFA)", "Dernière commande"];

export function ClientsActions({ clients, sousTitre }: { clients: ClientAcheteur[]; sousTitre: string }) {
  const date = (iso: string) => new Date(iso).toLocaleDateString("fr-FR");
  const lignesCsv = clients.map((c) => [
    c.nom, c.contact ?? "", c.telephone ?? "", c.ville ?? "", c.quartier ?? "", c.type ?? "", c.nbAchats, c.cartons, c.montant, date(c.dernierAchat),
  ]);

  const pdf = (telecharger: boolean) =>
    imprimerListePdf({
      titre: `Clients (${clients.length})`,
      sousTitre,
      paysage: true,
      droite: [6, 7, 8],
      telecharger,
      nomFichier: "clients",
      colonnes: COLONNES.map((c) => (c === "Montant (FCFA)" ? "Montant" : c)),
      lignes: clients.map((c) => [
        c.nom, c.contact ?? "", c.telephone ?? "", c.ville ?? "", c.quartier ?? "", c.type ?? "", c.nbAchats, c.cartons.toLocaleString("fr-FR"),
        c.montant.toLocaleString("fr-FR"), date(c.dernierAchat),
      ]),
    });
  const classeBouton =
    "flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200";

  return (
    <div className="flex flex-wrap gap-2">
      <ExportCsvButton colonnes={COLONNES} lignes={lignesCsv} nomFichier="clients" />
      <button onClick={() => pdf(true)} className={classeBouton}>
        <Download size={15} /> Télécharger PDF
      </button>
      <button onClick={() => pdf(false)} className={classeBouton}>
        <Printer size={15} /> Imprimer
      </button>
    </div>
  );
}
