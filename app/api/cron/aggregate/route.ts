import { NextRequest, NextResponse } from "next/server";
import { aggregateVentesDuJour, aggregerPerformanceBinome } from "@/lib/jobs/aggregate";

export const runtime = "nodejs";
export const maxDuration = 60; // agrégation potentiellement longue à grand volume

/**
 * Déclenché quotidiennement par Vercel Cron (voir vercel.json).
 * Protégé par CRON_SECRET — Vercel ajoute automatiquement l'en-tête
 * Authorization: Bearer <CRON_SECRET> sur les appels programmés.
 * Accessible aussi manuellement (ex: rattrapage après incident) en
 * fournissant le même secret.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  try {
    // La journée d'hier : "aujourd'hui" est encore en train de se remplir,
    // pas la peine de l'agréger avant qu'elle soit terminée (le dashboard
    // calcule déjà "aujourd'hui" en direct, sans passer par cette table).
    const hier = new Date();
    hier.setDate(hier.getDate() - 1);

    const resultatVentes = await aggregateVentesDuJour(hier);

    // Le mois en cours est recalculé chaque jour pour rester à jour tout
    // au long du mois (pas seulement le 1er du mois suivant).
    const anneeMois = `${hier.getFullYear()}-${String(hier.getMonth() + 1).padStart(2, "0")}`;
    const resultatBinomes = await aggregerPerformanceBinome(anneeMois);

    return NextResponse.json({ ok: true, resultatVentes, resultatBinomes });
  } catch (error) {
    console.error("Erreur job agrégation:", error);
    return NextResponse.json({ error: "Échec de l'agrégation." }, { status: 500 });
  }
}
