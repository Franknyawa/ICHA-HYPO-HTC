import "server-only";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

function getClient() {
  const endpoint = process.env.STORAGE_ENDPOINT;
  const accessKeyId = process.env.STORAGE_ACCESS_KEY;
  const secretAccessKey = process.env.STORAGE_SECRET_KEY;

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "Stockage objet non configuré (STORAGE_ENDPOINT / STORAGE_ACCESS_KEY / STORAGE_SECRET_KEY manquants dans .env)."
    );
  }

  return new S3Client({
    region: "auto", // R2 ignore la région, mais le SDK S3 l'exige
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  });
}

/**
 * Décode un data URL (base64) en Buffer + type MIME, sans dépendance
 * externe.
 */
function decodeDataUrl(dataUrl: string): { buffer: Buffer; contentType: string } {
  const match = dataUrl.match(/^data:(.+);base64,(.*)$/);
  if (!match) throw new Error("Format de photo invalide (data URL attendu).");
  const [, contentType, base64] = match;
  return { buffer: Buffer.from(base64, "base64"), contentType };
}

/**
 * Upload une photo (reçue en data URL depuis le navigateur, déjà compressée
 * côté client) vers le stockage objet, et renvoie son URL publique.
 * PostgreSQL ne conserve ensuite que cette URL, jamais le fichier — §12
 * doc scalabilité.
 */
export async function uploadPhotoR2(dataUrl: string, key: string): Promise<string> {
  const bucket = process.env.STORAGE_BUCKET;
  const publicUrl = process.env.STORAGE_PUBLIC_URL;

  if (!bucket || !publicUrl) {
    throw new Error(
      "Stockage objet non configuré (STORAGE_BUCKET / STORAGE_PUBLIC_URL manquants dans .env)."
    );
  }

  const { buffer, contentType } = decodeDataUrl(dataUrl);
  const client = getClient();

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );

  return `${publicUrl.replace(/\/$/, "")}/${key}`;
}
