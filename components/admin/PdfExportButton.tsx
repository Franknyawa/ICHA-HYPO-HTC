"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import type { RapportLigne } from "@/lib/queries/rapports";

export function PdfExportButton({
  lignes,
  totaux,
  filtreLabel,
}: {
  lignes: RapportLigne[];
  totaux: { nbVentes: number; caTotal: number; cartonsHypo: number; cartonsHtc: number };
  filtreLabel: string;
}) {
  const [generating, setGenerating] = useState(false);

  async function handleExport() {
    setGenerating(true);
    try {
      // Import dynamique — évite d'alourdir le bundle initial de la page
      // avec une librairie PDF qui ne sert qu'au clic sur ce bouton.
      const { default: jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;

      const doc = new jsPDF();

      doc.setFontSize(16);
      doc.setTextColor(30, 64, 175); // bleu marque
      doc.text("HYPO / HTC / ICHA IMPORT", 14, 18);

      doc.setFontSize(11);
      doc.setTextColor(100);
      doc.text("Rapport commercial", 14, 25);
      doc.text(filtreLabel || "Aucun filtre appliqué", 14, 31);
      doc.text(`Généré le ${new Date().toLocaleDateString("fr-FR")}`, 14, 37);

      autoTable(doc, {
        startY: 44,
        head: [["Commercial", "Binôme", "Ventes", "Cartons HYPO", "Cartons HTC", "CA (FCFA)"]],
        body: lignes.map((l) => [
          l.commercialNom,
          l.binomeNom ?? "—",
          String(l.nbVentes),
          String(l.cartonsHypo),
          String(l.cartonsHtc),
          l.caTotal.toLocaleString("fr-FR"),
        ]),
        foot: [
          [
            "TOTAL",
            "",
            String(totaux.nbVentes),
            String(totaux.cartonsHypo),
            String(totaux.cartonsHtc),
            totaux.caTotal.toLocaleString("fr-FR"),
          ],
        ],
        headStyles: { fillColor: [30, 64, 175] },
        footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: "bold" },
        styles: { fontSize: 9 },
      });

      doc.save(`rapport-icha-import-${new Date().toISOString().slice(0, 10)}.pdf`);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={generating}
      className="flex items-center gap-1.5 rounded-xl bg-brand px-3 py-2 text-sm font-semibold text-white disabled:opacity-70"
    >
      {generating ? (
        <>
          <Loader2 size={15} className="animate-spin" />
          Génération...
        </>
      ) : (
        <>
          <Download size={15} />
          Télécharger PDF
        </>
      )}
    </button>
  );
}
