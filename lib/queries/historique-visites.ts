import { prisma } from "@/lib/prisma";
import { getPaginationParams, buildPaginatedResponse } from "@/lib/pagination";

export async function listHistoriqueVisites(commercialId: string, page: number) {
  const sp = new URLSearchParams();
  sp.set("page", String(page));
  const { skip, take, pageSize } = getPaginationParams(sp);

  const [data, total] = await prisma.$transaction([
    prisma.visite.findMany({
      where: { commercialId },
      skip,
      take,
      orderBy: { dateVisite: "desc" },
      include: {
        pointVente: { select: { nom: true, ville: { select: { nom: true } } } },
        photos: { select: { type: true } },
        ventes: { select: { montantTotal: true } },
      },
    }),
    prisma.visite.count({ where: { commercialId } }),
  ]);

  const avecType = data.map((v) => {
    const typesPhotos = v.photos.map((p) => p.type);
    let typeVisite: "recensement" | "rotation" | "reassort" | "autre" = "autre";
    if (typesPhotos.some((t) => t.startsWith("DEVANTURE"))) typeVisite = "recensement";
    else if (typesPhotos.includes("ROTATION_SELFIE")) typeVisite = "rotation";
    else if (v.ventes.length > 0) typeVisite = "reassort";

    return {
      id: v.id,
      dateVisite: v.dateVisite,
      pointVenteNom: v.pointVente.nom,
      villeNom: v.pointVente.ville?.nom ?? null,
      observation: v.observation,
      montantVente: v.ventes.reduce((s, ve) => s + Number(ve.montantTotal), 0),
      typeVisite,
    };
  });

  return buildPaginatedResponse(avecType, total, page, pageSize);
}
