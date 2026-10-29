import { prisma } from "@/lib/prisma";
import { NOM_CLIENT_DIVERS } from "@/lib/services/client-divers";

export class FusionError extends Error {}

/**
 * Fusionne des points de vente / clients en doublon dans un seul profil.
 * - Toutes les commandes, ventes, visites, photos, prospects… des doublons sont rattachés au profil conservé.
 * - Le stock et la caisse ne sont PAS touchés : mouvements de stock, paiements et opérations de caisse
 *   référencent des commandes / ventes, qui gardent leur identité et leurs montants.
 * - Les champs vides du profil conservé sont complétés avec ceux des doublons ; le nom définitif est appliqué.
 * - Les doublons sont archivés (jamais supprimés) : l'historique reste consultable dans les Archives.
 */
export async function fusionnerClients(opts: { principalId: string; doublonIds: string[]; nom: string }) {
  const nom = opts.nom.trim();
  if (nom.length < 2) throw new FusionError("Le nom définitif est trop court.");
  const doublons = [...new Set(opts.doublonIds)].filter((id) => id !== opts.principalId);
  if (doublons.length === 0) throw new FusionError("Sélectionnez au moins un doublon à fusionner.");

  return prisma.$transaction(
    async (tx) => {
      const tous = await tx.pointVente.findMany({ where: { id: { in: [opts.principalId, ...doublons] } } });
      if (tous.length !== doublons.length + 1) throw new FusionError("Un des points de vente est introuvable.");
      if (tous.some((p) => p.nom === NOM_CLIENT_DIVERS)) throw new FusionError("Le client divers ne peut pas être fusionné.");
      const principal = tous.find((p) => p.id === opts.principalId)!;
      const autres = tous.filter((p) => p.id !== opts.principalId);

      const deplace = { pointVenteId: opts.principalId };
      const where = { pointVenteId: { in: doublons } };
      const [commandes, ventes, visites, photos, prospects, indecis, clients] = await Promise.all([
        tx.commande.updateMany({ where, data: deplace }),
        tx.vente.updateMany({ where, data: deplace }),
        tx.visite.updateMany({ where, data: deplace }),
        tx.photo.updateMany({ where, data: deplace }),
        tx.prospect.updateMany({ where, data: deplace }),
        tx.prospectIndecis.updateMany({ where, data: deplace }),
        tx.client.updateMany({ where, data: deplace }),
      ]);

      // Complète les champs vides du profil conservé avec les données des doublons (le plus ancien d'abord).
      const sources = [...autres].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      const premier = <K extends keyof typeof principal>(k: K) => sources.map((s) => s[k]).find((v) => v != null && v !== "" && !(Array.isArray(v) && v.length === 0));
      const completer = <K extends keyof typeof principal>(k: K) => (principal[k] == null || principal[k] === "" ? premier(k) : undefined);
      const typesIds = [...new Set([...principal.typesIds, ...sources.flatMap((s) => s.typesIds)])];

      await tx.pointVente.update({
        where: { id: principal.id },
        data: {
          nom,
          vendeur: completer("vendeur") as string | undefined,
          telephoneVendeur: completer("telephoneVendeur") as string | undefined,
          telephonePatron: completer("telephonePatron") as string | undefined,
          patronNom: completer("patronNom") as string | undefined,
          repondantRole: completer("repondantRole") as string | undefined,
          repondantFonction: completer("repondantFonction") as string | undefined,
          typeAutre: completer("typeAutre") as string | undefined,
          quartierId: completer("quartierId") as string | undefined,
          repere: completer("repere") as string | undefined,
          typeId: (completer("typeId") as string | undefined) ?? (principal.typeId ? undefined : typesIds[0]),
          typesIds,
          presentoir: principal.presentoir || sources.some((s) => s.presentoir),
          createdAt: sources.some((s) => s.createdAt < principal.createdAt) ? sources[0].createdAt : undefined,
          archivedAt: null,
        },
      });

      // Doublons : archivés, avec trace de la fusion dans le repère.
      for (const d of autres) {
        await tx.pointVente.update({
          where: { id: d.id },
          data: {
            archivedAt: new Date(),
            repere: `${d.repere ? `${d.repere} · ` : ""}Fusionné dans « ${nom} » le ${new Date().toLocaleDateString("fr-FR")}`,
            // Un code client éventuel reste uniquement sur le profil conservé.
            codeClient: null,
          },
        });
      }

      return {
        commandes: commandes.count,
        ventes: ventes.count,
        visites: visites.count,
        photos: photos.count,
        prospects: prospects.count + indecis.count + clients.count,
      };
    },
    { timeout: 30_000 }
  );
}
