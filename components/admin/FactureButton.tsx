"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { genererFacturePdf } from "@/lib/utils/facture-pdf";

type VenteFacture = {
  id: string;
  montantTotal: number;
  createdAt: string;
  pointVente: { nom: string; ville?: { nom: string } | null };
  commercial: { nom: string; prenom: string };
  lignes: { nbSachets: number; nbFilets: number; nbCartons: number; produit: { code: string } }[];
  paiements: { montant: number; modePaiement: string; estCredit: boolean }[];
};

const MODE_LABEL: Record<string, string> = {
  ESPECES: "Espèces",
  MOBILE_MONEY: "Mobile Money",
  CREDIT_PARTIEL: "Crédit partiel",
  CREDIT_TOTAL: "Crédit total",
};

export function FactureButton({ vente }: { vente: VenteFacture }) {
  const [loading, setLoading] = useState(false);

  async function generer() {
    setLoading(true);
    try {
      const paiement = vente.paiements[0];
      const montantRecu = paiement ? Number(paiement.montant) : undefined;
      const reste = montantRecu != null ? Number(vente.montantTotal) - montantRecu : undefined;

      await genererFacturePdf({
        numero: vente.id.slice(0, 8).toUpperCase(),
        date: new Date(vente.createdAt),
        pointVenteNom: vente.pointVente.nom,
        villeNom: vente.pointVente.ville?.nom ?? null,
        commercialNom: `${vente.commercial.prenom} ${vente.commercial.nom}`,
        lignes: vente.lignes.map((l) => ({
          produitCode: l.produit.code,
          nbSachets: l.nbSachets,
          nbFilets: l.nbFilets,
          nbCartons: l.nbCartons,
        })),
        montantTotal: Number(vente.montantTotal),
        modePaiementLabel: paiement ? MODE_LABEL[paiement.modePaiement] ?? paiement.modePaiement : undefined,
        montantRecu,
        resteAPayer: reste && reste > 0 ? reste : undefined,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={generer}
      disabled={loading}
      className="flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-600 disabled:opacity-50"
    >
      {loading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
      Facture
    </button>
  );
}
