import { prisma } from "@/lib/prisma";
import { NOM_CLIENT_DIVERS } from "@/lib/services/client-divers";

/**
 * Code client : « CLI-0001 », « CLI-0002 »… Attribué une seule fois (à la première
 * validation d'une commande), jamais réutilisé, jamais modifié. Le client divers n'en a pas.
 * Silencieux si la colonne n'existe pas encore (migration SQL non passée).
 */
export async function attribuerCodeClient(pointVenteId: string): Promise<void> {
  try {
    await prisma.$executeRaw`
      UPDATE points_vente
      SET code_client = 'CLI-' || lpad(nextval('code_client_seq')::text, 4, '0')
      WHERE id = ${pointVenteId} AND code_client IS NULL AND nom <> ${NOM_CLIENT_DIVERS}`;
  } catch (e) {
    console.error("attribuerCodeClient", e);
  }
}

/** Attribue un code à tous les clients (au moins une commande validée) qui n'en ont pas, du plus ancien au plus récent. */
export async function attribuerCodesManquants(): Promise<number> {
  const n = await prisma.$executeRaw`
    WITH a_coder AS (
      SELECT p.id
      FROM points_vente p
      WHERE p.code_client IS NULL
        AND p.nom <> ${NOM_CLIENT_DIVERS}
        AND EXISTS (SELECT 1 FROM commandes c WHERE c.point_vente_id = p.id AND c.statut IN ('EN_LIVRAISON','LIVREE'))
      ORDER BY (SELECT MIN(c.validee_at) FROM commandes c WHERE c.point_vente_id = p.id AND c.statut IN ('EN_LIVRAISON','LIVREE')) NULLS LAST, p.created_at
    )
    UPDATE points_vente p
    SET code_client = 'CLI-' || lpad(nextval('code_client_seq')::text, 4, '0')
    FROM a_coder
    WHERE p.id = a_coder.id`;
  return Number(n);
}
