import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";

export const runtime = "nodejs";

function plagesCourantes() {
  const now = new Date();
  const debutJour = new Date(now);
  debutJour.setHours(0, 0, 0, 0);
  const finJour = new Date(now);
  finJour.setHours(23, 59, 59, 999);

  const jourSemaine = (now.getDay() + 6) % 7; // 0 = lundi
  const debutSemaine = new Date(now);
  debutSemaine.setDate(now.getDate() - jourSemaine);
  debutSemaine.setHours(0, 0, 0, 0);
  const finSemaine = new Date(debutSemaine);
  finSemaine.setDate(debutSemaine.getDate() + 6);
  finSemaine.setHours(23, 59, 59, 999);

  return { debutJour, finJour, debutSemaine, finSemaine };
}

// Renvoie, pour chaque binôme, l'objectif journalier et hebdomadaire
// actuellement en vigueur (peut être absent si jamais créé pour cette
// période — pas de job de régénération automatique pour l'instant).
export async function GET() {
  try {
    await requireAdmin();
    const { debutJour, finJour, debutSemaine, finSemaine } = plagesCourantes();

    const binomes = await prisma.binome.findMany({
      orderBy: { nom: "asc" },
      include: {
        objectifs: {
          where: {
            OR: [
              { periode: "JOURNALIER", dateDebut: { lte: finJour }, dateFin: { gte: debutJour } },
              { periode: "HEBDOMADAIRE", dateDebut: { lte: finSemaine }, dateFin: { gte: debutSemaine } },
            ],
          },
        },
      },
    });

    const data = binomes.map((b) => ({
      id: b.id,
      nom: b.nom,
      actif: b.actif,
      objectifJournalier: b.objectifs.find((o) => o.periode === "JOURNALIER") ?? null,
      objectifHebdomadaire: b.objectifs.find((o) => o.periode === "HEBDOMADAIRE") ?? null,
    }));

    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}

const createSchema = z.object({
  binomeId: z.string(),
  periode: z.enum(["JOURNALIER", "HEBDOMADAIRE"]),
  valeurCartons: z.number().int().min(0),
});

// Crée l'objectif de la période en cours pour un binôme qui n'en a pas
// encore (ex: nouveau binôme, ou période jamais initialisée).
export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const parsed = createSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Données invalides." }, { status: 400 });
    }
    const { debutJour, finJour, debutSemaine, finSemaine } = plagesCourantes();
    const { binomeId, periode, valeurCartons } = parsed.data;

    const [dateDebut, dateFin] =
      periode === "JOURNALIER" ? [debutJour, finJour] : [debutSemaine, finSemaine];

    const objectif = await prisma.objectif.create({
      data: { binomeId, periode, valeurCartons, dateDebut, dateFin },
    });

    return NextResponse.json(objectif, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
