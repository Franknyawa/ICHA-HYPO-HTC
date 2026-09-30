"use client";

import { useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { genererBonLivraisonPdf } from "@/lib/utils/bon-livraison-pdf";

type CommandeBonLivraison = {
  id: string;
  dateCommande: string;
  pointVente: {
    nom: string;
    vendeur?: string | null;
    ville?: { nom: string } | null;
    quartier?: { nom: string } | null;
  };
  client?: { nom: string } | null;
  commercial: { nom: string; prenom: string };
  lignes: { nbSachets: number; nbFilets: number; nbCartons: number; produit: { code: string } }[];
};

export function BonLivraisonButton({ commande }: { commande: CommandeBonLivraison }) {
  const [loading, setLoading] = useState(false);

  async function generer() {
    setLoading(true);
    try {
      await genererBonLivraisonPdf({
        numeroCommande: commande.id.slice(0, 8).toUpperCase(),
        dateCommande: new Date(commande.dateCommande),
        dateLivraison: new Date(),
        destinataireNom: commande.client?.nom ?? commande.pointVente.nom,
        vendeurNom: commande.pointVente.vendeur ?? null,
        villeNom: commande.pointVente.ville?.nom ?? null,
        quartierNom: commande.pointVente.quartier?.nom ?? null,
        commercialNom: `${commande.commercial.prenom} ${commande.commercial.nom}`,
        lignes: commande.lignes.map((l) => ({
          produitCode: l.produit.code,
          nbSachets: l.nbSachets,
          nbFilets: l.nbFilets,
          nbCartons: l.nbCartons,
        })),
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={generer}
      disabled={loading}
      className="flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 disabled:opacity-50"
    >
      {loading ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
      Bon de livraison
    </button>
  );
}
