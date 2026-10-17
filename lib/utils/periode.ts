// Périodes de la caisse et du tableau de bord. Les journées sont celles du
// Cameroun (UTC+1, sans changement d'heure), quel que soit le fuseau du serveur.

const DECALAGE_MS = 60 * 60 * 1000;

export type PeriodeId = "aujourdhui" | "hier" | "7j" | "30j" | "tout" | "perso";

export const PERIODES_CAISSE: { id: PeriodeId; label: string }[] = [
  { id: "aujourdhui", label: "Aujourd'hui" },
  { id: "hier", label: "Hier" },
  { id: "7j", label: "7 derniers jours" },
  { id: "30j", label: "30 derniers jours" },
  { id: "tout", label: "Tout" },
];

/** Date du jour (AAAA-MM-JJ) à Douala. */
export function jourDouala(d: Date = new Date()): string {
  return new Date(d.getTime() + DECALAGE_MS).toISOString().slice(0, 10);
}

/** Début de journée Douala (00:00 locale) en instant UTC. */
export function debutJour(jour: string): Date {
  return new Date(new Date(`${jour}T00:00:00.000Z`).getTime() - DECALAGE_MS);
}

export function finJour(jour: string): Date {
  return new Date(debutJour(jour).getTime() + 24 * 60 * 60 * 1000 - 1);
}

export function ajouterJours(jour: string, n: number): string {
  return new Date(new Date(`${jour}T00:00:00.000Z`).getTime() + n * 86400000).toISOString().slice(0, 10);
}

const FORMAT_JOUR = /^\d{4}-\d{2}-\d{2}$/;

export function resoudrePeriode(params: { periode?: string; du?: string; au?: string }): {
  id: PeriodeId;
  du: string | null;
  au: string | null;
  debut: Date | null;
  fin: Date | null;
  libelle: string;
} {
  const aujourdhui = jourDouala();
  let id = (params.periode as PeriodeId) || "aujourdhui";
  let du: string | null = null;
  let au: string | null = null;

  if (params.du && FORMAT_JOUR.test(params.du)) {
    id = "perso";
    du = params.du;
    au = params.au && FORMAT_JOUR.test(params.au) ? params.au : params.du;
    if (au < du) [du, au] = [au, du];
  } else if (id === "hier") {
    du = au = ajouterJours(aujourdhui, -1);
  } else if (id === "7j") {
    du = ajouterJours(aujourdhui, -6);
    au = aujourdhui;
  } else if (id === "30j") {
    du = ajouterJours(aujourdhui, -29);
    au = aujourdhui;
  } else if (id === "tout") {
    du = au = null;
  } else {
    id = "aujourdhui";
    du = au = aujourdhui;
  }

  const fmt = (j: string) => new Date(`${j}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const libelle =
    du === null ? "Depuis le début" : du === au ? fmt(du) : `Du ${fmt(du)} au ${fmt(au!)}`;

  return {
    id,
    du,
    au,
    debut: du ? debutJour(du) : null,
    fin: au ? finJour(au) : null,
    libelle,
  };
}
