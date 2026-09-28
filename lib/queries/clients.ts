import { prisma } from "@/lib/prisma";

/**
 * Classement des clients par ville, triés par nombre de commandes
 * décroissant au sein de chaque ville — "meilleurs clients" §19/§23 CDC.
 */
export async function getClientsParVille() {
  const clients = await prisma.client.findMany({
    include: {
      pointVente: { select: { nom: true, ville: { select: { id: true, nom: true } } } },
      _count: { select: { commandes: true, ventes: true } },
    },
  });

  const parVille = new Map<
    string,
    {
      villeNom: string;
      clients: {
        id: string;
        nom: string;
        telephone: string | null;
        pointVenteNom: string;
        nbCommandes: number;
        nbVentes: number;
      }[];
    }
  >();

  for (const c of clients) {
    const villeId = c.pointVente.ville?.id ?? "sans-ville";
    const villeNom = c.pointVente.ville?.nom ?? "Ville non renseignée";
    const groupe = parVille.get(villeId) ?? { villeNom, clients: [] };
    groupe.clients.push({
      id: c.id,
      nom: c.nom,
      telephone: c.telephone,
      pointVenteNom: c.pointVente.nom,
      nbCommandes: c._count.commandes,
      nbVentes: c._count.ventes,
    });
    parVille.set(villeId, groupe);
  }

  return [...parVille.values()]
    .map((g) => ({
      ...g,
      clients: g.clients.sort((a, b) => b.nbCommandes - a.nbCommandes),
    }))
    .sort((a, b) => b.clients.length - a.clients.length);
}
