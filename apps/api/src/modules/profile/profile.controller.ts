import { Hono } from "hono";
import {
  CreateDraftRequestSchema,
  PatchDraftIdentityRequestSchema,
  PatchDraftExperienceRequestSchema,
  PatchDraftTrainingRequestSchema,
  PatchDraftInterestsRequestSchema,
  PatchDraftAvailabilityRequestSchema,
  PatchDraftConstraintsRequestSchema,
  SectionReviewRequestSchema,
  ConfirmProfileRequestSchema,
  CreateManualTextSourceRequestSchema,
  WithdrawSourceRequestSchema,
  InterpretationGrantRequestSchema,
  ProfileInterpretationRequestSchema,
  SuggestionBatchDecisionRequestSchema,
} from "@equipo10/contracts";
import { AppError } from "../../errors";
import type { ProfileService } from "./profile.service";
import type { AppEnv } from "../../app";

export function createProfileController(service: ProfileService): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  router.post("/me/candidate-profile/drafts", async (c) => {
    const identity = c.get("identity");
    const requestId = c.get("requestId");

    const idempotencyKey = c.req.header("Idempotency-Key")?.trim();
    if (!idempotencyKey || idempotencyKey.length < 16 || idempotencyKey.length > 128) {
      throw new AppError(
        400,
        "INVALID_REQUEST",
        "Encabezado Idempotency-Key requerido (longitud entre 16 y 128 caracteres)"
      );
    }

    const contentType = c.req.header("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      throw new AppError(415, "UNSUPPORTED_MEDIA_TYPE", "Tipo de contenido no admitido");
    }

    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      throw new AppError(400, "INVALID_REQUEST", "Cuerpo de solicitud JSON inválido");
    }

    const parsed = CreateDraftRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new AppError(400, "INVALID_REQUEST", "Cuerpo de solicitud inválido", false, [
        ...parsed.error.issues.map((e) => ({
          field: e.path.join("."),
          message: e.message,
        })),
      ]);
    }

    const { draft, created } = await service.createDraft(
      identity,
      parsed.data.base_version_id,
      idempotencyKey
    );

    c.header("ETag", draft.revision.toString());
    return c.json({ data: draft, request_id: requestId }, created ? 201 : 200);
  });

  router.get("/me/candidate-profile/draft", async (c) => {
    const identity = c.get("identity");
    const requestId = c.get("requestId");

    const { draft, etag } = await service.getActiveDraft(identity);
    c.header("ETag", etag);
    return c.json({ data: draft, request_id: requestId }, 200);
  });

  router.patch("/me/candidate-profile/draft", async (c) => {
    const identity = c.get("identity");
    const requestId = c.get("requestId");

    const ifMatch = c.req.header("If-Match")?.trim();
    if (!ifMatch) {
      throw new AppError(
        428,
        "PRECONDITION_REQUIRED",
        "Encabezado If-Match requerido para actualizar el borrador"
      );
    }

    const cleanEtag = ifMatch.replace(/^"|"$/g, "");
    const ifMatchRev = parseInt(cleanEtag, 10);
    if (isNaN(ifMatchRev) || ifMatchRev <= 0) {
      throw new AppError(
        412,
        "DRAFT_REVISION_CONFLICT",
        "Encabezado If-Match inválido"
      );
    }

    const contentType = c.req.header("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      throw new AppError(415, "UNSUPPORTED_MEDIA_TYPE", "Tipo de contenido no admitido");
    }

    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      throw new AppError(400, "INVALID_REQUEST", "Cuerpo de solicitud JSON inválido");
    }

    if (typeof rawBody !== "object" || rawBody === null || !("section" in rawBody)) {
      throw new AppError(400, "INVALID_REQUEST", "El campo 'section' es requerido");
    }

    const section = (rawBody as { section: unknown }).section;
    if (section === "identity") {
      const parsed = PatchDraftIdentityRequestSchema.safeParse(rawBody);
      if (!parsed.success) {
        throw new AppError(400, "INVALID_REQUEST", "Cuerpo de sección identity inválido", false, [
          ...parsed.error.issues.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        ]);
      }

      const { draft, etag } = await service.patchIdentity(
        identity,
        ifMatchRev,
        parsed.data.values
      );

      c.header("ETag", etag);
      return c.json({ data: draft, request_id: requestId }, 200);
    }

    if (section === "experience") {
      const parsed = PatchDraftExperienceRequestSchema.safeParse(rawBody);
      if (!parsed.success) {
        throw new AppError(400, "INVALID_REQUEST", "Cuerpo de sección experience inválido", false, [
          ...parsed.error.issues.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        ]);
      }

      const { draft, etag } = await service.patchExperience(
        identity,
        ifMatchRev,
        parsed.data.values
      );

      c.header("ETag", etag);
      return c.json({ data: draft, request_id: requestId }, 200);
    }

    if (section === "training") {
      const parsed = PatchDraftTrainingRequestSchema.safeParse(rawBody);
      if (!parsed.success) {
        throw new AppError(400, "INVALID_REQUEST", "Cuerpo de sección training inválido", false, [
          ...parsed.error.issues.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        ]);
      }

      const { draft, etag } = await service.patchTraining(
        identity,
        ifMatchRev,
        parsed.data.values
      );

      c.header("ETag", etag);
      return c.json({ data: draft, request_id: requestId }, 200);
    }

    if (section === "interests") {
      const parsed = PatchDraftInterestsRequestSchema.safeParse(rawBody);
      if (!parsed.success) {
        throw new AppError(400, "INVALID_REQUEST", "Cuerpo de sección interests inválido", false, [
          ...parsed.error.issues.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        ]);
      }

      const { draft, etag } = await service.patchInterests(
        identity,
        ifMatchRev,
        parsed.data.values
      );

      c.header("ETag", etag);
      return c.json({ data: draft, request_id: requestId }, 200);
    }

    if (section === "availability") {
      const parsed = PatchDraftAvailabilityRequestSchema.safeParse(rawBody);
      if (!parsed.success) {
        throw new AppError(400, "INVALID_REQUEST", "Cuerpo de sección availability inválido", false, [
          ...parsed.error.issues.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        ]);
      }

      const { draft, etag } = await service.patchAvailability(
        identity,
        ifMatchRev,
        parsed.data.values
      );

      c.header("ETag", etag);
      return c.json({ data: draft, request_id: requestId }, 200);
    }

    if (section === "constraints") {
      const parsed = PatchDraftConstraintsRequestSchema.safeParse(rawBody);
      if (!parsed.success) {
        throw new AppError(400, "INVALID_REQUEST", "Cuerpo de sección constraints inválido", false, [
          ...parsed.error.issues.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        ]);
      }

      const { draft, etag } = await service.patchConstraints(
        identity,
        ifMatchRev,
        parsed.data.values
      );

      c.header("ETag", etag);
      return c.json({ data: draft, request_id: requestId }, 200);
    }

    throw new AppError(400, "INVALID_REQUEST", `Sección no reconocida: ${String(section)}`);
  });

  router.post("/me/candidate-profile/draft/section-reviews", async (c) => {
    const identity = c.get("identity");
    const requestId = c.get("requestId");

    const idempotencyKey = c.req.header("Idempotency-Key")?.trim();
    if (!idempotencyKey || idempotencyKey.length < 16 || idempotencyKey.length > 128) {
      throw new AppError(
        400,
        "INVALID_REQUEST",
        "Encabezado Idempotency-Key requerido (longitud entre 16 y 128 caracteres)"
      );
    }

    const ifMatch = c.req.header("If-Match")?.trim();
    if (!ifMatch) {
      throw new AppError(
        428,
        "PRECONDITION_REQUIRED",
        "Encabezado If-Match requerido para registrar revisión de sección"
      );
    }

    const cleanEtag = ifMatch.replace(/^"|"$/g, "");
    const ifMatchRev = parseInt(cleanEtag, 10);
    if (isNaN(ifMatchRev) || ifMatchRev <= 0) {
      throw new AppError(
        412,
        "DRAFT_REVISION_CONFLICT",
        "Encabezado If-Match inválido"
      );
    }

    const contentType = c.req.header("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      throw new AppError(415, "UNSUPPORTED_MEDIA_TYPE", "Tipo de contenido no admitido");
    }

    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      throw new AppError(400, "INVALID_REQUEST", "Cuerpo de solicitud JSON inválido");
    }

    const parsed = SectionReviewRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new AppError(400, "INVALID_REQUEST", "Cuerpo de solicitud inválido", false, [
        ...parsed.error.issues.map((e) => ({
          field: e.path.join("."),
          message: e.message,
        })),
      ]);
    }

    const { review, etag } = await service.reviewSection(
      identity,
      ifMatchRev,
      parsed.data.section,
      parsed.data.decision,
      idempotencyKey
    );

    c.header("ETag", etag);
    return c.json({ data: review, request_id: requestId }, 200);
  });

  router.post("/me/candidate-profile/draft/review-previews", async (c) => {
    const identity = c.get("identity");
    const requestId = c.get("requestId");

    const idempotencyKey = c.req.header("Idempotency-Key")?.trim();
    if (!idempotencyKey || idempotencyKey.length < 16 || idempotencyKey.length > 128) {
      throw new AppError(
        400,
        "INVALID_REQUEST",
        "Encabezado Idempotency-Key requerido (longitud entre 16 y 128 caracteres)"
      );
    }

    const ifMatch = c.req.header("If-Match")?.trim();
    if (!ifMatch) {
      throw new AppError(
        428,
        "PRECONDITION_REQUIRED",
        "Encabezado If-Match requerido para generar preview de revisión"
      );
    }

    const ifMatchRev = parseInt(ifMatch.replace(/["']/g, ""), 10);
    if (isNaN(ifMatchRev)) {
      throw new AppError(400, "INVALID_REQUEST", "Encabezado If-Match inválido");
    }

    const { preview, etag } = await service.generateReviewPreview(
      identity,
      ifMatchRev,
      idempotencyKey
    );

    c.header("ETag", etag);
    return c.json({ data: preview, request_id: requestId }, 201);
  });

  router.post("/me/candidate-profile/confirmations", async (c) => {
    const identity = c.get("identity");
    const requestId = c.get("requestId");

    const idempotencyKey = c.req.header("Idempotency-Key")?.trim();
    if (!idempotencyKey || idempotencyKey.length < 16 || idempotencyKey.length > 128) {
      throw new AppError(
        400,
        "INVALID_REQUEST",
        "Encabezado Idempotency-Key requerido (longitud entre 16 y 128 caracteres)"
      );
    }

    const ifMatch = c.req.header("If-Match")?.trim();
    if (!ifMatch) {
      throw new AppError(
        428,
        "PRECONDITION_REQUIRED",
        "Encabezado If-Match requerido para confirmar perfil"
      );
    }

    const ifMatchRev = parseInt(ifMatch.replace(/["']/g, ""), 10);
    if (isNaN(ifMatchRev)) {
      throw new AppError(400, "INVALID_REQUEST", "Encabezado If-Match inválido");
    }

    const contentType = c.req.header("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      throw new AppError(415, "UNSUPPORTED_MEDIA_TYPE", "Tipo de contenido no admitido");
    }

    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      throw new AppError(400, "INVALID_REQUEST", "Cuerpo de solicitud JSON inválido");
    }

    const parsed = ConfirmProfileRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new AppError(400, "INVALID_REQUEST", "Cuerpo de solicitud inválido", false, [
        ...parsed.error.issues.map((e) => ({
          field: e.path.join("."),
          message: e.message,
        })),
      ]);
    }

    const receipt = await service.confirmProfile(
      identity,
      parsed.data,
      ifMatchRev,
      idempotencyKey
    );

    return c.json({ data: receipt, request_id: requestId }, 201);
  });

  router.get("/me/candidate-profile/versions/:versionId", async (c) => {
    const identity = c.get("identity");
    const requestId = c.get("requestId");
    const versionId = c.req.param("versionId");

    const version = await service.getVersion(identity, versionId);
    return c.json({ data: version, request_id: requestId }, 200);
  });

  router.get("/me/profile-operations/:receiptId", async (c) => {
    const identity = c.get("identity");
    const requestId = c.get("requestId");
    const receiptId = c.req.param("receiptId");

    const receipt = await service.getOperationReceipt(identity, receiptId);
    return c.json({ data: receipt, request_id: requestId }, 200);
  });

  router.post("/me/profile-sources", async (c) => {
    const identity = c.get("identity");
    const requestId = c.get("requestId");

    const idempotencyKey = c.req.header("Idempotency-Key")?.trim();
    if (!idempotencyKey || idempotencyKey.length < 16 || idempotencyKey.length > 128) {
      throw new AppError(
        400,
        "INVALID_REQUEST",
        "Encabezado Idempotency-Key requerido (longitud entre 16 y 128 caracteres)"
      );
    }

    const contentType = c.req.header("content-type") ?? "";

    if (contentType.includes("application/json")) {
      let rawBody: unknown;
      try {
        rawBody = await c.req.json();
      } catch {
        throw new AppError(400, "INVALID_REQUEST", "Cuerpo de solicitud JSON inválido");
      }

      const parsed = CreateManualTextSourceRequestSchema.safeParse(rawBody);
      if (!parsed.success) {
        throw new AppError(400, "INVALID_REQUEST", "Cuerpo de fuente de texto inválido", false, [
          ...parsed.error.issues.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        ]);
      }

      const result = await service.createManualTextSource(
        identity,
        parsed.data.text,
        idempotencyKey
      );
      return c.json({ data: result, request_id: requestId }, 201);
    }

    if (contentType.includes("multipart/form-data")) {
      const body = await c.req.parseBody();
      const file = body["file"];
      const kind = (body["kind"] as string) || "pdf";

      if (!file || typeof file === "string") {
        throw new AppError(400, "INVALID_REQUEST", "Debe proporcionarse un archivo válido en el campo 'file'");
      }

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const result = await service.createMultimodalSource(
        identity,
        buffer,
        kind,
        idempotencyKey
      );
      return c.json({ data: result, request_id: requestId }, 201);
    }

    throw new AppError(415, "UNSUPPORTED_MEDIA_TYPE", "Tipo de contenido no admitido (se requiere application/json o multipart/form-data)");
  });

  router.get("/me/profile-sources/:sourceId", async (c) => {
    const identity = c.get("identity");
    const requestId = c.get("requestId");
    const sourceId = c.req.param("sourceId");

    const source = await service.getSource(identity, sourceId);
    return c.json({ data: source, request_id: requestId }, 200);
  });

  router.post("/me/profile-sources/:sourceId/withdrawals", async (c) => {
    const identity = c.get("identity");
    const requestId = c.get("requestId");
    const sourceId = c.req.param("sourceId");

    const idempotencyKey = c.req.header("Idempotency-Key")?.trim();
    if (!idempotencyKey || idempotencyKey.length < 16 || idempotencyKey.length > 128) {
      throw new AppError(
        400,
        "INVALID_REQUEST",
        "Encabezado Idempotency-Key requerido (longitud entre 16 y 128 caracteres)"
      );
    }

    let rawBody: unknown = {};
    const contentType = c.req.header("content-type") ?? "";
    if (contentType.includes("application/json")) {
      try {
        rawBody = await c.req.json();
      } catch {
        rawBody = {};
      }
    }

    const parsed = WithdrawSourceRequestSchema.safeParse(rawBody);
    const reason = parsed.success ? parsed.data.reason : undefined;

    const result = await service.withdrawSource(identity, sourceId, reason, idempotencyKey);
    return c.json({ data: result, request_id: requestId }, 200);
  });

  router.post("/me/profile-interpretation-grants", async (c) => {
    const identity = c.get("identity");
    const requestId = c.get("requestId");

    const idempotencyKey = c.req.header("Idempotency-Key")?.trim();
    if (!idempotencyKey || idempotencyKey.length < 16 || idempotencyKey.length > 128) {
      throw new AppError(
        400,
        "INVALID_REQUEST",
        "Encabezado Idempotency-Key requerido (longitud entre 16 y 128 caracteres)"
      );
    }

    const contentType = c.req.header("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      throw new AppError(415, "UNSUPPORTED_MEDIA_TYPE", "Tipo de contenido no admitido");
    }

    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      throw new AppError(400, "INVALID_REQUEST", "Cuerpo de solicitud JSON inválido");
    }

    const parsed = InterpretationGrantRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new AppError(400, "INVALID_REQUEST", "Cuerpo de autorización inválido", false, [
        ...parsed.error.issues.map((e) => ({
          field: e.path.join("."),
          message: e.message,
        })),
      ]);
    }

    const grant = await service.createInterpretationGrant(
      identity,
      parsed.data,
      idempotencyKey
    );

    return c.json({ data: grant, request_id: requestId }, 201);
  });

  router.post("/me/profile-interpretation-grants/:id/revocations", async (c) => {
    const identity = c.get("identity");
    const requestId = c.get("requestId");
    const grantId = c.req.param("id");

    const idempotencyKey = c.req.header("Idempotency-Key")?.trim();
    if (!idempotencyKey || idempotencyKey.length < 16 || idempotencyKey.length > 128) {
      throw new AppError(
        400,
        "INVALID_REQUEST",
        "Encabezado Idempotency-Key requerido (longitud entre 16 y 128 caracteres)"
      );
    }

    const result = await service.revokeInterpretationGrant(
      identity,
      grantId,
      idempotencyKey
    );

    return c.json({ data: result, request_id: requestId }, 200);
  });

  router.post("/me/profile-interpretations", async (c) => {
    const identity = c.get("identity");
    const requestId = c.get("requestId");

    const idempotencyKey = c.req.header("Idempotency-Key")?.trim();
    if (!idempotencyKey || idempotencyKey.length < 16 || idempotencyKey.length > 128) {
      throw new AppError(
        400,
        "INVALID_REQUEST",
        "Encabezado Idempotency-Key requerido (longitud entre 16 y 128 caracteres)"
      );
    }

    const ifMatch = c.req.header("If-Match")?.trim();
    if (!ifMatch) {
      throw new AppError(
        428,
        "PRECONDITION_REQUIRED",
        "Encabezado If-Match requerido para solicitar interpretación"
      );
    }

    const ifMatchRev = parseInt(ifMatch.replace(/["']/g, ""), 10);
    if (isNaN(ifMatchRev)) {
      throw new AppError(400, "INVALID_REQUEST", "Encabezado If-Match inválido");
    }

    const contentType = c.req.header("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      throw new AppError(415, "UNSUPPORTED_MEDIA_TYPE", "Tipo de contenido no admitido");
    }

    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      throw new AppError(400, "INVALID_REQUEST", "Cuerpo de solicitud JSON inválido");
    }

    const parsed = ProfileInterpretationRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new AppError(400, "INVALID_REQUEST", "Cuerpo de solicitud de interpretación inválido", false, [
        ...parsed.error.issues.map((e) => ({
          field: e.path.join("."),
          message: e.message,
        })),
      ]);
    }

    const runView = await service.requestInterpretation(
      identity,
      parsed.data,
      ifMatchRev,
      idempotencyKey
    );

    return c.json({ data: runView, request_id: requestId }, 202);
  });

  router.get("/me/profile-interpretations/:runId", async (c) => {
    const identity = c.get("identity");
    const requestId = c.get("requestId");
    const runId = c.req.param("runId");

    const runView = await service.getInterpretationRun(identity, runId);
    return c.json({ data: runView, request_id: requestId }, 200);
  });

  router.post("/me/candidate-profile/draft/suggestion-decisions", async (c) => {
    const identity = c.get("identity");
    const requestId = c.get("requestId");

    const idempotencyKey = c.req.header("Idempotency-Key")?.trim();
    if (!idempotencyKey || idempotencyKey.length < 16 || idempotencyKey.length > 128) {
      throw new AppError(
        400,
        "INVALID_REQUEST",
        "Encabezado Idempotency-Key requerido (longitud entre 16 y 128 caracteres)"
      );
    }

    const ifMatch = c.req.header("If-Match")?.trim();
    if (!ifMatch) {
      throw new AppError(
        428,
        "PRECONDITION_REQUIRED",
        "Encabezado If-Match requerido para aplicar decisiones de sugerencias"
      );
    }

    const ifMatchRev = parseInt(ifMatch.replace(/["']/g, ""), 10);
    if (isNaN(ifMatchRev)) {
      throw new AppError(400, "INVALID_REQUEST", "Encabezado If-Match inválido");
    }

    const contentType = c.req.header("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      throw new AppError(415, "UNSUPPORTED_MEDIA_TYPE", "Tipo de contenido no admitido");
    }

    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      throw new AppError(400, "INVALID_REQUEST", "Cuerpo de solicitud JSON inválido");
    }

    const parsed = SuggestionBatchDecisionRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new AppError(400, "INVALID_REQUEST", "Cuerpo de decisiones inválido", false, [
        ...parsed.error.issues.map((e) => ({
          field: e.path.join("."),
          message: e.message,
        })),
      ]);
    }

    const result = await service.applySuggestionBatch(
      identity,
      parsed.data,
      ifMatchRev,
      idempotencyKey
    );

    c.header("ETag", result.new_revision.toString());
    return c.json({ data: result, request_id: requestId }, 200);
  });

  return router;
}

