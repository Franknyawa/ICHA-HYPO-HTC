import { prisma } from "@/lib/prisma";

export type Feuille = {
  nom: string;
  titre: string;
  colonnes: string[];
  /** indices de colonnes numériques (alignées à droite, format milliers) */
  nombres: number[];
  lignes: (string | number | null)[][];
};

const n = (v: unknown) => (v == null ? 0 : Number(v));
const d = (x: Date | null | undefined) =>
  x ? x.toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Douala" }) : "";
const j = (x: Date | null | undefined) =>
  x ? x.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Africa/Douala" }) : "";

/** Toutes les données de l'entreprise, prêtes à être mises en tableaux (Excel / PDF). Aucun mot de passe. */
export async function chargerExport(): Promise<{ feuilles: Feuille[]; resume: [string, string | number][] }> {
  const [pvs, commandes, lignes, ventes, paiements, ops, stocks, mvts, factures, avoirs, retours, users, produits] = await Promise.all([
    prisma.pointVente.findMany({ include: { ville: true, quartier: true, type: true, createdBy: true }, orderBy: { createdAt: "asc" } }),
    prisma.commande.findMany({ include: { pointVente: true, commercial: true }, orderBy: { dateCommande: "asc" } }),
    prisma.commandeLigne.findMany({ include: { produit: true, commande: { include: { pointVente: true } } }, orderBy: { commande: { dateCommande: "asc" } } }),
    prisma.vente.findMany({ include: { pointVente: true, commercial: true }, orderBy: { dateVente: "asc" } }),
    prisma.paiement.findMany({ include: { commande: { include: { pointVente: true } }, vente: { include: { pointVente: true } } }, orderBy: { datePaiement: "asc" } }),
    prisma.operationCaisse.findMany({ orderBy: { dateOperation: "asc" } }),
    prisma.stock.findMany({ include: { produit: true } }),
    prisma.mouvementStock.findMany({ include: { produit: true }, orderBy: { createdAt: "asc" } }),
    prisma.facture.findMany({ orderBy: { numero: "asc" } }),
    prisma.factureAvoir.findMany({ orderBy: { numero: "asc" } }),
    prisma.factureRetour.findMany({ orderBy: { numero: "asc" } }),
    prisma.user.findMany({ orderBy: { nom: "asc" } }),
    prisma.produit.findMany({ orderBy: { code: "asc" } }),
  ]);
  const idPv = new Map(commandes.map((c) => [c.id, c.pointVente.nom]));
  const numFacture = new Map(factures.filter((f) => f.commandeId).map((f) => [f.commandeId!, f.numero]));

  const livrees = commandes.filter((c) => c.statut === "LIVREE");
  const caVal = livrees.reduce((s, c) => s + n(c.montantTotal), 0);
  const encaisse = paiements.reduce((s, p) => s + n(p.montant), 0);
  const rec = ops.filter((o) => o.type === "RECETTE").reduce((s, o) => s + n(o.montant), 0);
  const dep = ops.filter((o) => o.type === "DEPENSE").reduce((s, o) => s + n(o.montant), 0);

  const feuilles: Feuille[] = [
    {
      nom: "Points de vente", titre: "Points de vente / clients",
      colonnes: ["Nom", "Ville", "Quartier", "Repère", "Type", "Contact", "Téléphone", "Patron", "Créé par", "Créé le", "Archivé"],
      nombres: [],
      lignes: pvs.map((p) => [p.nom, p.ville.nom, p.quartier?.nom ?? "", p.repere ?? "", p.type?.nom ?? p.typeAutre ?? "", p.vendeur ?? "", p.telephoneVendeur ?? "", p.patronNom ?? "", `${p.createdBy.prenom} ${p.createdBy.nom}`, j(p.createdAt), p.archivedAt ? "Oui" : ""]),
    },
    {
      nom: "Commandes", titre: "Commandes",
      colonnes: ["Date", "Facture", "Point de vente", "Commercial", "Statut", "Mode paiement", "Montant (FCFA)", "Saisie par", "Antidatée", "Archivée"],
      nombres: [6],
      lignes: commandes.map((c) => [j(c.dateCommande), numFacture.get(c.id) ?? "", c.pointVente.nom, `${c.commercial.prenom} ${c.commercial.nom}`, c.statut, c.modePaiement ?? "", n(c.montantTotal), c.saisiePar ?? "", c.antidatee ? "Oui" : "", c.archivedAt ? "Oui" : ""]),
    },
    {
      nom: "Lignes de commandes", titre: "Détail des commandes",
      colonnes: ["Date", "Point de vente", "Produit", "Cartons", "Filets", "Sachets", "Montant (FCFA)", "Détail"],
      nombres: [3, 4, 5, 6],
      lignes: lignes.map((l) => [j(l.commande.dateCommande), l.commande.pointVente.nom, l.produit.code, l.nbCartons, l.nbFilets, l.nbSachets, n(l.montant), l.detail ? "Oui" : ""]),
    },
    {
      nom: "Ventes terrain", titre: "Ventes terrain",
      colonnes: ["Date", "Point de vente", "Commercial", "Mode annoncé", "Montant annoncé", "Total (FCFA)", "Lieu"],
      nombres: [4, 5],
      lignes: ventes.map((v) => [d(v.dateVente), v.pointVente.nom, `${v.commercial.prenom} ${v.commercial.nom}`, v.modePaiement ?? "", v.montantAnnonce == null ? null : n(v.montantAnnonce), n(v.montantTotal), v.lieu ?? ""]),
    },
    {
      nom: "Paiements", titre: "Paiements encaissés",
      colonnes: ["Date", "Point de vente", "Mode", "Crédit", "Montant (FCFA)"],
      nombres: [4],
      lignes: paiements.map((p) => [d(p.datePaiement), p.commande?.pointVente.nom ?? p.vente?.pointVente.nom ?? (p.commandeId ? idPv.get(p.commandeId) ?? "" : ""), p.modePaiement, p.estCredit ? "Oui" : "", n(p.montant)]),
    },
    {
      nom: "Caisse", titre: "Opérations de caisse",
      colonnes: ["Date", "Type", "Canal", "Catégorie", "Note", "Montant (FCFA)"],
      nombres: [5],
      lignes: ops.map((o) => [d(o.dateOperation), o.type === "RECETTE" ? "Recette" : "Dépense", o.canal, o.categorie ?? "", o.note ?? "", n(o.montant)]),
    },
    {
      nom: "Stock", titre: "Stock actuel",
      colonnes: ["Produit", "Sachets en stock", "Seuil d'alerte"],
      nombres: [1, 2],
      lignes: stocks.map((s) => [`${s.produit.code} — ${s.produit.nom}`, s.quantiteSachets, s.seuilAlerte]),
    },
    {
      nom: "Mouvements de stock", titre: "Mouvements de stock",
      colonnes: ["Date", "Produit", "Type", "Sachets", "Référence", "Note"],
      nombres: [3],
      lignes: mvts.map((m) => [d(m.createdAt), m.produit.code, m.type === "ENTREE" ? "Entrée" : "Sortie", m.quantiteSachets, m.referenceType ?? "", m.note ?? ""]),
    },
    {
      nom: "Avoirs et retours", titre: "Avoirs et retours",
      colonnes: ["Type", "Numéro", "Date", "Point de vente", "Motif", "Montant (FCFA)"],
      nombres: [5],
      lignes: [
        ...avoirs.map((a) => ["Avoir", a.numero, j(a.createdAt), idPv.get(a.commandeId) ?? "", a.motif, n(a.montant)]),
        ...retours.map((r) => ["Retour", r.numero, j(r.createdAt), idPv.get(r.commandeId) ?? "", r.motif, n(r.montant)]),
      ],
    },
    {
      nom: "Utilisateurs", titre: "Utilisateurs",
      colonnes: ["Nom", "Identifiant", "Rôle", "Téléphone", "Actif", "Créé le"],
      nombres: [],
      lignes: users.map((u) => [`${u.prenom} ${u.nom}`, u.username, u.role, u.telephone ?? "", u.actif ? "Oui" : "Non", j(u.createdAt)]),
    },
  ];

  const resume: [string, string | number][] = [
    ["Date de l'export", d(new Date())],
    ["Points de vente", pvs.length],
    ["Commandes (total)", commandes.length],
    ["Commandes livrées", livrees.length],
    ["Chiffre d'affaires livré (FCFA)", caVal],
    ["Paiements encaissés (FCFA)", encaisse],
    ["Autres recettes de caisse (FCFA)", rec],
    ["Dépenses de caisse (FCFA)", dep],
    ["Produits au catalogue", produits.length],
    ["Utilisateurs", users.length],
  ];
  return { feuilles, resume };
}
