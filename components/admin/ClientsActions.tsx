"use client";

import { Printer } from "lucide-react";
import { ExportCsvButton } from "@/components/admin/ExportCsvButton";
import { imprimerListePdf } from "@/lib/utils/pdf-liste";
import type { ClientAcheteur } from "@/lib/queries/clients-acheteurs";

const COLONNES = ["Client", "Contact", "Téléphone", "Ville", "Quartier", "Type", "Achats", "Montant (FCFA)", "Dernier achat"];

export function ClientsActions({ clients, sousTitre }: { clients: ClientAcheteur[]; sousTitre: string }) {
  const date = (iso: string) => new Date(iso).toLocaleDateString("fr-FR");
  const lignesCsv = clients.map((c) => [
    c.nom, c.contact ?? "", c.telephone ?? "", c.ville ?? "", c.quartier ?? "", c.type ?? "", c.nbAchats, c.montant, date(c.dernierAchat),
  ]);

  return (
    <div className="flex flex-wrap gap-2">
      <ExportCsvButton colonnes={COLONNES} lignes={lignesCsv} nomFichier="clients" />
      <button
        onClick={() =>
          imprimerListePdf({
            titre: `Clients (${clients.length})`,
            sousTitre,
            paysage: true,
            droite: [6, 7],
            colonnes: COLONNES.map((c) => (c === "Montant (FCFA)" ? "Montant" : c)),
            lignes: clients.map((c) => [
              c.nom, c.contact ?? "", c.telephone ?? "", c.ville ?? "", c.quartier ?? "", c.type ?? "", c.nbAchats,
              c.montant.toLocaleString("fr-FR"), date(c.dernierAchat),
            ]),
          })
        }
        className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
      >
        <Printer size={15} /> Imprimer
      </button>
    </div>
  );
}
