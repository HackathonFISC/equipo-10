# Entrega Etapa D8: Acompañamiento del Orientador Independiente

> **Estado:** Implementada y Verificada Localmente (Hallazgos V01–V05, Despliegue CLI y Reserva Independiente Corregidos y Validados)  
> **Actualización de despliegue — Codex, 2026-10-17:** Migración D8 aplicada y verificada en Supabase por solicitud del equipo. Resultado: apply_success y verify_success, pending: [], runtime_verified: true; sin cambios en conteos de registros existentes comprobados. El informe de implementación y pruebas de Antigravity que sigue se conserva como evidencia histórica. Ver [cierre de migración](CIERRE_MIGRACIONES_REPOSITORIO.md).
>
> **Fecha:** 2026-10-17  
> **Autoría Técnica:** Gemini 3.8 Flash (Vertex AI / Antigravity Assistant)  
> **Revisión y Aceptación:** Validación automatizada sobre PostgreSQL (`equipo10_d1_test`), suites dirigidas con 17/17 PASS, auditoría 16/16 PASS, regresión de reservas 10/10 PASS, planner 8/8 PASS, A05 9/9 PASS, typecheck exit 0, build exit 0 y CLI `deploy-d8.mjs --check` exit 0.  

---

## 1. Resumen Ejecutivo y Alcance

Se ha completado y corregido la **Etapa D8 de AImpulsa** conforme a los lineamientos estrictos de [AGENTS.md](../AGENTS.md), [PLAN_EJECUCION_D8.md](PLAN_EJECUCION_D8.md), [CONTRATOS_D8.md](CONTRATOS_D8.md), [VERIFICACION_INTEGRAL_D1_D8.md](VERIFICACION_INTEGRAL_D1_D8.md), [REVISION_D8_CIERRE_FOCAL.md](REVISION_D8_CIERRE_FOCAL.md) y [ESPECIFICACION_CASOS_USO.md](ESPECIFICACION_CASOS_USO.md) (especialmente CU14 y CU16).

### Principios y Reglas de Negocio Implementadas y Corregidas
1. **Orientador Independiente:** El orientador es una persona natural con rol profesional independiente; **no pertenece ni representa a empresas ni a centros formativos**.
2. **Minimización de Datos y Consentimiento:** El joven otorga consentimiento explícito para compartir únicamente la versión concreta seleccionada de su plan formativo y datos mínimos de perfil (presupuesto y límite de traslado). El orientador **no tiene acceso al CV crudo, diagnósticos privados ni datos internos de empresas**.
3. **No Suplantación:** El orientador **no puede modificar directamente el perfil del joven, ni puede reservar plazas o postular a vacantes por él**.
4. **Guardrail Determinista C01 y Vigencia Estricta:** Una ruta formativa determinada como `INVIABLE` o con logística `PENDING` por el motor C01 **no puede ser aprobada** como verificada por el orientador (rechazado con `409 CANNOT_APPROVE_INVIABLE_PLAN` o `409 CANNOT_APPROVE_PENDING_PLAN`). La revisión humana nunca altera por sí sola el cálculo determinista C01.
5. **Versión Concreta y Desactualización:** El dictamen se emite sobre una versión específica (`expected_plan_version`). Si el plan fue marcado como desactualizado (`outdated: true`), no está confirmado, o si la vacante objetivo, las ediciones del itinerario o la versión del perfil del candidato cambiaron, la aprobación es bloqueada con `409 OUTDATED_PLAN_VERSION`.
6. **Idempotencia Estricta y Auditoría Atómica:**
   - La revisión con `Idempotency-Key` devuelve el mismo resultado ante repeticiones idénticas (código 200 con recibo persistido) y genera `409 IDEMPOTENCY_CONFLICT` si la clave se reutiliza con un cuerpo distinto.
   - Intentos concurrentes o repetidos de dictamen sobre una solicitud ya revisada son rechazados con `409 ENGAGEMENT_ALREADY_REVIEWED`.
   - Se persisten atómicamente `AuditEvent` y `OperationReceipt` en las 5 operaciones del ciclo de vida (solicitud, aclaración, respuesta, revisión y revocación), respetando las políticas RLS para orientadores.
7. **Contexto de Reserva y Autonomía del Joven:**
   - **Acción procedente de la ruta acompañada:** Si se proporciona `plan_id` (o la reserva deriva explícitamente de la ruta), se valida que la ruta cuente con revisión `APPROVED` vigente. Si el acompañamiento fue revocado, devuelve `409 ORIENTATION_REVOKED`; si no ha sido aprobado, devuelve `409 PLAN_REVIEW_NOT_APPROVED`.
   - **Elusión bloqueada:** Si no se suministra `plan_id` pero el candidato mantiene un acompañamiento activo no aprobado (`REQUESTED`, `IN_REVIEW`, `CLARIFICATION_REQUESTED`, `REJECTED`) para esa edición, la API bloquea el intento con `409 PLAN_REVIEW_NOT_APPROVED`.
   - **Reserva independiente de la misma edición tras revocación:** Si el joven revocó el acompañamiento (`REVOKED`) o reserva directamente desde el catálogo sin acompañamiento activo, se preserva el derecho del joven a matricularse de forma independiente en la misma edición (o en otra distinta), respondiendo `201 CONFIRMED` (D4).
8. **Revocación Efectiva con Corte Inmediato por RLS:** El joven puede revocar el acompañamiento en cualquier momento. A nivel de base de datos PostgreSQL, las políticas RLS para `equipo10_runtime` evalúan `e.status NOT IN ('REVOKED')`, cortando el acceso del orientador (`404 ENGAGEMENT_NOT_FOUND`).
9. **No Cancelación Retroactiva:** La revocación corta inmediatamente los accesos futuros, pero **no cancela las reservas formativas que ya fueron previamente confirmadas** en `app.CourseReservation`.

---

## 2. Cambios Realizados por Bloques

### Bloque 1: Vigencia y Aprobación
- Modificado `apps/api/src/modules/orientation/orientation.service.ts`:
  - `submitReview` evalúa viabilidad C01: bloquea planes `PENDING` (`409 CANNOT_APPROVE_PENDING_PLAN`) e `INVIABLE` (`409 CANNOT_APPROVE_INVIABLE_PLAN`).
  - Bloquea planes con `outdated === true` o `status !== 'CONFIRMED'` (`409 OUTDATED_PLAN_VERSION`).
  - Revalida vigencia de la vacante objetivo (`Opportunity`): comprueba que esté activa y que su versión coincida con `engagement.targetOpportunityVersion`.
  - Revalida ediciones del itinerario (`CourseEdition`): comprueba que estén activas y no expiradas.
  - Revalida versión confirmada del perfil (`candidateProfile.currentVersionId === engagement.revisionId`).

### Bloque 2: Idempotencia y Auditoría
- Esquema relacional (`prisma/schema.prisma` y migración `202610170010_independent_orientation`):
  - Añadido `targetOpportunityVersion Int?` a `OrientationEngagement`.
- Controlador `apps/api/src/modules/orientation/orientation.controller.ts`:
  - Lectura y paso de cabecera `Idempotency-Key` en `POST /counselor/engagements/:id/review`.
- Servicio `apps/api/src/modules/orientation/orientation.service.ts`:
  - Detección de replay idempotente en `submitReview` con hash de payload; retorna revisión existente revalidando autorización del orientador.
  - Detección de colisión `409 IDEMPOTENCY_CONFLICT` ante clave reutilizada con distinto contenido.
  - Bloqueo `409 ENGAGEMENT_ALREADY_REVIEWED` ante dictamen duplicado sin clave coincidente.
  - Registro atómico de `AuditEvent` y `OperationReceipt` en `requestOrientation`, `revokeOrientation`, `createClarification`, `respondClarification` y `submitReview`, manejando `profileId = null` en eventos de orientador para cumplir con RLS.

### Bloque 3: Contexto de Reserva
- Modificado `apps/api/src/modules/reservations/reservations.service.ts`:
  - Distinción entre reservas de ruta acompañada (`plan_id` explícito) y reservas independientes de catálogo (`!plan_id`).
  - Cuando se omite `plan_id`, busca si existe acompañamiento activo no aprobado (`REQUESTED`, `IN_REVIEW`, `CLARIFICATION_REQUESTED`, `REJECTED`) para esa edición: si existe, bloquea con `409 PLAN_REVIEW_NOT_APPROVED` para impedir elusión.
  - Si el acompañamiento fue revocado (`REVOKED`), la reserva sin `plan_id` de la **misma edición** procede como reserva independiente con `201 CONFIRMED` (resolviendo la frontera documentada en `REVISION_D8_CIERRE_FOCAL.md`).
  - Si se envía `plan_id` de una ruta cuyo acompañamiento fue revocado, se rechaza con `409 ORIENTATION_REVOKED`.
  - Preservación de controles de cupo, agenda, prerrequisitos e idempotencia (D4).

### Bloque 4: Despliegue D8
- Reescritura completa de `scripts/deploy-d8.mjs`:
  - Añadido punto de entrada CLI funcional (`if (import.meta.url === pathToFileURL(process.argv[1]).href)`).
  - Implementación rigurosa de `--check`, `--apply` y `--verify`.
  - Validación de migraciones previas (`0001_profile` a `0009_company_scope`), checksums del ledger, tablas creadas, 3 enums, funciones privadas de seguridad y políticas RLS para `equipo10_runtime`.
  - Verificación en remoto ejecutada en modo solo lectura (`--check`), reportando estado pendiente sin mutar la base remota.

---

## 3. Pruebas Realmente Ejecutadas y Resultados

### 1. Suite D8: Pruebas Dirigidas de Acompañamiento Independiente
Comando:
```bash
bun test tests/api/orientation-independent.test.ts
```
Resultado: **17 PASS / 0 FAIL / 82 expect() calls**
```text
(pass) 1. Joven lista orientadores habilitados activos [104.56ms]
(pass) 2. Joven solicita acompañamiento con versión concreta de ruta; idempotencia no duplica [727.19ms]
(pass) 3. Orientador asignado ve la solicitud en su bandeja de entrada [190.25ms]
(pass) 4. Orientador ajeno NO ve la solicitud asignada al otro orientador [409.37ms]
(pass) 5. Orientador consulta detalle autorizado: ruta, factibilidad C01 y datos minimizados [200.03ms]
(pass) 6. Orientador propone aclaración; joven la recibe y responde (aceptar/rechazar) [327.11ms]
(pass) 7. Plan INVIABLE no puede ser aprobado por orientador (regla determinista C01) [549.04ms]
(pass) 8. Intento de aprobar con versión obsoleta de plan falla con 409 OUTDATED_PLAN_VERSION [100.68ms]
(pass) 9. Ruta acompañada NO aprobada bloquea la reserva; aprobación válida permite reservar [647.73ms]
(pass) 10. Joven revoca acompañamiento; orientador pierde inmediatamente acceso por RLS y revocación no cancela reserva previa [470.26ms]
(pass) 11. AUDIT V01: Orientador no puede aprobar viabilidad con logística PENDING [383.74ms]
(pass) 12. AUDIT V02: Plan marcado como outdated rechaza aprobación [349.61ms]
(pass) 13. AUDIT V02: Modificación de versión de vacante invalida revisión dependiente [358.73ms]
(pass) 14. AUDIT V03: Reintento de revisión con misma clave no duplica registros ni efectos [625.73ms]
(pass) 15. AUDIT V04: Revisión motivada emite evidencia atómica en AuditEvent [415.64ms]
(pass) 16. AUDIT V05: Reserva procedente de ruta revocada exige revalidación, pero reserva independiente de la misma edición tras revocar queda habilitada [881.01ms]
(pass) 17. D8/D4 Integración: Reserva independiente de catálogo no se bloquea por ruta revocada de otra edición [296.48ms]

17 pass, 0 fail (Ran 17 tests across 1 file. [22.79s])
```

### 2. Suite de Auditoría D8
Comando:
```bash
bun test ./.local/verification-d1-d8/d8-audit.test.ts
```
Resultado: **16 PASS / 0 FAIL / 71 expect() calls**
- Todas las pruebas de frontera (V01 a V05) validadas exitosamente.

### 3. Regresión D4: Concurrencia, Bloqueos Atómicos e Idempotencia en Reservas
Comando:
```bash
bun test tests/api/reservations-concurrency.test.ts
```
Resultado: **10 PASS / 0 FAIL / 37 expect() calls** (cero regresiones en matriculación).

### 4. Regresión Planificador C01 y Agente A05
Comando:
```bash
bun test tests/api/c01-planner.test.ts tests/api/a05-regression.test.ts
```
Resultado: **17 PASS / 0 FAIL / 49 expect() calls** (8/8 planner, 9/9 A05).

### 5. Verificación de Despliegue D8 (CLI Modo Lectura)
Comando:
```bash
node scripts/deploy-d8.mjs --check
```
Resultado:
```json
{"status":"check_success","pending":["202610170010_independent_orientation"],"applied_now":[],"existing_business_rows_unchanged":true,"runtime_verified":false}
```
Exit code: 0.

### 6. Verificación de Tipos (Typecheck) y Compilación (Build)
Comandos:
```bash
bun x tsc --noEmit
bun run build
```
Resultados:
- `tsc --noEmit`: **Exit code 0** (0 errores de tipos en todo el proyecto).
- `vite build`: **Exit code 0** (generado en 1.78s).

---

## 4. Estado de Migración y Despliegue

- **Archivo de Migración:** [prisma/migrations/202610170010_independent_orientation/migration.sql](../prisma/migrations/202610170010_independent_orientation/migration.sql)
- **Script de Despliegue:** [scripts/deploy-d8.mjs](../scripts/deploy-d8.mjs)
- **Tablas en Esquema `app`:**
  1. `app.OrientationCounselor`
  2. `app.OrientationEngagement` (con `targetOpportunityVersion`)
  3. `app.OrientationReview`
  4. `app.OrientationClarification`
- **Políticas RLS Activas para `equipo10_runtime`:**
  - `OrientationCounselor_select_all`
  - `OrientationEngagement_counselor_select`
  - `OrientationEngagement_counselor_update`
  - `OrientationReview_select`
  - `OrientationReview_insert_counselor`
  - `OrientationClarification_select`
  - `learning_plan_counselor_access`
  - `learning_plan_step_counselor_access`
  - `learning_plan_explanation_counselor_access`
  - `profile_revision_counselor_access`
  - `constraints_counselor_access`
  - `candidate_profile_counselor_access`

---

## 5. Pendientes y Límites del Alcance

1. **Despliegue Supabase completado posteriormente por Codex:** migración 0010 aplicada y verificada; no hay pendientes en el helper D8. Esta verificación de esquema/runtime no sustituye el recorrido manual con cuentas reales.
2. **Aceptación Live de Supabase Auth:** Pendiente de validación manual en navegador.
3. **Evaluaciones de IA (E01–E20):** Se mantienen en estado `DISEÑADO_NO_EJECUTADO` conforme a los lineamientos del proyecto.
4. **Casos Avanzados de CU16:** Videollamadas o mensajería sincrónica en tiempo real quedan fuera del alcance acotado de D8.

---

## 6. Bitácora de Inteligencia Artificial

La bitácora [docs/BITACORA_IA.csv](BITACORA_IA.csv) ha sido actualizada con las entradas correspondientes a la corrección de los hallazgos D8 y la reserva independiente de la misma edición tras revocación, con autoría real de Gemini 3.8 Flash.

