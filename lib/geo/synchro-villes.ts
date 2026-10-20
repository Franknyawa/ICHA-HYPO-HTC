import { prisma } from "@/lib/prisma";
import { TOUTES_LES_VILLES } from "@/lib/geo/cameroun";

let derniere: Promise<void> | null = null;

/**
 * Garantit que la liste fixe des villes existe en base (avec leur région).
 * Exécuté une seule fois par instance du serveur ; les villes déjà présentes
 * sont conservées (même id), seule leur région est renseignée.
 */
export function assurerVilles(): Promise<void> {
  if (!derniere) {
    derniere = (async () => {
      const existantes = await prisma.ville.findMany({ select: { id: true, nom: true, region: true } });
      const parNom = new Map(existantes.map((v) => [v.nom, v]));
      const aCreer = TOUTES_LES_VILLES.filter((v) => !parNom.has(v.nom));
      if (aCreer.length > 0) {
        await prisma.ville.createMany({
          data: aCreer.map((v) => ({ nom: v.nom, region: v.region })),
          skipDuplicates: true,
        });
      }
      for (const v of TOUTES_LES_VILLES) {
        const e = parNom.get(v.nom);
        if (e && e.region !== v.region) {
          await prisma.ville.update({ where: { id: e.id }, data: { region: v.region } });
        }
      }
    })().catch((e) => {
      derniere = null; // réessaiera à la prochaine requête
      console.error("Synchronisation des villes échouée :", e);
    });
  }
  return derniere;
}

/** Villes triées par nom (la liste fixe est créée au besoin). */
export async function listerVilles() {
  await assurerVilles();
  return prisma.ville.findMany({ orderBy: { nom: "asc" } });
}
