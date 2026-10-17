// Rôles et droits d'accès — fichier sans dépendance serveur : utilisable dans
// le middleware (Edge), les pages serveur, les API et les composants client.

export const ROLES = ["SUPER_ADMIN", "ADMIN", "SUPERVISEUR", "COMMERCIAL"] as const;
export type RoleId = (typeof ROLES)[number];

export const ROLES_PERSONNEL = ["SUPER_ADMIN", "ADMIN", "SUPERVISEUR"] as const;

export type Module =
  | "dashboard"
  | "alertes"
  | "points-vente"
  | "commandes"
  | "stock"
  | "caisse"
  | "objectifs"
  | "factures"
  | "tracking"
  | "clients"
  | "rapports"
  | "archives"
  | "parametres"
  | "utilisateurs";

/** Qui a le droit d'ouvrir chaque rubrique de l'administration. */
export const ACCES: Record<Module, RoleId[]> = {
  dashboard: ["SUPER_ADMIN", "ADMIN"],
  alertes: ["SUPER_ADMIN", "ADMIN", "SUPERVISEUR"],
  "points-vente": ["SUPER_ADMIN", "ADMIN", "SUPERVISEUR"],
  commandes: ["SUPER_ADMIN", "ADMIN", "SUPERVISEUR"],
  stock: ["SUPER_ADMIN", "ADMIN", "SUPERVISEUR"],
  caisse: ["SUPER_ADMIN", "ADMIN"],
  objectifs: ["SUPER_ADMIN", "ADMIN"],
  factures: ["SUPER_ADMIN", "ADMIN"],
  tracking: ["SUPER_ADMIN", "ADMIN"],
  clients: ["SUPER_ADMIN", "ADMIN"],
  rapports: ["SUPER_ADMIN", "ADMIN", "SUPERVISEUR"],
  archives: ["SUPER_ADMIN", "ADMIN"],
  parametres: ["SUPER_ADMIN"],
  utilisateurs: ["SUPER_ADMIN"],
};

export const LIBELLES_ROLES: Record<RoleId, { nom: string; description: string }> = {
  SUPER_ADMIN: { nom: "Super Admin", description: "Gère tout, y compris les utilisateurs et les paramètres." },
  ADMIN: { nom: "Administrateur", description: "Accès à tout sauf les paramètres et les utilisateurs." },
  SUPERVISEUR: { nom: "Superviseur", description: "Alertes, points de vente, commandes, stock et rapports (consultation seule)." },
  COMMERCIAL: { nom: "Commercial", description: "Application mobile terrain uniquement." },
};

export function estPersonnel(role: string | undefined | null): boolean {
  return (ROLES_PERSONNEL as readonly string[]).includes(role ?? "");
}

export function peutAcceder(role: string | undefined | null, module: Module): boolean {
  return (ACCES[module] as string[]).includes(role ?? "");
}

export function modulesAutorises(role: string | undefined | null): Module[] {
  return (Object.keys(ACCES) as Module[]).filter((m) => peutAcceder(role, m));
}

const PAGES: Record<string, Module> = {
  dashboard: "dashboard",
  alertes: "alertes",
  "points-vente": "points-vente",
  commandes: "commandes",
  stock: "stock",
  caisse: "caisse",
  objectifs: "objectifs",
  factures: "factures",
  tracking: "tracking",
  clients: "clients",
  rapports: "rapports",
  archives: "archives",
  parametres: "parametres",
  utilisateurs: "utilisateurs",
};

const API: Record<string, Module> = {
  alertes: "alertes",
  prospects: "points-vente",
  "points-vente": "points-vente",
  commandes: "commandes",
  stock: "stock",
  caisse: "caisse",
  ventes: "factures",
  clients: "clients",
  rapports: "rapports",
  parametres: "parametres",
  users: "utilisateurs",
  sessions: "utilisateurs",
};

/** Rubrique concernée par une adresse (/admin/stock → "stock", /api/caisse/… → "caisse"). */
export function moduleDePath(pathname: string): Module | null {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] === "admin") return PAGES[parts[1] ?? ""] ?? null;
  if (parts[0] === "api") return API[parts[1] ?? ""] ?? null;
  return null;
}

/** Seuls le Super Admin et l'Admin peuvent modifier ; le Superviseur consulte seulement. */
export function peutModifier(role: string | undefined | null): boolean {
  return role === "SUPER_ADMIN" || role === "ADMIN";
}

/** Première page d'un rôle : le tableau de bord, ou la première rubrique autorisée. */
export function pageAccueil(role: string | undefined | null): string {
  if (role === "COMMERCIAL") return "/dashboard";
  const premier = modulesAutorises(role)[0];
  return premier ? `/admin/${premier}` : "/login";
}
