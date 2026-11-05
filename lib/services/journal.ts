import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";

/**
 * Journal des modifications : qui a fait quoi, quand. Enregistré APRÈS chaque action réussie
 * (jamais bloquant : une erreur d'écriture du journal ne casse pas l'action). Lecture : super admin seulement.
 */

type Regle = [methode: string, chemin: RegExp, action: string, libelle: string, entite: string];

const REGLES: Regle[] = [
  ["POST", /^\/api\/commandes$/, "COMMANDE_CREEE", "Commande saisie au bureau", "COMMANDE"],
  ["PATCH", /^\/api\/commandes\/[^/]+$/, "COMMANDE_STATUT", "Statut ou date de livraison d'une commande", "COMMANDE"],
  ["PUT", /^\/api\/commandes\/[^/]+$/, "COMMANDE_MODIFIEE", "Commande modifiée", "COMMANDE"],
  ["PATCH", /^\/api\/commandes\/[^/]+\/mode-paiement$/, "COMMANDE_PAIEMENT", "Mode de paiement d'une commande", "COMMANDE"],
  ["POST", /^\/api\/commandes\/[^/]+\/archiver$/, "COMMANDE_ARCHIVEE", "Commande archivée / restaurée", "COMMANDE"],
  ["POST", /^\/api\/commandes\/[^/]+\/annuler-doublon$/, "COMMANDE_DOUBLON", "Commande annulée comme doublon", "COMMANDE"],
  ["POST", /^\/api\/commandes\/archiver-anciennes$/, "COMMANDES_ARCHIVEES", "Archivage des anciennes commandes", "COMMANDE"],
  ["PATCH", /^\/api\/ventes\/[^/]+\/mode-paiement$/, "VENTE_PAIEMENT", "Mode de paiement d'une vente", "VENTE"],
  ["POST", /^\/api\/caisse\/encaisser$/, "CAISSE_ENCAISSEMENT", "Encaissement", "CAISSE"],
  ["POST", /^\/api\/caisse\/operations$/, "CAISSE_OPERATION", "Opération de caisse (recette / dépense)", "CAISSE"],
  ["DELETE", /^\/api\/caisse\/operations\/[^/]+$/, "CAISSE_OPERATION_SUPPRIMEE", "Opération de caisse supprimée", "CAISSE"],
  ["POST", /^\/api\/caisse\/transferts$/, "CAISSE_TRANSFERT", "Transfert entre comptes de caisse", "CAISSE"],
  ["POST", /^\/api\/credits\/[^/]+\/declarer-regle$/, "CREDIT_REGLE", "Créance déclarée réglée", "CAISSE"],
  ["POST", /^\/api\/facturation\/avoirs$/, "AVOIR_CREE", "Facture d'avoir", "COMMANDE"],
  ["POST", /^\/api\/facturation\/retours$/, "RETOUR_CREE", "Facture de retour", "COMMANDE"],
  ["POST", /^\/api\/clients$/, "CLIENT_CREE", "Client créé", "CLIENT"],
  ["PATCH", /^\/api\/clients\/[^/]+$/, "CLIENT_MODIFIE", "Client modifié", "CLIENT"],
  ["POST", /^\/api\/points-vente$/, "PV_CREE", "Point de vente créé", "POINT_VENTE"],
  ["PATCH", /^\/api\/points-vente\/[^/]+$/, "PV_MODIFIE", "Point de vente modifié", "POINT_VENTE"],
  ["POST", /^\/api\/points-vente\/[^/]+\/archiver$/, "PV_ARCHIVE", "Point de vente archivé / restauré", "POINT_VENTE"],
  ["POST", /^\/api\/points-vente\/fusion$/, "PV_FUSION", "Fusion de clients en doublon", "POINT_VENTE"],
  ["POST", /^\/api\/stock\/[^/]+\/ajuster$/, "STOCK_AJUSTE", "Mouvement / ajustement de stock", "STOCK"],
  ["PATCH", /^\/api\/stock\/[^/]+\/seuil$/, "STOCK_SEUIL", "Seuil d'alerte de stock", "STOCK"],
  ["POST", /^\/api\/users$/, "UTILISATEUR_CREE", "Utilisateur créé", "UTILISATEUR"],
  ["PATCH", /^\/api\/users\/[^/]+$/, "UTILISATEUR_MODIFIE", "Utilisateur modifié", "UTILISATEUR"],
  ["DELETE", /^\/api\/users\/[^/]+$/, "UTILISATEUR_SUPPRIME", "Utilisateur supprimé", "UTILISATEUR"],
  ["PATCH", /^\/api\/users\/[^/]+\/password$/, "UTILISATEUR_MOT_DE_PASSE", "Mot de passe réinitialisé", "UTILISATEUR"],
  ["DELETE", /^\/api\/users\/[^/]+\/sessions$/, "UTILISATEUR_SESSIONS", "Sessions d'un utilisateur fermées", "UTILISATEUR"],
  ["DELETE", /^\/api\/sessions\/[^/]+$/, "SESSION_FERMEE", "Session fermée", "UTILISATEUR"],
  ["POST", /^\/api\/auth\/change-password$/, "MOT_DE_PASSE_CHANGE", "Mot de passe changé", "UTILISATEUR"],
  ["POST", /^\/api\/parametres\/produits$/, "PRODUIT_CREE", "Produit créé", "PARAMETRE"],
  ["PATCH", /^\/api\/parametres\/produits\/[^/]+$/, "PRODUIT_MODIFIE", "Produit / prix modifié", "PARAMETRE"],
  ["DELETE", /^\/api\/parametres\/produits\/[^/]+$/, "PRODUIT_SUPPRIME", "Produit supprimé", "PARAMETRE"],
  ["POST", /^\/api\/parametres\/prix-par-type$/, "PRIX_TYPE", "Prix par type de boutique", "PARAMETRE"],
  ["DELETE", /^\/api\/parametres\/prix-par-type\/[^/]+$/, "PRIX_TYPE_SUPPRIME", "Prix par type supprimé", "PARAMETRE"],
  ["PUT", /^\/api\/parametres\/paliers\/[^/]+$/, "PALIERS", "Grille de prix par quantité", "PARAMETRE"],
  ["PATCH", /^\/api\/parametres\/remise-bureau$/, "REMISE_BUREAU", "Remise du tarif personnel du bureau", "PARAMETRE"],
  ["PATCH", /^\/api\/parametres\/session-duree$/, "SESSION_DUREE", "Durée de session", "PARAMETRE"],
  ["PATCH", /^\/api\/parametres\/alertes-seuils$/, "ALERTES_SEUILS", "Seuils d'alertes", "PARAMETRE"],
  ["POST", /^\/api\/parametres\/recalculer-prix$/, "PRIX_RECALCULES", "Recalcul des prix", "PARAMETRE"],
  ["PATCH", /^\/api\/parametres\/objectifs-individuels$/, "OBJECTIFS", "Objectifs individuels", "PARAMETRE"],
  ["PUT", /^\/api\/parametres\/objectifs-territoire$/, "OBJECTIFS", "Objectifs par territoire", "PARAMETRE"],
];
const PARAM_GENERIQUE: [RegExp, string][] = [
  [/^\/api\/parametres\/villes/, "Ville"],
  [/^\/api\/parametres\/types/, "Type de boutique"],
  [/^\/api\/parametres\/quartiers/, "Quartier"],
  [/^\/api\/parametres\/binomes/, "Binôme"],
  [/^\/api\/parametres\/agents-facturation/, "Agent de facturation"],
  [/^\/api\/parametres\/objectifs/, "Objectif"],
];
const VERBE: Record<string, string> = { POST: "ajouté / fusionné", PATCH: "modifié", PUT: "modifié", DELETE: "supprimé" };

export function decrire(methode: string, chemin: string) {
  for (const [m, re, action, libelle, entite] of REGLES) if (m === methode && re.test(chemin)) return { action, libelle, entite };
  for (const [re, nom] of PARAM_GENERIQUE) if (re.test(chemin)) return { action: "PARAMETRE_" + nom.toUpperCase().replace(/[^A-Z]/g, "_"), libelle: `${nom} ${VERBE[methode] ?? "modifié"}`, entite: "PARAMETRE" };
  return { action: `${methode}_${chemin}`, libelle: `${methode} ${chemin}`, entite: "AUTRE" };
}

const SECRET = /pass|mot.?de.?passe|pin|token|secret|hash/i;

function nettoyer(v: unknown, profondeur = 0): unknown {
  if (v == null || typeof v !== "object") return typeof v === "string" && v.length > 300 ? v.slice(0, 300) + "…" : v;
  if (profondeur > 3) return "…";
  if (Array.isArray(v)) return v.slice(0, 30).map((x) => nettoyer(x, profondeur + 1));
  const out: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) out[k] = SECRET.test(k) ? "***" : nettoyer(val, profondeur + 1);
  return out;
}

/** « statut : LIVREE · montant : 5 000 » : les champs simples de la requête, lisibles d'un coup d'œil. */
function resumer(corps: unknown): string | null {
  if (!corps || typeof corps !== "object" || Array.isArray(corps)) return null;
  const parts: string[] = [];
  for (const [k, v] of Object.entries(corps as Record<string, unknown>)) {
    if (SECRET.test(k) || v == null || typeof v === "object") continue;
    parts.push(`${k} : ${String(v).slice(0, 60)}`);
    if (parts.length >= 6) break;
  }
  return parts.length ? parts.join(" · ") : null;
}

type Entree = {
  userId?: string | null;
  userNom: string;
  role: string;
  action: string;
  libelle: string;
  entiteType?: string | null;
  entiteId?: string | null;
  resume?: string | null;
  details?: unknown;
  methode: string;
  chemin: string;
};

export async function journaliser(e: Entree) {
  try {
    await prisma.journalModification.create({
      data: {
        userId: e.userId ?? null,
        userNom: e.userNom,
        role: e.role,
        action: e.action,
        libelle: e.libelle,
        entiteType: e.entiteType ?? null,
        entiteId: e.entiteId ?? null,
        resume: e.resume ?? null,
        details: e.details === undefined ? undefined : (nettoyer(e.details) as object),
        methode: e.methode,
        chemin: e.chemin,
      },
    });
  } catch (err) {
    console.error("Journal des modifications : écriture impossible", err);
  }
}

/** Enveloppe une route d'écriture : si elle réussit, l'action est inscrite au journal. */
export function avecJournal<A extends unknown[]>(handler: (req: NextRequest, ...a: A) => Promise<Response>) {
  return async (req: NextRequest, ...a: A): Promise<Response> => {
    const session = await getSession().catch(() => null);
    let corps: unknown = null;
    if (req.method !== "DELETE" && (req.headers.get("content-type") ?? "").includes("application/json")) {
      corps = await req.clone().json().catch(() => null);
    }
    const res = await handler(req, ...a);
    if (res.status < 400 && session) {
      const chemin = req.nextUrl.pathname;
      const d = decrire(req.method, chemin);
      const ctx = a[0] as { params?: Record<string, string> } | undefined;
      let entiteId = ctx?.params ? Object.values(ctx.params)[0] : undefined;
      if (!entiteId && (res.headers.get("content-type") ?? "").includes("json")) {
        const r = (await res.clone().json().catch(() => null)) as { id?: unknown } | null;
        if (r && typeof r.id === "string") entiteId = r.id;
      }
      await journaliser({
        userId: session.userId,
        userNom: [session.prenom, session.nom].filter(Boolean).join(" ") || "—",
        role: session.role,
        action: d.action,
        libelle: d.libelle,
        entiteType: d.entite,
        entiteId,
        resume: resumer(corps),
        details: corps ?? undefined,
        methode: req.method,
        chemin,
      });
    }
    return res;
  };
}
