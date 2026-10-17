import { Prisma } from "../../../../../generated/prisma/client.js";
import { AppError } from "../../errors";
import type { IdentityDatabase } from "../../infrastructure/database";
import type { VerifiedIdentity } from "../../security/auth";
import type { MeView, MeCandidateProfile, OrganizationContextView } from "@equipo10/contracts";
import { randomUUID } from "node:crypto";

export class IdentityService {
  constructor(private readonly db: IdentityDatabase) {}

  async bootstrap(identity: VerifiedIdentity): Promise<MeView> {
    const appUserId = await this.db.resolveAuthSubject(identity.id, true);
    if (!appUserId) {
      throw new AppError(403, "OPERATION_NOT_ALLOWED", "No fue posible inicializar la cuenta");
    }
    return this.loadMeView(appUserId, identity.email);
  }

  async getMe(identity: VerifiedIdentity): Promise<MeView> {
    const appUserId = await this.db.resolveAuthSubject(identity.id, false);
    if (!appUserId) {
      throw new AppError(404, "ACCOUNT_NOT_INITIALIZED", "La cuenta aún no ha sido inicializada");
    }
    return this.loadMeView(appUserId, identity.email);
  }

  async ensureProfile(identity: VerifiedIdentity): Promise<MeCandidateProfile> {
    const appUserId = await this.db.resolveAuthSubject(identity.id, false);
    if (!appUserId) {
      throw new AppError(404, "ACCOUNT_NOT_INITIALIZED", "La cuenta aún no ha sido inicializada");
    }

    return this.db.withActor(appUserId, async (tx) => {
      const newId = randomUUID();
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO app."CandidateProfile" ("id", "ownerUserId")
        VALUES (${newId}::uuid, ${appUserId}::uuid)
        ON CONFLICT ("ownerUserId") DO NOTHING;
      `);

      const profile = await tx.candidateProfile.findUnique({
        where: { ownerUserId: appUserId },
        select: {
          id: true,
          currentVersionId: true,
        },
      });

      if (!profile) {
        throw new AppError(500, "PROFILE_ERROR", "Error al obtener el perfil de candidato");
      }

      return {
        id: profile.id,
        current_version_id: profile.currentVersionId,
      };
    });
  }

  async getProfile(identity: VerifiedIdentity): Promise<MeCandidateProfile> {
    const appUserId = await this.db.resolveAuthSubject(identity.id, false);
    if (!appUserId) {
      throw new AppError(404, "ACCOUNT_NOT_INITIALIZED", "La cuenta aún no ha sido inicializada");
    }

    return this.db.withActor(appUserId, async (tx) => {
      const profile = await tx.candidateProfile.findUnique({
        where: { ownerUserId: appUserId },
        select: {
          id: true,
          currentVersionId: true,
        },
      });

      if (!profile) {
        throw new AppError(404, "NOT_FOUND", "Perfil no encontrado");
      }

      return {
        id: profile.id,
        current_version_id: profile.currentVersionId,
      };
    });
  }

  async organizationContext(identity: VerifiedIdentity, organizationId: string): Promise<OrganizationContextView> {
    const appUserId = await this.db.resolveAuthSubject(identity.id, false);
    if (!appUserId) {
      throw new AppError(404, "ACCOUNT_NOT_INITIALIZED", "La cuenta no está inicializada");
    }

    return this.db.withActor(appUserId, async (tx) => {
      const membership = await tx.organizationMembership.findFirst({
        where: {
          userId: appUserId,
          organizationId,
          status: "ACTIVE",
          organization: {
            active: true,
          },
        },
        select: {
          id: true,
          role: true,
          organization: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
        },
      });

      if (!membership || !membership.organization) {
        throw new AppError(404, "NOT_FOUND", "Organización no encontrada o membresía inactiva");
      }

      return {
        membership_id: membership.id,
        role: membership.role,
        organization: {
          id: membership.organization.id,
          name: membership.organization.name,
          type: membership.organization.type,
        },
      };
    });
  }

  private async loadMeView(appUserId: string, email: string): Promise<MeView> {
    return this.db.withActor(appUserId, async (tx) => {
      const user = await tx.appUser.findUnique({
        where: { id: appUserId },
        select: {
          id: true,
          authSubject: true,
          status: true,
          locale: true,
          theme: true,
        },
      });

      if (!user || user.status !== "ACTIVE") {
        throw new AppError(403, "OPERATION_NOT_ALLOWED", "Usuario inactivo");
      }

      const profile = await tx.candidateProfile.findUnique({
        where: { ownerUserId: appUserId },
        select: {
          id: true,
          currentVersionId: true,
        },
      });

      const memberships = await tx.organizationMembership.findMany({
        where: {
          userId: appUserId,
          status: "ACTIVE",
          organization: {
            active: true,
          },
        },
        select: {
          id: true,
          role: true,
          organization: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
        },
      });

      const contexts: OrganizationContextView[] = memberships
        .filter((m) => m.organization !== null)
        .map((m) => ({
          membership_id: m.id,
          role: m.role,
          organization: {
            id: m.organization.id,
            name: m.organization.name,
            type: m.organization.type,
          },
        }));

      const counselor = await tx.orientationCounselor.findUnique({
        where: { userId: appUserId, active: true },
        select: {
          id: true,
          userId: true,
          displayName: true,
          specialty: true,
        },
      });

      return {
        user: {
          id: user.id,
          auth_subject: user.authSubject,
          status: "ACTIVE",
          locale: user.locale,
          theme: user.theme,
        },
        email,
        profile: profile
          ? {
              id: profile.id,
              current_version_id: profile.currentVersionId,
            }
          : null,
        contexts,
        counselor: counselor
          ? {
              id: counselor.id,
              user_id: counselor.userId,
              display_name: counselor.displayName,
              specialty: counselor.specialty,
            }
          : null,
      };
    });
  }
}
