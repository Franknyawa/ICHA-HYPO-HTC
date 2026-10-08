import "server-only";
import { uploadPhotoLws } from "./lws-ftp";
import { uploadPhotoR2 } from "./r2";

/**
 * STORAGE_PROVIDER contrôle où partent les photos :
 * - "lws" (défaut) : espace mutualisé LWS de Victor, via FTP
 * - "r2"            : Cloudflare R2, si un jour préféré (ex: performances,
 *                      limite de bande passante FTP atteinte)
 * Changer de provider ne casse rien pour les photos déjà envoyées — seules
 * les nouvelles suivent le provider actif.
 */
/**
 * Vrai si l'URL est en https ET (quand un domaine public de stockage est
 * configuré) située sous ce domaine. Empêche d'enregistrer en base une URL
 * arbitraire fournie par un client (suivi externe, schéma `javascript:`,
 * etc.) à la place d'une vraie photo uploadée.
 */
export function isTrustedPhotoUrl(url: string): boolean {
  if (!/^https:\/\//i.test(url)) return false;
  const bases = [process.env.LWS_PUBLIC_URL, process.env.STORAGE_PUBLIC_URL]
    .filter((b): b is string => Boolean(b))
    .map((b) => b.replace(/\/$/, "").toLowerCase());
  if (bases.length === 0) return true; // stockage non configuré : https seulement
  const u = url.toLowerCase();
  return bases.some((b) => u === b || u.startsWith(`${b}/`));
}

export async function uploadPhoto(dataUrl: string, key: string): Promise<string> {
  const provider = process.env.STORAGE_PROVIDER || "lws";

  if (provider === "r2") {
    return uploadPhotoR2(dataUrl, key);
  }
  return uploadPhotoLws(dataUrl, key);
}
