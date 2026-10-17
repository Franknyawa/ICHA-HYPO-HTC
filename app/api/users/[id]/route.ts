import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/auth/rbac";
import { ROLES } from "@/lib/auth/permissions";
import { handleApiError } from "@/lib/api-errors";
import { revoquerSessionsUtilisateur } from "@/lib/auth/session";
import { isTrustedPhotoUrl } from "@/lib/services/storage";

export const runtime = "nodejs";

/** Vrai si, sans cet utilisateur, plus aucun administrateur actif ne resterait. */
async function dernierAdminActif(userId: string) {
  const autres = await prisma.user.count({ where: { role: "SUPER_ADMIN", actif: true, id: { not: userId } } });
  return autres === 0;
}

const updateUserSchema = z.object({
  nom: z.string().min(1).optional(),
  prenom: z.string().min(1).optional(),
  role: z.enum(ROLES).optional(),
  binomeId: z.string().optional().nullable(),
  actif: z.boolean().optional(),
  avatarUrl: z.string().url().refine(isTrustedPhotoUrl, "URL non autorisée.").optional().nullable(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await requireModule("utilisateurs");

    const json = await req.json().catch(() => null);
    const parsed = updateUserSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Données invalides." }, { status: 400 });
    }

    const data = parsed.data;

    // Garde-fou : un admin ne peut pas se désactiver ni se rétrograder
    // lui-même (risque de verrouiller définitivement la gestion des utilisateurs).
    if (
      params.id === admin.userId &&
      (data.actif === false || (data.role && data.role !== "SUPER_ADMIN"))
    ) {
      return NextResponse.json(
        { error: "Tu ne peux pas désactiver ou rétrograder ton propre compte." },
        { status: 400 }
      );
    }

    const avant = await prisma.user.findUnique({
      where: { id: params.id },
      select: { role: true, actif: true },
    });

    // Garde-fou : il doit toujours rester au moins un administrateur actif.
    if (
      avant?.role === "SUPER_ADMIN" &&
      avant.actif &&
      (data.actif === false || (data.role && data.role !== "SUPER_ADMIN")) &&
      (await dernierAdminActif(params.id))
    ) {
      return NextResponse.json({ error: "Il doit rester au moins un Super Admin actif." }, { status: 400 });
    }

    const user = await prisma.user.update({
      where: { id: params.id },
      data: {
        ...data,
        // Un admin n'a pas de binôme — évite une incohérence si le rôle
        // change de COMMERCIAL vers ADMIN sans qu'on y pense côté client.
        ...(data.role && data.role !== "COMMERCIAL" ? { binomeId: null } : {}),
      },
      select: {
        id: true,
        username: true,
        nom: true,
        prenom: true,
        role: true,
        actif: true,
        avatarUrl: true,
        binome: { select: { id: true, nom: true } },
      },
    });

    // Désactivation ou changement de rôle : les connexions en cours ne
    // doivent pas survivre à la décision (sinon elles gardent leurs
    // anciens droits jusqu'à expiration).
    if (data.actif === false || (data.role !== undefined && data.role !== avant?.role)) {
      await revoquerSessionsUtilisateur(params.id);
    }

    return NextResponse.json(user);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await requireModule("utilisateurs");
    const definitif = req.nextUrl.searchParams.get("definitif") === "1";

    if (params.id === admin.userId) {
      return NextResponse.json(
        { error: definitif ? "Tu ne peux pas supprimer ton propre compte." : "Tu ne peux pas désactiver ton propre compte." },
        { status: 400 }
      );
    }

    const cible = await prisma.user.findUnique({
      where: { id: params.id },
      select: { role: true, actif: true, prenom: true, nom: true },
    });
    if (!cible) return NextResponse.json({ error: "Utilisateur introuvable." }, { status: 404 });

    if (cible.role === "SUPER_ADMIN" && cible.actif && (await dernierAdminActif(params.id))) {
      return NextResponse.json({ error: "Il doit rester au moins un Super Admin actif." }, { status: 400 });
    }

    if (!definitif) {
      // Désactivation : ne peut plus se connecter, historique intact.
      const user = await prisma.user.update({
        where: { id: params.id },
        data: { actif: false },
        select: { id: true, username: true },
      });
      await revoquerSessionsUtilisateur(params.id);
      return NextResponse.json({ ok: true, user });
    }

    // Suppression définitive : uniquement si le compte n'a aucune activité
    // enregistrée (sinon on casserait l'historique des visites, ventes...).
    const [visites, ventes, commandes, pointsVente, photos] = await Promise.all([
      prisma.visite.count({ where: { commercialId: params.id } }),
      prisma.vente.count({ where: { commercialId: params.id } }),
      prisma.commande.count({ where: { commercialId: params.id } }),
      prisma.pointVente.count({ where: { createdById: params.id } }),
      prisma.photo.count({ where: { uploadedById: params.id } }),
    ]);
    if (visites + ventes + commandes + pointsVente + photos > 0) {
      return NextResponse.json(
        {
          error:
            `${cible.prenom} ${cible.nom} a déjà de l'activité (${visites} visite(s), ${ventes} vente(s), ${commandes} commande(s), ${pointsVente} point(s) de vente). ` +
            "Pour garder l'historique, désactive le compte (archivage) au lieu de le supprimer.",
        },
        { status: 409 }
      );
    }

    await prisma.$transaction([
      prisma.session.deleteMany({ where: { userId: params.id } }),
      prisma.loginAttempt.deleteMany({ where: { userId: params.id } }),
      prisma.notification.deleteMany({ where: { userId: params.id } }),
      prisma.alerte.updateMany({ where: { declareeParId: params.id }, data: { declareeParId: null } }),
      prisma.alerte.updateMany({ where: { verifieeParId: params.id }, data: { verifieeParId: null } }),
      prisma.user.delete({ where: { id: params.id } }),
    ]);

    return NextResponse.json({ ok: true, supprime: true });
  } catch (error) {
    return handleApiError(error);
  }
}
