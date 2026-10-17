# Contratos D8 — Orientador Independiente y Acompañamiento de Ruta

## 1. Alcance
Implementación del acompañamiento del orientador independiente para AImpulsa:
- Joven solicita revisión de una versión concreta de su ruta formativa a un orientador registrado.
- Orientador accede exclusivamente a los datos autorizados (resumen confirmado, pasos de ruta, viabilidad C01, explicaciones A03/A05 ya persistidas).
- Orientador puede proponer aclaraciones/correcciones o registrar una revisión motivada (APROBADA o RECHAZADA).
- Joven puede responder (aceptar/rechazar) las aclaraciones y puede revocar el acceso en cualquier momento.
- Revocación corta inmediatamente accesos futuros al orientador.
- Las reservas derivadas de una ruta acompañada exigen revisión APROBADA y vigente. Reservas independientes no acompañadas conservan el flujo D4.

## 2. Endpoints HTTP

### Orientadores Habilitados
- `GET /api/v1/counselors`
  - Responde: `{ data: CounselorSummaryView[], request_id: string }`

### Candidato (Mi Ruta / Acompañamiento)
- `POST /api/v1/me/learning-plans/:planId/engagements`
  - Headers: `Idempotency-Key` (requerido)
  - Body: `{ counselor_id: string, purpose?: string }`
  - Responde: 201 `{ data: OrientationEngagementView, request_id: string }`
- `GET /api/v1/me/learning-plans/:planId/engagements`
  - Responde: 200 `{ data: OrientationEngagementView[], request_id: string }`
- `POST /api/v1/me/orientations/:engagementId/revoke`
  - Headers: `Idempotency-Key` (opcional)
  - Body: `{ reason?: string }`
  - Responde: 200 `{ data: OrientationEngagementView, request_id: string }`
- `POST /api/v1/me/orientations/:engagementId/clarifications/:clarificationId/respond`
  - Body: `{ decision: 'ACCEPTED' | 'REJECTED', response?: string }`
  - Responde: 200 `{ data: ClarificationItemView, request_id: string }`

### Orientador Independiente
- `GET /api/v1/counselor/engagements`
  - Responde: 200 `{ data: CounselorInboxItemView[], request_id: string }`
- `GET /api/v1/counselor/engagements/:id`
  - Responde: 200 `{ data: CounselorEngagementDetailView, request_id: string }`
- `POST /api/v1/counselor/engagements/:id/clarifications`
  - Headers: `Idempotency-Key` (opcional)
  - Body: `{ question: string, proposed_correction?: string }`
  - Responde: 201 `{ data: ClarificationItemView, request_id: string }`
- `POST /api/v1/counselor/engagements/:id/review`
  - Headers: `Idempotency-Key` (opcional)
  - Body: `{ expected_plan_version: number, decision: 'APPROVED' | 'REJECTED' | 'CLARIFICATION_NEEDED', motivation: string, reasons?: string[] }`
  - Responde: 200 `{ data: OrientationReviewView, request_id: string }`

### Reserva de Cursos
- `POST /api/v1/courses/reservations`
  - Revalida en servidor si el `plan_id` suministrado tiene acompañamiento activo:
    - Si existe un engagement en estado diferente de `APPROVED`, falla con 409 `PLAN_REVIEW_REQUIRED` o `PLAN_REVIEW_NOT_APPROVED`.
    - Si la versión del plan o de la revisión cambió respecto a la revisión aprobada, falla con 409 `OUTDATED_PLAN_REVIEW`.
    - Si no tiene solicitud de acompañamiento, procede como reserva estándar de D4.

## 3. Estados de Solicitud (OrientationRequestStatus)
- `REQUESTED`: Solicitud creada por el joven, pendiente de inicio por el orientador.
- `IN_REVIEW`: Orientador ha tomado el caso y se encuentra revisando.
- `CLARIFICATION_REQUESTED`: Orientador solicitó aclaración o propuso corrección.
- `APPROVED`: Orientador emitió revisión favorable motivada.
- `REJECTED`: Orientador emitió rechazo motivado.
- `OUTDATED`: El plan, perfil o vacante cambió de versión posterior a la solicitud.
- `REVOKED`: El joven revocó expresamente el acceso al orientador.

## 4. Archivos a Tocar
1. `prisma/schema.prisma`
2. `prisma/migrations/202610170010_independent_orientation/migration.sql`
3. `packages/contracts/src/index.ts`
4. `apps/api/src/modules/orientation/orientation.service.ts`
5. `apps/api/src/modules/orientation/orientation.controller.ts`
6. `apps/api/src/modules/reservations/reservations.service.ts`
7. `apps/api/src/modules/identity/identity.service.ts`
8. `apps/api/src/app.ts` y `apps/api/src/server.ts`
9. `apps/web/src/features/learning-route/LearningRoutePage.tsx`
10. `apps/web/src/features/orientation/CounselorInboxPage.tsx`
11. `apps/web/src/features/orientation/CounselorDetailPage.tsx`
12. `apps/web/src/app/App.tsx`
13. `tests/api/orientation-independent.test.ts`
14. `docs/D8_ENTREGA.md`
15. `docs/BITACORA_IA.csv`
