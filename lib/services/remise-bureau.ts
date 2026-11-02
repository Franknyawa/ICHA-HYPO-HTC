import { prisma } from "@/lib/prisma";

const CLE = "remise_personnel_bureau_pct";
export const REMISE_BUREAU_DEFAUT = 20; // 100 F → 80 F le sachet

/** Remise (%) du tarif « personnel du bureau » sur la vente au détail. */
export async function getRemiseBureauPct(): Promise<number> {
  const p = await prisma.parametreSysteme.findUnique({ where: { cle: CLE } });
  const n = p ? Number(p.valeur) : NaN;
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : REMISE_BUREAU_DEFAUT;
}

export async function setRemiseBureauPct(pct: number) {
  await prisma.parametreSysteme.upsert({ where: { cle: CLE }, update: { valeur: String(pct) }, create: { cle: CLE, valeur: String(pct) } });
}
