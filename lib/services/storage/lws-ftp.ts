import "server-only";
import { Client } from "basic-ftp";
import { Readable } from "stream";

function decodeDataUrl(dataUrl: string): { buffer: Buffer; contentType: string } {
  const match = dataUrl.match(/^data:(.+);base64,(.*)$/);
  if (!match) throw new Error("Format de photo invalide (data URL attendu).");
  const [, contentType, base64] = match;
  return { buffer: Buffer.from(base64, "base64"), contentType };
}

/**
 * Upload une photo vers l'espace mutualisé LWS via FTP, sous le dossier
 * public du site (ex: public_html/photos). PostgreSQL ne conserve ensuite
 * que l'URL publique résultante, jamais le fichier — §12 doc scalabilité.
 *
 * Choisi à la place d'un stockage S3/R2 : Victor dispose déjà de cet espace
 * chez LWS et préfère l'utiliser plutôt que de dépendre d'un service tiers
 * supplémentaire.
 */
export async function uploadPhotoLws(dataUrl: string, key: string): Promise<string> {
  const host = process.env.LWS_FTP_HOST;
  const user = process.env.LWS_FTP_USER;
  const password = process.env.LWS_FTP_PASSWORD;
  const basePath = process.env.LWS_FTP_BASE_PATH; // ex: /public_html/photos
  const publicUrl = process.env.LWS_PUBLIC_URL; // ex: https://tondomaine.com/photos

  if (!host || !user || !password || !basePath || !publicUrl) {
    throw new Error(
      "Stockage LWS non configuré (LWS_FTP_HOST / LWS_FTP_USER / LWS_FTP_PASSWORD / LWS_FTP_BASE_PATH / LWS_PUBLIC_URL manquants dans .env)."
    );
  }

  const { buffer } = decodeDataUrl(dataUrl);

  const client = new Client();
  client.ftp.verbose = false;

  try {
    await client.access({
      host,
      user,
      password,
      secure: false, // LWS mutualisé : FTP standard, pas FTPS sur la plupart des offres
    });

    // Le chemin de la photo peut contenir des sous-dossiers (ex:
    // photos/<userId>/<uuid>.jpg) — on les crée si besoin, sans planter si
    // le dossier de base a déjà été créé manuellement.
    const fullPath = `${basePath.replace(/\/$/, "")}/${key}`;
    const dir = fullPath.substring(0, fullPath.lastIndexOf("/"));
    const filename = fullPath.split("/").pop()!;

    await client.ensureDir(dir); // crée le dossier ET s'y déplace (cwd)
    await client.uploadFrom(Readable.from(buffer), filename);
  } finally {
    client.close();
  }

  return `${publicUrl.replace(/\/$/, "")}/${key}`;
}
