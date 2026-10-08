import { NextRequest, NextResponse } from "next/server";
import { aggregateVentesDuJour, aggregerPerformanceBinome } from "@/lib/jobs/aggregate";
import { genererToutesLesAlertes } from "@/lib/jobs/alertes";
import { prisma } from "@/lib/prisma";

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
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  // Si CRON_SECRET n'est pas configuré, on refuse systématiquement plutôt
  // que de comparer à "Bearer undefined" (qu'un attaquant pourrait envoyer
  // littéralement pour contourner la protection).
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
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

    // Alertes générées après l'agrégation, pour pouvoir évaluer les
    // objectifs de la veille à partir des données fraîchement agrégées.
    await genererToutesLesAlertes(hier);

    // Ménage quotidien : sans lui, ces deux tables grossissent sans limite
    // (une ligne par tentative de connexion et par session ouverte) et
    // ralentissent les requêtes qui les consultent à chaque connexion.
    const ilYa30Jours = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [tentativesPurgees, sessionsPurgees] = await Promise.all([
      prisma.loginAttempt.deleteMany({ where: { createdAt: { lt: ilYa30Jours } } }),
      prisma.session.deleteMany({
        where: { OR: [{ expiresAt: { lt: ilYa30Jours } }, { revoked: true, createdAt: { lt: ilYa30Jours } }] },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      resultatVentes,
      resultatBinomes,
      alertes: "generees",
      menage: { tentativesPurgees: tentativesPurgees.count, sessionsPurgees: sessionsPurgees.count },
    });
  } catch (error) {
    console.error("Erreur job agrégation:", error);
    return NextResponse.json({ error: "Échec de l'agrégation." }, { status: 500 });
  }
}
