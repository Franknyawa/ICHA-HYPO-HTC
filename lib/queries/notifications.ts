import { prisma } from "@/lib/prisma";

/**
 * Notifications d'un commercial (ex: sa commande est passée "en cours de
 * livraison" après validation admin). Les 20 plus récentes suffisent pour
 * un panneau de type cloche — pas de pagination pour l'instant.
 */
export async function getNotificationsCommercial(userId: string) {
  const [items, nonLues] = await prisma.$transaction([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, message: true, lu: true, createdAt: true },
    }),
    prisma.notification.count({ where: { userId, lu: false } }),
  ]);

  return { items, nonLues };
}
