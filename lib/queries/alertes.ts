import { prisma } from "@/lib/prisma";

// "Actives" = tout ce qui n'est pas encore résolu, y compris les
// déclarations de crédit en attente de vérification par un admin — elles
// restent une action à faire, donc comptent dans le badge et la liste.
export async function listAlertes(params: { type?: string }) {
  return prisma.alerte.findMany({
    where: {
      statut: { not: "RESOLUE" },
      ...(params.type ? { type: params.type as any } : {}),
    },
    include: {
      declareePar: { select: { id: true, nom: true, prenom: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function countAlertesActives() {
  return prisma.alerte.count({ where: { statut: { not: "RESOLUE" } } });
}
