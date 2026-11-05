import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-errors";
import { avecJournal } from "@/lib/services/journal";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireModule("parametres");
    const binomes = await prisma.binome.findMany({
      orderBy: { nom: "asc" },
      include: { membres: { select: { id: true, nom: true, prenom: true } } },
    });
    return NextResponse.json({ data: binomes });
  } catch (error) {
    return handleApiError(error);
  }
}

const schema = z.object({ nom: z.string().min(1) });

async function POST_(req: NextRequest) {
  try {
    await requireModule("parametres");
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Nom invalide." }, { status: 400 });
    }
    const binome = await prisma.binome.create({ data: { nom: parsed.data.nom } });
    return NextResponse.json(binome, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

export const POST = avecJournal(POST_);
