# Plan de Ejecución D2 — Perfil Manual e Idempotencia (CU01 / CU16)

> **Diseño/plan de su etapa — conciliación 2026-10-17:** los pasos futuros y alternativas siguientes conservan su contexto original; no son una lista de todo lo que falta hoy. Implementación y pendientes vigentes en [ESTADO_ACTUAL.md](ESTADO_ACTUAL.md) y [cobertura CU](CASOS_DE_USO.md#cobertura-actual-por-caso). Los casos diseñados no se presentan como ejecutados.

> Alcance vigente aprobado por el usuario, 2026-10-17: D2 solo admite texto escrito/pegado y PDF digital con texto seleccionable en el recorrido del candidato. Imágenes/fotos, PDF escaneado/OCR y audio quedan pendientes para una ampliación posterior; no bloquean el cierre acotado de D2 ni se declaran implementados. Distinguir validación de cabeceras de extracción/transcripción real. Las afirmaciones históricas de cobertura de todos los formatos no describen la aceptación vigente. Cierre funcional del recorrido real del usuario pendiente de confirmar guardado tras la corrección P2028 y confirmación final del perfil.

Fecha: 2026-10-17. Estado: IMPLEMENTADO Y VERIFICADO EN PERSISTENCIA Y LOCALMENTE (D2-A1 a D2-A6, D2-B y D2-C1 a D2-C3 completados; 71 pruebas de API unitarias/de integración pasando, typecheck exit 0, build exit 0 y suite E2E Playwright lista). D2 no reabre el stack ni altera los contratos base.

## 1. Arquitectura y Reglas de Implementación D2

### 1.1 Tres capas sin abstracciones redundantes
- **Presentación (React/Vite)**: `apps/web/src/features/profile/` con componentes atómicos reutilizando `Controls.tsx`, sesión (`session.tsx`), tokens CSS (`theme.tsx`, `Controls.module.css`). Formularios controlados, hooks de estado y mutación con validación Zod homóloga a API. Sin estado global adicional.
- **Aplicación (Hono/Bun)**: `apps/api/src/modules/profile/` estructurado idénticamente a `identity/`: `profile.controller.ts` (valida HTTP/headers ETag/Idempotency-Key y DTOs Zod), `profile.service.ts` (reglas de negocio, invariantes y verificación de autoría de actor), `profile.module.ts` (cableado de dependencias).
- **Persistencia (Prisma / PostgreSQL)**: `apps/api/src/infrastructure/database.ts` vía helper transaccional `database.withActor(actor, fn)` sobre el esquema existente (27 tablas, 18 enums en `prisma/schema.prisma`). No crear repositorios genéricos ni alterar nombres de esquema.

### 1.2 Reglas funcionales invariables
- **ETag / Concurrencia**: Todo `PATCH` o mutación de borrador exige cabecera `If-Match: <etag_opaco_servidor>`. El servidor trata el ETag como valor opaco sin prefijo débil impuesto en contrato y realiza comparación fuerte (`If-Match`). Si el borrador cambió en otra sesión/pestaña, responder `412 Precondition Failed` (`DRAFT_REVISION_CONFLICT`).
- **Idempotencia Transaccional**: `POST` a confirmaciones, decisiones y preview requiere `Idempotency-Key` (16–128 caracteres). Se almacena hash del payload. Misma clave + mismo payload devuelve el recibo persistido original (`200 OK` o `201 Created`). Misma clave + payload distinto devuelve `409 Conflict` (`IDEMPOTENCY_KEY_REUSED`). Búsqueda de operación deduplicada se evalúa antes de exigir borrador activo.
- **Aislamiento de IA**: No invocar agentes LLM ni Vertex dentro de transacciones de base de datos ni en la ruta crítica manual. Vertex en CLI de desarrollo es tooling asistido; el agente A02 de producto se integrará en D2-B de forma desacoplada.
- **Lógica de Dominio**: `0` es un valor numérico explícito válido (ej. presupuesto/minutos) y es estrictamente distinto de `unknown`/`null`.
- **Tokens y Contratos**: Zod schemas residen exclusivamente en `packages/contracts/src/index.ts`. No añadir dependencias externas.

---

## 2. Fases Verticales D2-A (Entrega Manual)

Cada subfase entrega verticalmente UI, Controller, Service y Persistencia probada.

### D2-A1: Identidad, Perfil Candidato y Borrador Base
- **Objetivo**: Inicializar candidato, consultar/crear borrador activo y UI de Cuenta con bloqueo de concurrencia.
- **Casos y Criterios**: CU01 (Paso 1 Figma 36:2/36:312), RP01, RP06, RP10, RP11.
- **Archivos Propuestos**:
  - `packages/contracts/src/index.ts` (schemas Zod: candidato, borrador, `PATCH` identity, ETag).
  - `apps/api/src/modules/profile/profile.controller.ts`, `profile.service.ts`, `profile.module.ts`.
  - `apps/api/src/app.ts` (montar `/api/v1/me/candidate-profile*`).
  - `apps/web/src/lib/api.ts` (llamadas con cabeceras `If-Match` y auth).
  - `apps/web/src/features/profile/useDraft.ts`, `AccountStep.tsx`.
- **Contratos API Existentes**: `GET /me`, `PUT /me/candidate-profile`, `GET /me/candidate-profile`, `POST /me/candidate-profile/drafts`, `GET /me/candidate-profile/draft`, `PATCH /me/candidate-profile/draft` (`section: identity`).
- **Estrategia de Prueba**: Test de integración en contenedor Docker (puerto 55435): inicializar candidato, emitir `PATCH` simultáneo con mismo ETag verificando `412` en la colisión.
- **Criterio de Parada (STOP)**: Falla de unicidad de usuario o colisión concurrente sin emitir error `412`.
- **Dependencias**: D1 completado (entorno BD Docker y esquema Prisma existente).

### D2-A2: Experiencia, Formación e Intereses
- **Objetivo**: Registro manual de experiencias (formales/informales), formación e intereses de puesto sin requerir CV ni IA.
- **Casos y Criterios**: CU01 (Paso 2 Figma 36:78/36:388), RP02, RP05, RP13.
- **Archivos Propuestos**:
  - `packages/contracts/src/index.ts` (schemas de experience, training, interests, claims manuales).
  - `apps/api/src/modules/profile/profile.service.ts` (validación de fechas YYYY-MM, orden cronológico, límites cardinales).
  - `apps/web/src/features/profile/ExperienceStep.tsx`, `ExperienceList.tsx`, `TrainingList.tsx`, `InterestsList.tsx`.
- **Contratos API Existentes**: `PATCH /me/candidate-profile/draft` (`section: experience | training | interests`), `POST /me/candidate-profile/draft/section-reviews`.
- **Estrategia de Prueba**: Inserción de fechas invertidas o arrays inconsistentes devuelve 400 con path exacto; perfil sin experiencia marca `experience_status="none"` limpiamente.
- **Criterio de Parada (STOP)**: Admisión de fechas futuras para cursos completados o guardado parcial ante error de validación.
- **Dependencias**: D2-A1.

### D2-A3: Disponibilidad, Movilidad y Logística
- **Objetivo**: Captura de ventanas horarias ISO 1-7, zona horaria, transporte, salario y presupuestos diferenciando explícitamente `0` de `unknown`.
- **Casos y Criterios**: CU01 (Paso 3 Figma 36:156/36:466), RP03, RP05.
- **Archivos Propuestos**:
  - `packages/contracts/src/index.ts` (schemas availability windows, constraints, monetary strings con 2 decimales).
  - `apps/api/src/modules/profile/profile.service.ts` (validación solapamiento de ventanas, parser decimal seguro).
  - `apps/web/src/features/profile/AvailabilityStep.tsx`, `TimeWindowEditor.tsx`, `ConstraintsEditor.tsx`.
- **Contratos API Existentes**: `PATCH /me/candidate-profile/draft` (`section: availability | constraints`), `POST /me/candidate-profile/draft/section-reviews`.
- **Estrategia de Prueba**: Enviar `mobility.max_one_way_minutes=0` verifica persistencia de límite cero; enviar `-1` o exponentes devuelve 400; solapamiento de ventana horaria es rechazado.
- **Criterio de Parada (STOP)**: Coerción automática de `unknown` a `0` o cálculo de sumas en punto flotante binario.
- **Dependencias**: D2-A2.

### D2-A4: Revisión, Digest y Preview
- **Objetivo**: Generar digest inmutable y snapshot temporal (15 min) para revisión consciente del joven antes de confirmar.
- **Casos y Criterios**: CU01 (Paso 4 Figma 36:234/36:544), RP07, RP20.
- **Archivos Propuestos**:
  - `packages/contracts/src/index.ts` (schemas preview, digest, decision review).
  - `apps/api/src/modules/profile/profile.service.ts` (cálculo de snapshot SHA-256, deduplicación de preview temporal).
  - `apps/web/src/features/profile/ReviewStep.tsx`, `MissingFieldsNotice.tsx`.
- **Contratos API Existentes**: `POST /me/candidate-profile/draft/review-previews` (con ETag y clave), `GET /me/candidate-profile/draft`.
- **Estrategia de Prueba**: Mutar el borrador invalida el preview previo; confirmar con preview caducado o digest no coincidente devuelve 422/409.
- **Criterio de Parada (STOP)**: Preview que permita incorporar sugerencias no aceptadas o que ignore revisiones pendientes.
- **Dependencias**: D2-A3.

### D2-A5: Confirmación Transaccional, Idempotencia y Recibos
- **Objetivo**: Transición atómica de borrador a `ProfileVersion` inmutable, registro de `ProfileConfirmation` y cierre de borrador bajo idempotencia estricta.
- **Casos y Criterios**: CU01, CU16, RP08, RP09, RP16.
- **Archivos Propuestos**:
  - `packages/contracts/src/index.ts` (schemas confirmation request, receipt response).
  - `apps/api/src/modules/profile/profile.service.ts` (transacción atómica con `database.withActor`, generación de recibo UUID).
  - `apps/web/src/features/profile/ConfirmationHandler.tsx`, `useConfirmation.ts`.
- **Contratos API Existentes**: `POST /me/candidate-profile/confirmations`, `GET /me/candidate-profile/versions/{version_id}`, `GET /me/profile-operations/{receipt_id}`.
- **Estrategia de Prueba**: Prueba concurrente de dos solicitudes con idéntica `Idempotency-Key`: exactamente una ejecuta la creación de versión; ambas reciben el mismo recibo (`201` y `200`). Misma clave con distinto cuerpo devuelve `409`.
- **Criterio de Parada (STOP)**: Generación de dos versiones confirmadas para un mismo borrador o fallo de auditoría que no cancele la confirmación.
- **Dependencias**: D2-A4.

### D2-A6: Pantalla de Inicio, Pruebas E2E y Cierre D2-A
- **Objetivo**: Visualización de pantalla Inicio vacía basada en datos reales confirmados (sin cursos ni citas falsas), validación responsive claro/oscuro y suite automatizada.
- **Casos y Criterios**: CU01 (Figma 43:925), RP17, RP19, RP20.
- **Archivos Propuestos**:
  - `apps/web/src/features/home/HomePage.tsx`.
  - `apps/web/src/features/profile/ProfileRouter.tsx`.
  - `tests/e2e/profile-flow.spec.ts` (Playwright fixture con autenticación simulada explícita, sin depender de Auth en vivo).
- **Contratos API Existentes**: `GET /me/candidate-profile`, `GET /me/candidate-profile/activity`.
- **Estrategia de Prueba**: Ejecución E2E de navegador real completando el flujo de 4 pasos, revisando contrastes de accesibilidad (320px/390px/escritorio) y persistencia del estado en pantalla final.
- **Criterio de Parada (STOP)**: Contenido inventado en pantalla de Inicio o rotura de navegación por teclado.
- **Dependencias**: D2-A5.

---

## 3. Matriz de Cobertura de Criterios (RP01 – RP20)

| Grupo | Criterios RP | Fase Asignada | Estado | Cobertura Funcional |
|---|---|---|---|---|
| Acceso y Autorización | RP01, RP10, RP11 | D2-A1 | Implementado y Verificado | Sesión validada en servidor; aislamiento estricto de recursos ajenos (404 opaco); roles protegidos. |
| Integridad Manual | RP02, RP03, RP05, RP13 (manual) | D2-A2, D2-A3 | Implementado y Verificado | Perfil sin CV/experiencia admitido; competencias manuales y evidencia declarada (subconjunto manual RP13 en A2; RP13 completo con IA en D2-B); unknown ≠ 0; rechazo de números inválidos/solapamientos. |
| Concurrencia y Versión | RP06, RP07, RP16 | D2-A1, D2-A4, D2-A5 | Implementado y Verificado | ETag 412 en borrador; preview caduco bloquea confirmación; v1 queda congelada tras v2. |
| Idempotencia y Recibo | RP08, RP09 | D2-A5 | Implementado y Verificado | Idempotencia atómica en BD; recuperación de recibo tras timeout sin duplicar efectos. |
| Asincronía y Procesamiento IA | RP04, RP12, RP13, RP15, RP18 | D2-B | Implementado y Verificado | A02 como agente desacoplado; grants explícitos; sugerencias stale no aplicables; lote atómico. |
| Formatos y Extracción | RP14 | D2-C | Alcance acotado: texto y PDF digital | Imagen/foto, PDF escaneado/OCR y audio aplazados por decisión humana. No confundir validación binaria con extracción o transcripción implementada. |
| Interfaz y Navegación | RP17, RP19, RP20 | D2-A6 | Implementado y Verificado | Flujo manual operativo sin IA; Inicio sin datos ficticios; accesibilidad y contraste Figma v2. |

---

## 4. Próximos Bloques (D2-B y D2-C)

- **D2-B (Agente A02 Texto)**: Asignación a modelo `google-vertex/gemini-3.8-flash` desacoplado del motor HTTP de la app. Implementación de `POST /me/profile-interpretation-grants`, `POST /me/profile-interpretations`, `POST /me/candidate-profile/draft/suggestion-decisions` (lote atómico; en modo manual puro sin grant de IA, claim_id y run_id son null; aceptar sugerencia no equivale a competencia demostrada). Evals I02/I07 con fixtures sintéticos gold.
- **D2-C (Formatos Individuales)**: Para el cierre D2, texto y PDF digital mediante `POST /me/profile-sources`, con límites, fuentes, revisión y alternativa manual. Imágenes, PDF escaneado/OCR y audio se trasladan a una ampliación posterior con pruebas propias.

---

## 5. Primer Encargo Concreto: Orden D2-A1 (Plantilla Diligenciada)

```md
ID / etapa: D2-A1 — Inicialización de perfil candidato, borrador y control de concurrencia ETag
Objetivo observable: Endpoint y UI de cuenta que permitan crear candidato, inicializar borrador, actualizar display_name con ETag y rechazar mutaciones concurrentes desactualizadas con HTTP 412.
CU / RGN / requisitos: CU01 (Paso 1), RGN01, RGN02, RGN03, RP01, RP06, RP10, RP11.
Estado y dependencias listas: D1 completado (Docker PostgreSQL en puerto 55435, migraciones base aplicadas, schema Prisma 27 tablas). Sin liveAuth requerida (usar actor context autenticado en test fixture).
Decisiones adoptadas y dudas que bloquean este contrato: ETag derivado estrictamente de Draft.revision. No se crean membresías empresariales ni roles administrativos.

Referencias mínimas: docs/CONTRATO_REGISTRO_PERFIL.md (Secciones 1, 2, 3) y docs/API_REGISTRO_PERFIL.md (Secciones 1, 2).
Figma: cWPzNNsLPoUenKyfhf4Diu, nodo Cuenta 36:2 (claro) / 36:312 (oscuro).
Skill pertinente: Hono controllers + React UI tokens.
Modelo/proveedor previsto: BALTHASAR google-vertex/gemini-3.8-flash.
Integrador y revisión final: Integrador de Dominio / Validador Automatizado.

Archivos editables exactos por responsable:
- packages/contracts/src/index.ts
- apps/api/src/modules/profile/profile.controller.ts
- apps/api/src/modules/profile/profile.service.ts
- apps/api/src/modules/profile/profile.module.ts
- apps/api/src/app.ts
- apps/web/src/lib/api.ts
- apps/web/src/app/App.tsx
- apps/web/src/features/profile/AccountStep.tsx
- apps/web/src/features/profile/useDraft.ts
- tests/api/profile.test.ts
Archivos de lectura, callers e interfaces existentes:
- apps/api/src/infrastructure/database.ts
- apps/api/src/modules/identity/identity.service.ts
- apps/web/src/components/Controls.tsx
- apps/web/src/app/session.tsx
- apps/web/src/styles/tokens.css
- apps/web/src/app/theme.tsx

Contrato UI/API:
- GET /api/v1/me/candidate-profile -> 200 { data: ProfileView }
- POST /api/v1/me/candidate-profile/drafts -> Headers: Idempotency-Key. Body: { base_version_id: null | string } -> 201 al crear; 200 al recuperar borrador compatible; 409 ante base incompatible. Conservar request_id en el sobre real.
- PATCH /api/v1/me/candidate-profile/draft -> Headers: If-Match: <etag_opaco_servidor>. Body: { section: "identity", values: { display_name, headline } } -> 200 { data: DraftView } | 412 Precondition Failed.
Contrato dominio:
- CandidateProfile: owner_user_id único.
- ProfileDraft: revision autoincremental en cada mutación.
Identidad/ámbito por objeto y permisos de cada transición: ActorContext con user.id activo es el único autorizado para leer y mutar su borrador. Intentos ajenos retornan 404.
Fuentes, versión, confirmación y condiciones de invalidación: Draft mutado incrementa revision; ETag previo queda invalidado inmediatamente.
Agente/modo/herramientas: No aplica a D2-A1 (modo puramente manual).
Efecto persistido, idempotencia, concurrencia y recibo: Mutación atómica en BD. Manejo estricto de If-Match mediante comparación transaccional de Draft.revision.

Aceptación:
- PUT /me/candidate-profile es idempotente según contrato D1; no crea borradores. La inicialización de borrador requiere POST /me/candidate-profile/drafts con Idempotency-Key y base_version_id explícito (null si no hay versión).
- Dado un borrador activo, cuando dos clientes envían PATCH con If-Match: <etag_opaco_servidor>, la primera solicitud actualiza el borrador; la segunda devuelve 412 DRAFT_REVISION_CONFLICT sin alterar los datos.
Fixtures: Sintéticos en BD Docker aislada (test-db en puerto 55435).
Verificación: bun test tests/api/profile.test.ts ejecutado por el integrador.
Límites: Mantener unidad de cambio pequeña con los cambios necesarios en callers (incluyendo rutas y tests). No montar rutas duplicadas sobre identity: conservar PUT/GET existentes y acordar su proyección/delegación antes de extender GET; añadir los callers de identity a la orden si la integración los requiere. Detenerse inmediatamente ante fallos de tipado o error 500 no capturado.
Informe: status, files, interfaces, evidence, issues.
Registro: Bitácora de ejecución D2-A1.
```
