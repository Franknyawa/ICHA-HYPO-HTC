// Télécharge la page admin affichée en PDF (capture de la zone principale, découpée en pages A4).
// Les éléments réservés à l'écran (boutons, filtres : classe `print:hidden`) sont masqués pendant
// la capture, les en-têtes d'impression (`print:block`) sont affichés, et le mode sombre est suspendu.

export async function telechargerPagePdf(nomFichier: string, selecteur?: string) {
  const racine = ((selecteur ? document.querySelector(selecteur) : null) ?? document.querySelector("main") ?? document.querySelector(".admin-vie")) as HTMLElement | null;
  if (!racine) throw new Error("Page introuvable.");

  const html = document.documentElement;
  const etaitSombre = html.classList.contains("dark");
  const masques = Array.from(document.querySelectorAll<HTMLElement>('[class*="print:hidden"], .apercu-no-print'));
  const affiches = Array.from(document.querySelectorAll<HTMLElement>('[class*="print:block"]'));
  const avant = new Map<HTMLElement, string>();
  [...masques, ...affiches].forEach((e) => avant.set(e, e.style.display));

  try {
    if (etaitSombre) html.classList.remove("dark");
    masques.forEach((e) => (e.style.display = "none"));
    affiches.forEach((e) => (e.style.display = "block"));
    await new Promise((r) => requestAnimationFrame(() => r(null)));

    const { default: html2canvas } = await import("html2canvas");
    const { default: JsPDF } = await import("jspdf");
    const canvas = await html2canvas(racine, {
      scale: 1.6,
      backgroundColor: "#ffffff",
      useCORS: true,
      windowWidth: Math.max(racine.scrollWidth, 1100),
    });

    const doc = new JsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const L = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const marge = 8;
    const largeurImg = L - 2 * marge;
    const hauteurImg = (canvas.height * largeurImg) / canvas.width;
    const hauteurPage = H - 2 * marge;
    const pages = Math.max(1, Math.ceil(hauteurImg / hauteurPage));

    for (let p = 0; p < pages; p++) {
      // Tranche de canvas correspondant à la page p.
      const hauteurTranchePx = Math.min(canvas.height - (p * hauteurPage * canvas.width) / largeurImg, (hauteurPage * canvas.width) / largeurImg);
      if (hauteurTranchePx <= 0) break;
      const tranche = document.createElement("canvas");
      tranche.width = canvas.width;
      tranche.height = Math.ceil(hauteurTranchePx);
      const ctx = tranche.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, tranche.width, tranche.height);
      ctx.drawImage(canvas, 0, Math.floor((p * hauteurPage * canvas.width) / largeurImg), canvas.width, tranche.height, 0, 0, canvas.width, tranche.height);
      if (p > 0) doc.addPage();
      doc.addImage(tranche.toDataURL("image/jpeg", 0.92), "JPEG", marge, marge, largeurImg, (tranche.height * largeurImg) / canvas.width);
    }
    const jour = new Date().toISOString().slice(0, 10);
    doc.save(`${nomFichier}-${jour}.pdf`);
  } finally {
    avant.forEach((v, e) => (e.style.display = v));
    if (etaitSombre) html.classList.add("dark");
  }
}
