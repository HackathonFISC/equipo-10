import { Hono } from "hono";
import type { AppEnv } from "../../app";
import { AppError } from "../../errors";
import type { RecruitmentService } from "./recruitment.service";
import {
  IdSchema,
  CreateOpportunityDraftRequestSchema,
  UpdateOpportunityDraftRequestSchema,
  PublishOpportunityDraftRequestSchema,
} from "@equipo10/contracts";

export function createRecruitmentController(service: RecruitmentService): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  // POST /organizations/:organizationId/drafts
  router.post("/organizations/:organizationId/drafts", async (c) => {
    const identity = c.get("identity");
    const requestId = c.get("requestId");
    const organizationId = c.req.param("organizationId");

    const idParsed = IdSchema.safeParse(organizationId);
    if (!idParsed.success) {
      throw new AppError(400, "INVALID_REQUEST", "ID de organización inválido");
    }

    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      throw new AppError(400, "INVALID_REQUEST", "Cuerpo de solicitud JSON inválido");
    }

    const parsed = CreateOpportunityDraftRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new AppError(400, "INVALID_REQUEST", "Cuerpo de solicitud inválido", false, [
        ...parsed.error.issues.map((e) => ({
          field: e.path.join("."),
          message: e.message,
        })),
      ]);
    }

    const draft = await service.createDraft(identity, organizationId, parsed.data);
    return c.json({ data: draft, request_id: requestId }, 201);
  });

  // GET /organizations/:organizationId/drafts/:draftId
  router.get("/organizations/:organizationId/drafts/:draftId", async (c) => {
    const identity = c.get("identity");
    const requestId = c.get("requestId");
    const organizationId = c.req.param("organizationId");
    const draftId = c.req.param("draftId");

    const draft = await service.getDraft(identity, organizationId, draftId);
    return c.json({ data: draft, request_id: requestId }, 200);
  });

  // PATCH /organizations/:organizationId/drafts/:draftId
  router.patch("/organizations/:organizationId/drafts/:draftId", async (c) => {
    const identity = c.get("identity");
    const requestId = c.get("requestId");
    const organizationId = c.req.param("organizationId");
    const draftId = c.req.param("draftId");

    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      throw new AppError(400, "INVALID_REQUEST", "Cuerpo de solicitud JSON inválido");
    }

    const parsed = UpdateOpportunityDraftRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new AppError(400, "INVALID_REQUEST", "Cuerpo de solicitud inválido", false, [
        ...parsed.error.issues.map((e) => ({
          field: e.path.join("."),
          message: e.message,
        })),
      ]);
    }

    const draft = await service.updateDraft(identity, organizationId, draftId, parsed.data);
    return c.json({ data: draft, request_id: requestId }, 200);
  });

  // POST /organizations/:organizationId/drafts/:draftId/publish
  router.post("/organizations/:organizationId/drafts/:draftId/publish", async (c) => {
    const identity = c.get("identity");
    const requestId = c.get("requestId");
    const organizationId = c.req.param("organizationId");
    const draftId = c.req.param("draftId");

    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      throw new AppError(400, "INVALID_REQUEST", "Cuerpo de solicitud JSON inválido");
    }

    const parsed = PublishOpportunityDraftRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new AppError(400, "INVALID_REQUEST", "Cuerpo de solicitud inválido", false, [
        ...parsed.error.issues.map((e) => ({
          field: e.path.join("."),
          message: e.message,
        })),
      ]);
    }

    const opportunity = await service.publishDraft(identity, organizationId, draftId, parsed.data);
    return c.json({ data: opportunity, request_id: requestId }, 201);
  });

  // GET /organizations/:organizationId/opportunities
  router.get("/organizations/:organizationId/opportunities", async (c) => {
    const identity = c.get("identity");
    const requestId = c.get("requestId");
    const organizationId = c.req.param("organizationId");

    const items = await service.listCompanyOpportunities(identity, organizationId);
    return c.json({ data: { items }, request_id: requestId }, 200);
  });

  // GET /organizations/:organizationId/opportunities/:opportunityId/applications
  // Consulta MINIMIZADA: solo empresa dueña y postulaciones consentidas
  router.get("/organizations/:organizationId/opportunities/:opportunityId/applications", async (c) => {
    const identity = c.get("identity");
    const requestId = c.get("requestId");
    const organizationId = c.req.param("organizationId");
    const opportunityId = c.req.param("opportunityId");

    const items = await service.listApplicationsForOpportunity(identity, organizationId, opportunityId);
    return c.json({ data: { items }, request_id: requestId }, 200);
  });

  return router;
}
