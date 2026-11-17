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

      // Prix négociés : le client conservé garde les siens ; pour un produit sans prix propre, il reprend ceux d'un doublon.
      const [prixP, paliersP, prixD, paliersD] = await Promise.all([
        tx.prixClient.findMany({ where: { pointVenteId: principal.id } }),
        tx.palierPrixClient.findMany({ where: { pointVenteId: principal.id } }),
        tx.prixClient.findMany({ where: { pointVenteId: { in: autres.map((a) => a.id) } } }),
        tx.palierPrixClient.findMany({ where: { pointVenteId: { in: autres.map((a) => a.id) } } }),
      ]);
      const ordre = new Map(sources.map((x, i) => [x.id, i]));
      const parAnciennete = <T extends { pointVenteId: string }>(l: T[]) => [...l].sort((a, b) => (ordre.get(a.pointVenteId) ?? 0) - (ordre.get(b.pointVenteId) ?? 0));
      const produitsPrincipal = new Set([...prixP.map((x) => x.produitId), ...paliersP.map((x) => x.produitId)]);
      const adoptes = new Map<string, string>(); // produit -> doublon dont on reprend les prix
      for (const x of parAnciennete([...prixD, ...paliersD])) {
        if (!produitsPrincipal.has(x.produitId) && !adoptes.has(x.produitId)) adoptes.set(x.produitId, x.pointVenteId);
      }
      for (const x of prixD) {
        if (adoptes.get(x.produitId) === x.pointVenteId) await tx.prixClient.create({ data: { pointVenteId: principal.id, produitId: x.produitId, prixCarton: x.prixCarton, updatedById: x.updatedById } });
      }
      for (const x of paliersD) {
        if (adoptes.get(x.produitId) === x.pointVenteId) {
          await tx.palierPrixClient.create({ data: { pointVenteId: principal.id, produitId: x.produitId, minCartons: x.minCartons, maxCartons: x.maxCartons, prixCarton: x.prixCarton } });
        }
      }

      // Doublons : archivés, avec trace de la fusion dans le repère.
      for (const d of autres) {
        await tx.pointVente.update({
          where: { id: d.id },
          data: {
            archivedAt: new Date(),
            repere: `${d.repere ? `${d.repere} · ` : ""}Fusionné dans « ${nom} » le ${new Date().toLocaleDateString("fr-FR")}`,
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
