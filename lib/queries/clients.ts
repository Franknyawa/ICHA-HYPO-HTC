import { prisma } from "@/lib/prisma";

/**
 * Fiche client détaillée pour le back office : coordonnées, point de
 * vente, historique ventes/commandes récentes et crédits en cours (même
 * logique de calcul que lib/queries/credits.ts, mais par client plutôt
 * que par commercial).
 */
export async function getClientDetail(id: string) {
  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      pointVente: {
        select: {
          id: true,
          nom: true,
          vendeur: true,
          ville: { select: { nom: true } },
          quartier: { select: { nom: true } },
          type: { select: { nom: true } },
        },
      },
      ventes: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          montantTotal: true,
          createdAt: true,
          commercial: { select: { nom: true, prenom: true } },
          paiements: { select: { montant: true, modePaiement: true, estCredit: true } },
        },
      },
      commandes: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          statut: true,
          dateCommande: true,
          dateLivraisonPrevue: true,
        },
      },
    },
  });
  if (!client) return null;

  const ventesAvecCredit = client.ventes.map((v) => {
    const paye = v.paiements.reduce((s, p) => s + Number(p.montant), 0);
    return { ...v, montantTotal: Number(v.montantTotal), montantPaye: paye, montantDu: Number(v.montantTotal) - paye };
  });
  const creditTotal = ventesAvecCredit.reduce((s, v) => s + Math.max(0, v.montantDu), 0);

  return {
    id: client.id,
    nom: client.nom,
    telephone: client.telephone,
    statut: client.statut,
    createdAt: client.createdAt,
    pointVente: client.pointVente,
    ventes: ventesAvecCredit,
    commandes: client.commandes,
    creditTotal,
  };
}

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
