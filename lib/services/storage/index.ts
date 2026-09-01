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
export async function uploadPhoto(dataUrl: string, key: string): Promise<string> {
  const provider = process.env.STORAGE_PROVIDER || "lws";

  if (provider === "r2") {
    return uploadPhotoR2(dataUrl, key);
  }
  return uploadPhotoLws(dataUrl, key);
}
