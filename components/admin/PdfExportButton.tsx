"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";

// Bouton d'export PDF générique — réutilisé par les 5 vues de la page
// Rapports (commercial / point de vente / ville / quartier / vente).
// Colonnes et lignes sont déjà formatées en texte par l'appelant, ce
// composant ne fait que la mise en page jsPDF.
export function PdfExportButton({
  titre,
  filtreLabel,
  colonnes,
  lignes,
  ligneTotal,
}: {
  titre: string;
  filtreLabel: string;
  colonnes: string[];
  lignes: string[][];
  ligneTotal?: string[];
}) {
  const [generating, setGenerating] = useState(false);

  async function handleExport() {
    setGenerating(true);
    try {
      // Import dynamique — évite d'alourdir le bundle initial de la page
      // avec une librairie PDF qui ne sert qu'au clic sur ce bouton.
      const { default: jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;

      // Paysage dès que le tableau a beaucoup de colonnes (ex : détail
      // par vente), pour éviter les colonnes trop écrasées.
      const doc = new jsPDF(colonnes.length > 5 ? { orientation: "landscape" } : undefined);
      const largeur = doc.internal.pageSize.getWidth();

      doc.setFontSize(16);
      doc.setTextColor(30, 64, 175); // bleu marque
      doc.text("HYPO / HTC / ICHA IMPORT", 14, 18);

      doc.setFontSize(11);
      doc.setTextColor(100);
      doc.text(titre, 14, 25);
      doc.text(filtreLabel || "Aucun filtre appliqué", 14, 31, { maxWidth: largeur - 28 });
      doc.text(`Généré le ${new Date().toLocaleDateString("fr-FR")}`, 14, 37);

      autoTable(doc, {
        startY: 44,
        head: [colonnes],
        body: lignes,
        foot: ligneTotal ? [ligneTotal] : undefined,
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
          PDF
        </>
      )}
    </button>
  );
}
