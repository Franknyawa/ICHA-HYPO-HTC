import { prisma } from "@/lib/prisma";

export async function listAlertes(params: { type?: string }) {
  return prisma.alerte.findMany({
    where: {
      resolue: false,
      ...(params.type ? { type: params.type as any } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function countAlertesActives() {
  return prisma.alerte.count({ where: { resolue: false } });
}
