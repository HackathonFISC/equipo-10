import type { VerifiedIdentity } from "../../security/auth";
import { AppError } from "../../errors";
import type { Prisma } from "../../../../../generated/prisma/client.js";
import type { ActorTransactionOptions } from "../../infrastructure/database";
import type {
  CourseListItem,
  CourseListResponse,
  CourseDetailView,
  CourseEditionView,
} from "@equipo10/contracts";

export interface CoursesDatabase {
  resolveAuthSubject(subject: string, bootstrap: boolean): Promise<string | null>;
  withActor<T>(id: string, fn: (tx: Prisma.TransactionClient) => Promise<T>, options?: ActorTransactionOptions): Promise<T>;
}

export interface CoursesQuery {
  q?: string;
  competency_id?: string;
  modality?: string;
  limit?: number;
  offset?: number;
}

export class CoursesService {
  constructor(private readonly db: CoursesDatabase) {}

  async resolveActor(identity: VerifiedIdentity): Promise<string> {
    const actorUserId = await this.db.resolveAuthSubject(identity.id, false);
    if (!actorUserId) {
      throw new AppError(404, "ACCOUNT_NOT_INITIALIZED", "La cuenta no está inicializada");
    }
    return actorUserId;
  }

  async listCourses(
    identity: VerifiedIdentity,
    params: CoursesQuery
  ): Promise<CourseListResponse> {
    const actorUserId = await this.resolveActor(identity);
    const limit = Math.min(Math.max(params.limit ?? 20, 1), 50);
    const offset = Math.max(params.offset ?? 0, 0);

    return this.db.withActor(actorUserId, async (tx) => {
      const where: any = {
        active: true,
      };

      if (params.q) {
        where.OR = [
          { title: { contains: params.q, mode: "insensitive" } },
          { description: { contains: params.q, mode: "insensitive" } },
        ];
      }

      if (params.competency_id) {
        where.versions = {
          some: {
            learningOutcomes: {
              some: {
                competencyId: params.competency_id,
              },
            },
          },
        };
      }

      if (params.modality) {
        where.versions = {
          some: {
            editions: {
              some: {
                active: true,
                modality: params.modality,
              },
            },
          },
        };
      }

      const total = await tx.course.count({ where });

      const courses = await tx.course.findMany({
        where,
        include: {
          organization: {
            select: { id: true, name: true },
          },
          versions: {
            orderBy: { versionNumber: "desc" },
            take: 1,
            include: {
              editions: {
                where: { active: true },
                orderBy: { startDate: "asc" },
                include: {
                  reservations: {
                    where: { status: "CONFIRMED" },
                    select: { id: true },
                  },
                },
              },
            },
          },
        },
        orderBy: [{ isDemo: "desc" }, { createdAt: "desc" }],
        take: limit,
        skip: offset,
      });

      const items: CourseListItem[] = courses.map((c) => {
        const latestVersion = c.versions[0];
        const activeEditions = latestVersion?.editions || [];
        const nextEdition = activeEditions[0];

        return {
          id: c.id,
          code: c.code,
          title: c.title,
          description: c.description,
          organization: {
            id: c.organization.id,
            name: c.organization.name,
          },
          active_editions_count: activeEditions.length,
          next_start_date: nextEdition ? nextEdition.startDate.toISOString().split("T")[0] : null,
          is_demo: c.isDemo,
        };
      });

      return {
        items,
        pagination: {
          total,
          limit,
          offset,
        },
      };
    });
  }

  async getCourseDetail(
    identity: VerifiedIdentity,
    id: string
  ): Promise<CourseDetailView> {
    const actorUserId = await this.resolveActor(identity);

    return this.db.withActor(actorUserId, async (tx) => {
      const course = await tx.course.findFirst({
        where: { id, active: true },
        include: {
          organization: {
            select: { id: true, name: true },
          },
          versions: {
            orderBy: { versionNumber: "desc" },
            take: 1,
            include: {
              learningOutcomes: {
                include: {
                  competency: {
                    select: { name: true },
                  },
                },
              },
              prerequisites: {
                include: {
                  competency: {
                    select: { name: true },
                  },
                },
              },
              editions: {
                where: { active: true },
                orderBy: { startDate: "asc" },
                include: {
                  sessions: {
                    orderBy: [{ weekday: "asc" }, { startMinute: "asc" }],
                  },
                  reservations: {
                    where: { status: "CONFIRMED" },
                    select: { id: true },
                  },
                },
              },
            },
          },
        },
      });

      if (!course) {
        throw new AppError(404, "COURSE_NOT_FOUND", "Curso no encontrado o inactivo");
      }

      const latestVersion = course.versions[0];
      if (!latestVersion) {
        throw new AppError(404, "COURSE_VERSION_NOT_FOUND", "Versión curricular del curso no encontrada");
      }

      const editions: CourseEditionView[] = latestVersion.editions.map((ed) => {
        const activeReservationsCount = ed.reservations.length;
        const availableSlots = Math.max(0, ed.totalSlots - activeReservationsCount);

        return {
          id: ed.id,
          modality: ed.modality,
          location: ed.location,
          start_date: ed.startDate.toISOString().split("T")[0],
          end_date: ed.endDate.toISOString().split("T")[0],
          total_slots: ed.totalSlots,
          available_slots: availableSlots,
          cost_amount: ed.costAmount ? ed.costAmount.toFixed(2) : null,
          cost_currency: ed.costCurrency,
          cost_period: ed.costPeriod,
          schedule_summary: ed.scheduleSummary,
          sessions: ed.sessions.map((s) => ({
            id: s.id,
            weekday: s.weekday,
            start_minute: s.startMinute,
            end_minute: s.endMinute,
            timezone: s.timezone,
            location: s.location,
          })),
          active: ed.active,
          version: ed.version,
          published_at: ed.publishedAt.toISOString(),
        };
      });

      return {
        id: course.id,
        code: course.code,
        title: course.title,
        description: course.description,
        organization: {
          id: course.organization.id,
          name: course.organization.name,
        },
        version: {
          id: latestVersion.id,
          version_number: latestVersion.versionNumber,
          syllabus_text: latestVersion.syllabusText,
          duration_hours: latestVersion.durationHours,
        },
        learning_outcomes: latestVersion.learningOutcomes.map((lo) => ({
          id: lo.id,
          competency_id: lo.competencyId,
          competency_name: lo.competency.name,
          description: lo.description,
        })),
        prerequisites: latestVersion.prerequisites.map((pr) => ({
          id: pr.id,
          competency_id: pr.competencyId,
          competency_name: pr.competency.name,
          essential: pr.essential,
          description: pr.description,
        })),
        editions,
        is_demo: course.isDemo,
      };
    });
  }
}
