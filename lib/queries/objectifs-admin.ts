import { prisma } from "@/lib/prisma";
import { getStatsBinome, getStatsPersonnelles } from "@/lib/queries/commercial-stats";

export async function getProgressionBinomes() {
  const binomes = await prisma.binome.findMany({
    where: { actif: true },
    orderBy: { nom: "asc" },
  });

  return Promise.all(
    binomes.map(async (b) => ({
      id: b.id,
      nom: b.nom,
      ...(await getStatsBinome(b.id)),
    }))
  );
}

export async function getProgressionCommerciaux() {
  const commerciaux = await prisma.user.findMany({
    where: { role: "COMMERCIAL", actif: true },
    orderBy: { nom: "asc" },
    include: { binome: { select: { nom: true } } },
  });

  return Promise.all(
    commerciaux.map(async (c) => ({
      id: c.id,
      nom: `${c.prenom} ${c.nom}`,
      binomeNom: c.binome?.nom ?? null,
      ...(await getStatsPersonnelles(c.id)),
    }))
  );
}
