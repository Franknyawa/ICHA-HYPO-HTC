import { prisma } from "@/lib/prisma";
import { NOM_CLIENT_DIVERS } from "@/lib/services/client-divers";

export type MembreDoublon = {
  id: string;
  codeClient: string | null;
  nom: string;
  interlocuteur: string | null;
  telephone: string | null;
  ville: string | null;
  quartier: string | null;
  creeLe: string;
  commandesValidees: number;
  commandes: number;
};
export type GroupeDoublon = { raisons: string[]; membres: MembreDoublon[] };

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\b(ets|etablissement|etablissements|boutique|chez|mme|mr|m|sarl|bar|depot|alimentation|superette)\b/g, " ")
    .replace(/[^a-z0-9]/g, "");
const tel = (s?: string | null) => {
  const d = (s ?? "").replace(/\D/g, "");
  return d.length >= 8 ? d.slice(-9) : "";
};
function distance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let min = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      min = Math.min(min, cur[j]);
    }
    if (min > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}
function metres(la1: number, lo1: number, la2: number, lo2: number) {
  const R = 6371000, r = Math.PI / 180;
  const a = Math.sin(((la2 - la1) * r) / 2) ** 2 + Math.cos(la1 * r) * Math.cos(la2 * r) * Math.sin(((lo2 - lo1) * r) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Cherche les points de vente qui sont probablement le même client : même téléphone,
 * même nom (ou nom très proche dans la même ville), ou GPS à moins de 25 m avec un nom proche.
 * Détection seule : rien n'est fusionné ni modifié.
 */
export async function trouverDoublons(): Promise<{ groupes: GroupeDoublon[]; total: number }> {
  const pts = await prisma.pointVente.findMany({
    where: { archivedAt: null, nom: { not: NOM_CLIENT_DIVERS } },
    take: 6000,
    select: {
      id: true,
      codeClient: true,
      nom: true,
      vendeur: true,
      telephoneVendeur: true,
      telephonePatron: true,
      villeId: true,
      latitude: true,
      longitude: true,
      createdAt: true,
      ville: { select: { nom: true } },
      quartier: { select: { nom: true } },
      commandes: { select: { statut: true } },
    },
  });
  const n = pts.length;
  const parent = pts.map((_, i) => i);
  const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  const raisons = new Map<number, Set<string>>();
  const lier = (a: number, b: number, raison: string) => {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent[rb] = ra;
    // les raisons sont rattachées aux deux membres, regroupées ensuite
    for (const i of [a, b]) {
      if (!raisons.has(i)) raisons.set(i, new Set());
      raisons.get(i)!.add(raison);
    }
  };

  const noms = pts.map((p) => norm(p.nom));
  const parTel = new Map<string, number[]>();
  const parNom = new Map<string, number[]>();
  const parVille = new Map<string, number[]>();
  pts.forEach((p, i) => {
    for (const t of new Set([tel(p.telephoneVendeur), tel(p.telephonePatron)])) {
      if (t) parTel.set(t, [...(parTel.get(t) ?? []), i]);
    }
    if (noms[i].length >= 3) parNom.set(`${p.villeId}|${noms[i]}`, [...(parNom.get(`${p.villeId}|${noms[i]}`) ?? []), i]);
    parVille.set(p.villeId, [...(parVille.get(p.villeId) ?? []), i]);
  });
  for (const l of parTel.values()) for (let k = 1; k < l.length; k++) lier(l[0], l[k], "Même téléphone");
  for (const l of parNom.values()) for (let k = 1; k < l.length; k++) lier(l[0], l[k], "Même nom dans la même ville");

  for (const l of parVille.values()) {
    for (let a = 0; a < l.length; a++) {
      for (let b = a + 1; b < l.length; b++) {
        const i = l[a], j = l[b];
        if (find(i) === find(j)) continue;
        const na = noms[i], nb = noms[j];
        if (na.length < 5 || nb.length < 5) continue;
        const d = distance(na, nb, 2);
        if (d <= 2) {
          lier(i, j, "Nom très proche");
          continue;
        }
        const p = pts[i], q = pts[j];
        if (p.latitude != null && q.latitude != null && p.longitude != null && q.longitude != null) {
          if (metres(Number(p.latitude), Number(p.longitude), Number(q.latitude), Number(q.longitude)) < 25 && distance(na, nb, 4) <= 4) {
            lier(i, j, "Même emplacement GPS et nom proche");
          }
        }
      }
    }
  }

  const groupes = new Map<number, number[]>();
  for (let i = 0; i < n; i++) groupes.set(find(i), [...(groupes.get(find(i)) ?? []), i]);
  const sortie: GroupeDoublon[] = [];
  for (const idx of groupes.values()) {
    if (idx.length < 2) continue;
    const r = new Set<string>();
    idx.forEach((i) => raisons.get(i)?.forEach((x) => r.add(x)));
    sortie.push({
      raisons: [...r],
      membres: idx
        .map((i) => {
          const p = pts[i];
          return {
            id: p.id,
            codeClient: p.codeClient,
            nom: p.nom,
            interlocuteur: p.vendeur,
            telephone: p.telephoneVendeur ?? p.telephonePatron,
            ville: p.ville?.nom ?? null,
            quartier: p.quartier?.nom ?? null,
            creeLe: p.createdAt.toISOString(),
            commandesValidees: p.commandes.filter((c) => c.statut === "EN_LIVRAISON" || c.statut === "LIVREE").length,
            commandes: p.commandes.length,
          };
        })
        .sort((a, b) => b.commandesValidees - a.commandesValidees || a.creeLe.localeCompare(b.creeLe)),
    });
  }
  sortie.sort((a, b) => b.membres.length - a.membres.length || a.membres[0].nom.localeCompare(b.membres[0].nom));
  return { groupes: sortie, total: n };
}
