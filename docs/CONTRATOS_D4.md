# Contratos D4 — Formación, Ruta y Reserva del Joven

Fecha: 2026-10-17.  
Estado: CONTRATOS FIJADOS PARA IMPLEMENTACIÓN D4.  
Alcance: Endpoints REST para catálogo de cursos, planificador de rutas C01, agente de orientación formativa A05 (Vertex AI Gemini 3.8 Flash), reserva atómica con control de concurrencia e idempotencia, y vista derivada de agenda.

---

## 1. Modelo de Datos y Estados

### 1.1 Entidades Principales en Esquema `app`

1. **`Course`**: Entidad de catálogo curricular propiedad de una organización de tipo `TRAINING_CENTER`.
   - `id`: UUID (PK)
   - `organizationId`: UUID (FK a `Organization`)
   - `code`: VarChar(50) (único)
   - `title`: VarChar(160)
   - `description`: VarChar(3000)
   - `active`: Boolean (default true)
   - `createdAt`, `updatedAt`: Timestamptz

2. **`CourseVersion`**: Versión curricular inmutable del curso con temario y resultados confirmados.
   - `id`: UUID (PK)
   - `courseId`: UUID (FK a `Course`)
   - `catalogVersionId`: UUID (FK a `CatalogVersion`)
   - `versionNumber`: Int (consecutivo por curso)
   - `syllabusText`: VarChar(5000)
   - `durationHours`: Int?
   - `confirmedAt`: Timestamptz

3. **`CourseLearningOutcome`**: Competencias o saberes que el curso enseña (resultado de aprendizaje esperado).
   - `id`: UUID (PK)
   - `courseVersionId`: UUID (FK a `CourseVersion`)
   - `competencyId`: UUID
   - `catalogVersionId`: UUID (FK compuesta a `CompetencyEntry`)
   - `description`: VarChar(1000)

4. **`CoursePrerequisite`**: Competencias indispensables o deseables de entrada para cursar la versión.
   - `id`: UUID (PK)
   - `courseVersionId`: UUID (FK a `CourseVersion`)
   - `competencyId`: UUID
   - `catalogVersionId`: UUID (FK compuesta a `CompetencyEntry`)
   - `essential`: Boolean (default true)
   - `description`: VarChar(1000)

5. **`CourseEdition`**: Oferta concreta con calendario, modalidad, precio y cupos reales.
   - `id`: UUID (PK)
   - `courseVersionId`: UUID (FK a `CourseVersion`)
   - `modality`: Enum `WorkplaceType` (`ON_SITE` | `REMOTE` | `HYBRID`)
   - `location`: VarChar(200)?
   - `startDate`: Date
   - `endDate`: Date
   - `totalSlots`: Int (> 0)
   - `availableSlots`: Int (calculado o verificado contra reservas activas: `totalSlots - COUNT(activeReservations)`)
   - `costAmount`: Decimal(14,2)? (0.00 confirmado = gratuito; null = desconocido)
   - `costCurrency`: VarChar(3)? (ej. "USD")
   - `costPeriod`: Enum `MoneyPeriod`?
   - `scheduleSummary`: VarChar(200)
   - `active`: Boolean (default true)
   - `isDemo`: Boolean (default true)
   - `version`: Int (default 1)
   - `publishedAt`: Timestamptz

6. **`CourseSession`**: Sesiones semanales o fechas fijas de la edición para cotejo horario.
   - `id`: UUID (PK)
   - `editionId`: UUID (FK a `CourseEdition`)
   - `weekday`: Int (1=Lunes a 7=Domingo ISO)
   - `startMinute`: Int (0–1439)
   - `endMinute`: Int (1–1440, end > start)
   - `timezone`: VarChar(50) (default 'America/Panama')
   - `location`: VarChar(200)?

7. **`LearningPlan`**: Plan formativo del candidato ligado a una meta de puesto o vacante de D3.
   - `id`: UUID (PK)
   - `profileId`: UUID (FK a `CandidateProfile`)
   - `revisionId`: UUID (FK a `ProfileRevision`)
   - `targetOpportunityId`: UUID? (FK a `Opportunity`)
   - `targetOccupationId`: UUID? (FK a `OccupationEntry`)
   - `status`: Enum `LearningPlanStatus` (`DRAFT`, `CALCULATED`, `CONFIRMED`, `SUPERSEDED`, `CANCELLED`)
   - `feasibility`: Enum `ComparisonFeasibility` (`VIABLE`, `CONDITIONAL`, `PENDING`, `INVIABLE`)
   - `coverageNumerator`: Int
   - `coverageDenominator`: Int
   - `totalCostAmount`: Decimal(14,2)?
   - `currency`: VarChar(3)?
   - `residualGap`: String[]
   - `assumptionsJson`: Json
   - `reasons`: String[]
   - `outdated`: Boolean (default false)
   - `version`: Int (default 1)
   - `confirmedAt`: Timestamptz?
   - `createdAt`: Timestamptz

8. **`LearningPlanStep`**: Pasos ordenados que componen la ruta formativa propuesta/confirmada.
   - `id`: UUID (PK)
   - `planId`: UUID (FK a `LearningPlan`, cascade)
   - `editionId`: UUID (FK a `CourseEdition`)
   - `stepOrder`: Int
   - `stepType`: Enum `PlanStepType` (`DIRECT`, `CONDITIONAL`)
   - `conditionalPrerequisiteDescription`: VarChar(500)?

9. **`LearningPlanExplanation`**: Explicación generada por el agente orientador formativo A05.
   - `id`: UUID (PK)
   - `planId`: UUID (FK a `LearningPlan`, cascade)
   - `actorUserId`: UUID (FK a `AppUser`)
   - `agentId`: VarChar(20) ("A05")
   - `contractVersion`: VarChar(30) ("agent-result/1")
   - `status`: VarChar(30) ("completed")
   - `summary`: VarChar(2000)
   - `decisionJson`: Json
   - `missingFieldsJson`: Json
   - `questionsJson`: Json
   - `tokenUsage`: Json?
   - `consentGranted`: Boolean
   - `createdAt`: Timestamptz

10. **`CourseReservation`**: Reserva de plaza confirmada del candidato en una edición.
    - `id`: UUID (PK)
    - `profileId`: UUID (FK a `CandidateProfile`)
    - `editionId`: UUID (FK a `CourseEdition`)
    - `planId`: UUID? (FK a `LearningPlan`)
    - `status`: Enum `ReservationStatus` (`CONFIRMED`, `CANCELLED`, `COMPLETED`)
    - `reservationNumber`: VarChar(40) (código legible ej. "RES-PA-2026-XXXX")
    - `cancellationReason`: VarChar(500)?
    - `cancelledAt`: Timestamptz?
    - `createdAt`: Timestamptz
    - **Restricción de unicidad parcial en PostgreSQL**:
      `CREATE UNIQUE INDEX "CourseReservation_active_candidate_edition_unique" ON app."CourseReservation" ("profileId", "editionId") WHERE "status" = 'CONFIRMED';`

---

## 2. Endpoints HTTP API (apps/api)

Todos los endpoints respetan el envelope estándar `{ "data": { ... }, "request_id": "uuid" }` o `{ "error": { "code", "message" }, "request_id": "uuid" }`.

### 2.1 Catálogo y Cursos

#### `GET /api/v1/courses`
Consulta el catálogo de cursos publicados con sus ediciones disponibles.
- **Query Params**:
  - `q` (string, max 100, opcional)
  - `competency_id` (uuid, opcional)
  - `modality` (`ON_SITE` | `REMOTE` | `HYBRID`, opcional)
  - `limit` (int, default 20), `offset` (int, default 0)
- **Respuesta 200**:
  ```json
  {
    "data": {
      "items": [
        {
          "id": "uuid",
          "code": "CUR-INV-01",
          "title": "Control y Gestión de Inventarios Básicos",
          "description": "Curso práctico sobre registro de entradas, salidas y kardex.",
          "organization": {
            "id": "uuid",
            "name": "Centro de Capacitación Laboral UTP"
          },
          "active_editions_count": 2,
          "next_start_date": "2026-11-01",
          "is_demo": true
        }
      ],
      "pagination": { "total": 1, "limit": 20, "offset": 0 }
    }
  }
  ```

#### `GET /api/v1/courses/:id`
Detalle curricular completo de un curso, resultados de aprendizaje esperados, prerrequisitos y ediciones publicadas con sesiones.
- **Respuesta 200**:
  ```json
  {
    "data": {
      "id": "uuid",
      "code": "CUR-INV-01",
      "title": "Control y Gestión de Inventarios Básicos",
      "description": "Curso práctico sobre registro de entradas, salidas y kardex.",
      "organization": {
        "id": "uuid",
        "name": "Centro de Capacitación Laboral UTP"
      },
      "version": {
        "id": "uuid",
        "version_number": 1,
        "syllabus_text": "Módulo 1: Almacén. Módulo 2: Kardex...",
        "duration_hours": 40
      },
      "learning_outcomes": [
        {
          "id": "uuid",
          "competency_id": "uuid",
          "competency_name": "Registro de inventario",
          "description": "Capacidad de registrar movimientos en kardex digital"
        }
      ],
      "prerequisites": [
        {
          "id": "uuid",
          "competency_id": "uuid",
          "competency_name": "Operaciones aritméticas básicas",
          "essential": true,
          "description": "Manejo de sumas y restas para balance de inventario"
        }
      ],
      "editions": [
        {
          "id": "uuid",
          "modality": "ON_SITE",
          "location": "Sede Central UTP, Aula B-12",
          "start_date": "2026-11-01",
          "end_date": "2026-11-28",
          "total_slots": 15,
          "available_slots": 4,
          "cost_amount": "0.00",
          "cost_currency": "USD",
          "cost_period": "MONTH",
          "schedule_summary": "Sábados 08:00 - 12:00",
          "sessions": [
            {
              "weekday": 6,
              "start_minute": 480,
              "end_minute": 720,
              "timezone": "America/Panama",
              "location": "Aula B-12"
            }
          ]
        }
      ]
    }
  }
  ```

---

### 2.2 Planificador de Rutas C01 y Agente A05

#### `POST /api/v1/me/learning-plans/preview`
Calcula rutas formativas posibles mediante C01 combinando ediciones para cerrar brechas del candidato.
- **Headers**:
  - `Authorization: Bearer <token>`
  - `Idempotency-Key: <key>`
- **Body**:
  ```json
  {
    "target_opportunity_id": "uuid (opcional si proviene de D3)",
    "target_occupation_id": "uuid (opcional)",
    "assumptions": {
      "commute_minutes": 30,
      "max_budget_amount": "50.00"
    }
  }
  ```
- **Respuesta 201 / 200**:
  ```json
  {
    "data": {
      "id": "uuid",
      "status": "CALCULATED",
      "feasibility": "VIABLE",
      "coverage_numerator": 1,
      "coverage_denominator": 1,
      "total_cost_amount": "0.00",
      "currency": "USD",
      "residual_gap": [],
      "reasons": [
        "El plan cubre el 100% de las competencias requeridas pendientes.",
        "Horarios compatibles con la disponibilidad semanal del candidato.",
        "Costo total dentro del presupuesto declarado."
      ],
      "steps": [
        {
          "step_order": 1,
          "edition_id": "uuid",
          "course_title": "Control y Gestión de Inventarios Básicos",
          "step_type": "DIRECT",
          "schedule_summary": "Sábados 08:00 - 12:00",
          "cost_amount": "0.00",
          "currency": "USD"
        }
      ],
      "outdated": false,
      "created_at": "2026-10-17T00:00:00.000Z"
    }
  }
  ```

#### `POST /api/v1/me/learning-plans/:id/explanations`
Solicita al Agente A05 una explicación inteligente de la ruta formativa calculada mediante Vertex AI Gemini 3.8 Flash.
- **Headers**:
  - `Authorization: Bearer <token>`
  - `Idempotency-Key: <key>`
- **Body**:
  ```json
  {
    "consent": true,
    "answers": [
      { "field": "transporte", "text": "Puedo desplazarme en metro línea 1" }
    ]
  }
  ```
- **Respuesta 201**: Retorna `OpportunityExplanationView` adaptada a planes (`contract_version: "agent-result/1"`, `agent_id: "A05"`).
- **Error 503 `VERTEX_UNAVAILABLE`**: Si Vertex AI falla o está inactivo, el plan C01 se conserva intacto y no hay fallback silencioso.

#### `POST /api/v1/me/learning-plans/:id/confirmations`
El candidato confirma una versión exacta de su plan formativo. No descuenta plazas ni reserva ediciones.
- **Headers**:
  - `Authorization: Bearer <token>`
  - `If-Match: "<version>"`
  - `Idempotency-Key: <key>`
- **Respuesta 200**: Retorna el plan confirmado (`status: "CONFIRMED"`).

#### `GET /api/v1/me/learning-plans` y `GET /api/v1/me/learning-plans/:id`
Consulta los planes formativos del candidato con estado de desactualización (`outdated`).

---

### 2.3 Reservas Atómicas y Cancelaciones

#### `POST /api/v1/me/course-reservations`
Confirma la reserva de una plaza en una edición concreta.
- **Headers**:
  - `Authorization: Bearer <token>`
  - `Idempotency-Key: <key>`
- **Body**:
  ```json
  {
    "edition_id": "uuid",
    "plan_id": "uuid (opcional)"
  }
  ```
- **Reglas transaccionales**:
  1. Serialización del candidato y bloqueo pesimista de la fila `CourseEdition` (`FOR UPDATE`).
  2. Comprobación de capacidad viva: `totalSlots - COUNT(activeReservations) > 0`. Si no hay cupo: 409 `NO_AVAILABLE_SLOTS`.
  3. Revalidación de prerrequisitos actuales: El candidato debe contar con evidencia demostrada (`ACCEPTED` + `hasEvidence: true`) para prerrequisitos esenciales. Si no: 409 `PREREQUISITE_NOT_MET`.
  4. Cotejo contra reservas activas previas: Si hay conflicto horario con otra edición ya reservada por el candidato: 409 `SCHEDULE_COLLISION`.
  5. Inserción atómica de `CourseReservation` (`CONFIRMED`), `OperationReceipt` y `AuditEvent` (`CU12`).
- **Respuesta 201**:
  ```json
  {
    "data": {
      "id": "uuid",
      "reservation_number": "RES-PA-2026-0042",
      "edition_id": "uuid",
      "course_title": "Control y Gestión de Inventarios Básicos",
      "status": "CONFIRMED",
      "schedule_summary": "Sábados 08:00 - 12:00",
      "remaining_slots": 3,
      "receipt_id": "uuid",
      "created_at": "2026-10-17T00:00:00.000Z"
    }
  }
  ```

#### `POST /api/v1/me/course-reservations/:id/cancellations`
Cancela una reserva confirmada liberando exactamente 1 plaza.
- **Headers**:
  - `Authorization: Bearer <token>`
  - `Idempotency-Key: <key>`
- **Body**:
  ```json
  {
    "reason": "Conflicto de horario imprevisto con mi empleo de medio tiempo"
  }
  ```
- **Reglas**:
  - Si la reserva ya estaba cancelada y se repite la misma clave o nueva petición: respuesta idempotente 200 sin liberar una segunda plaza.
  - Genera `OperationReceipt` y `AuditEvent` (`CU15`).
- **Respuesta 200**:
  ```json
  {
    "data": {
      "id": "uuid",
      "status": "CANCELLED",
      "cancelled_at": "2026-10-17T00:00:00.000Z",
      "cancellation_reason": "Conflicto de horario imprevisto...",
      "receipt_id": "uuid"
    }
  }
  ```

#### `GET /api/v1/me/course-reservations` y `GET /api/v1/me/course-reservations/:id`
Lista y consulta reservas propias del candidato.

#### `GET /api/v1/me/course-reservation-operations/:key`
Recupera el resultado de una operación de reserva o cancelación por su clave de idempotencia ante cortes de red.

---

### 2.4 Agenda Derivada

#### `GET /api/v1/me/agenda`
Devuelve el cronograma de sesiones derivado estrictamente de las reservas activas confirmadas (`status: "CONFIRMED"`). No existe una agenda independiente duplicada ni editable.
- **Respuesta 200**:
  ```json
  {
    "data": {
      "events": [
        {
          "id": "uuid",
          "reservation_id": "uuid",
          "course_title": "Control y Gestión de Inventarios Básicos",
          "weekday": 6,
          "start_minute": 480,
          "end_minute": 720,
          "start_time": "08:00",
          "end_time": "12:00",
          "location": "Sede Central UTP, Aula B-12",
          "timezone": "America/Panama",
          "status": "CONFIRMED"
        }
      ]
    }
  }
  ```

---

## 3. Firmas del Motor Planificador C01

```ts
export interface CoursePlannerInput {
  candidateProfile: {
    id: string;
    revisionId: string;
    claims: Array<{
      competencyId: string;
      catalogVersionId: string;
      decision: "ACCEPTED" | "PROPOSED" | "REJECTED" | "DEFERRED";
      hasEvidence: boolean;
    }>;
    availabilityWindows: Array<{
      weekday: number; // 1..7 ISO
      startMinute: number;
      endMinute: number;
    }>;
    constraints: {
      travelLimitState?: "KNOWN" | "UNKNOWN";
      maxOneWayMinutes?: number | null;
      salaryState?: "KNOWN" | "UNKNOWN";
      budgetState?: "KNOWN" | "UNKNOWN";
      maxBudgetAmount?: number | null;
      budgetCurrency?: string | null;
    } | null;
    activeReservations?: Array<{
      editionId: string;
      sessions: Array<{
        weekday: number;
        startMinute: number;
        endMinute: number;
      }>;
    }>;
  };
  targetRequirements: Array<{
    competencyId: string;
    catalogVersionId: string;
    requirementType: "ESSENTIAL" | "DESIRABLE";
    stage: "ENTRY" | "TRAINABLE";
    description?: string;
  }>;
  availableEditions: Array<{
    id: string;
    courseId: string;
    courseTitle: string;
    courseVersionId: string;
    startDate: string;
    endDate: string;
    costAmount: number | null; // null = desconocido
    costCurrency: string | null;
    costPeriod: string | null;
    totalSlots: number;
    availableSlots: number;
    sessions: Array<{
      weekday: number;
      startMinute: number;
      endMinute: number;
      location?: string | null;
    }>;
    learningOutcomes: Array<{
      competencyId: string;
      catalogVersionId: string;
    }>;
    prerequisites: Array<{
      competencyId: string;
      catalogVersionId: string;
      essential: boolean;
    }>;
  }>;
  assumptions?: {
    commuteMinutes?: number;
    maxBudgetAmount?: number;
    horizonDays?: number; // default 30
  };
}

export interface CoursePlannerOutput {
  feasibility: "VIABLE" | "CONDITIONAL" | "PENDING" | "INVIABLE";
  coverageNumerator: number;
  coverageDenominator: number;
  totalCostAmount: number | null;
  currency: string | null;
  residualGap: string[]; // Competency IDs no cubiertas
  reasons: string[];
  bestPath: Array<{
    editionId: string;
    courseTitle: string;
    stepOrder: number;
    stepType: "DIRECT" | "CONDITIONAL";
    conditionalPrerequisiteDescription?: string;
    costAmount: number | null;
    currency: string | null;
  }>;
  alternativePathsCount: number;
}
```

### Reglas determinísticas C01 para D4:
1. **Límites de búsqueda en demo**:
   - Horizonte máximo: 30 días a partir de la fecha base.
   - Evaluación combinatoria de hasta 12 ediciones candidatas y rutas de hasta 3 ediciones.
2. **Criterios de descarte inmediato**:
   - Capacidad agotada: `availableSlots <= 0`.
   - Conflicto horario directo con la disponibilidad del candidato o con sesiones de ediciones ya reservadas en su agenda.
   - Presupuesto superado cuando tanto el costo como el presupuesto son conocidos y comparables en la misma divisa.
   - Prerrequisito esencial actual incumplido o desconocido en una edición de inicio.
3. **Precedencia y rutas condicionales**:
   - Si una edición $B$ exige una competencia que el candidato no tiene hoy, pero la edición $A$ (programada antes de $B$) la enseña en sus resultados de aprendizaje, el paso $B$ se marca como `CONDITIONAL`. Esto permite calcular la ruta, pero el sistema bloquea la reserva directa e inmediata de $B$ hasta que la condición se cumpla.
4. **Función objetivo y desempate**:
   - 1º: Maximizar cobertura de la brecha objetivo.
   - 2º: Minimizar costo total comparable.
   - 3º: Minimizar duración total en días.
   - 4º: Desempate determinista por ID de edición.

---

## 4. Herramientas del Agente A05 (Vertex AI Gemini 3.8 Flash)

El agente A05 opera en el bucle autónomo con las 5 herramientas declaradas y despachadas:

1. **`leer_meta_perfil`**:
   - Parámetros: `{ "profile_id": string }`
   - Retorna: Perfil confirmado, competencias acreditadas, disponibilidad semanal y restricciones de transporte y presupuesto.
2. **`buscar_ediciones`**:
   - Parámetros: `{ "competency_ids"?: string[], "modality"?: string, "max_cost"?: number }`
   - Retorna: Catálogo de ediciones activas con calendario, cupos, prerrequisitos y resultados de aprendizaje.
3. **`calcular_rutas`**:
   - Parámetros: `{ "assumptions"?: { "commute_minutes"?: number, "max_budget"?: number } }`
   - Retorna: Ejecución del motor C01 con factibilidad, mejor ruta, costos y brecha residual.
4. **`leer_resultado`**:
   - Parámetros: `{ "plan_id": string }`
   - Retorna: Detalle cuantitativo y razones generadas por el motor C01.
5. **`entregar_explicacion`**:
   - Parámetros: `{ "summary": string, "decision": { "feasibility": string, "code": string }, "missing_fields"?: string[], "questions"?: Array<{ "field": string, "text": string }> }`
   - Guarda el dictamen final para el candidato con guardrails contra contradicciones cuantitativas con C01.

---

## 5. Matriz de los 15 Casos de Aceptación (D4-01 a D4-15)

| Caso | Escenario | Resultado Esperado |
|---|---|---|
| **CASE-D4-01** | Ruta viable completa dentro de límites (horario, transporte y presupuesto compatibles) | `VIABLE`, cobertura 100%, pasos directos |
| **CASE-D4-02** | Ruta parcial cuando la oferta disponible no cubre toda la meta | `CONDITIONAL` o `PENDING`, brecha residual explícita |
| **CASE-D4-03** | Moneda o periodo de costo incomparables | Costo evaluado como incomparables, razones claras, no asumir gratuito |
| **CASE-D4-04** | Presupuesto insuficiente frente al costo del curso | `INVIABLE`, razón de presupuesto superado |
| **CASE-D4-05** | Costo o traslado desconocido en datos esenciales | `PENDIENTE`, nunca `VIABLE` |
| **CASE-D4-06** | Conflicto horario de edición con disponibilidad semanal o traslado | Descarte de edición incompatible, `INVIABLE` si no hay alternativa |
| **CASE-D4-07** | Prerrequisito actual esencial desconocido o ausente | `INVIABLE` para reserva directa de esa edición |
| **CASE-D4-08** | Prerrequisito futuro condicional (curso A enseña prerrequisito de curso B) | Ruta calculada como `CONDITIONAL`; reserva de B bloqueada |
| **CASE-D4-09** | Plan calculado queda obsoleto al cambiar perfil o edición | `outdated: true`, exige recálculo |
| **CASE-D4-10** | Dos candidatos compitiendo por la última plaza (1 cupo restante) | Exactamente 1 confirma (201), el otro recibe 409 `NO_AVAILABLE_SLOTS` |
| **CASE-D4-11** | Dos reservas simultáneas incompatibles del mismo candidato en horarios solapados | Serialización: una confirma (201) y la segunda rechaza por colisión (409) |
| **CASE-D4-12** | Reintento exacto con misma Idempotency-Key y mismo payload | 200 OK con el mismo registro y recibo de operación original |
| **CASE-D4-13** | Reintento con misma Idempotency-Key pero distinto payload | Error 409 `IDEMPOTENCY_CONFLICT` |
| **CASE-D4-14** | Cancelación repetida sobre una reserva ya cancelada | 200 OK idempotente; no libera una segunda plaza |
| **CASE-D4-15** | Acceso ajeno denegado (un candidato intenta ver o cancelar reserva de otro) | Error 404 multi-tenant |

---

## 6. Asignación de Archivos por Entrega

- **Entrega A (Catálogo y Cursos)**:
  - `prisma/schema.prisma` (modelos Course, CourseVersion, CourseLearningOutcome, CoursePrerequisite, CourseEdition, CourseSession)
  - `packages/contracts/src/index.ts` (DTOs y Schemas de cursos y ediciones)
  - `apps/api/src/modules/courses/courses.service.ts` y `courses.controller.ts`
  - `apps/api/src/modules/courses/courses.module.ts`
  - `apps/web/src/features/courses/*` (Catálogo en Explorar/Cursos, Detalle, Ediciones)
  - `tests/api/courses.test.ts`
- **Entrega B (Planificador C01 y Agente A05)**:
  - `apps/api/src/modules/planning/c01-planner.ts`
  - `apps/api/src/modules/planning/agent-a05.service.ts`
  - `apps/api/src/modules/planning/planning.service.ts` y `planning.controller.ts`
  - `apps/web/src/features/learning-route/*` (Mi ruta / Plan formativo)
  - `tests/api/c01-planner.test.ts`
  - `tests/api/a05-orientation.test.ts`
- **Entrega C (Reserva y Cancelación Seguras)**:
  - `apps/api/src/modules/reservations/reservations.service.ts` y `reservations.controller.ts`
  - `tests/api/reservations-concurrency.test.ts`
- **Entrega D (Mi ruta, Agenda y Activación)**:
  - `apps/api/src/modules/reservations/agenda.controller.ts`
  - `apps/web/src/features/agenda/*`
  - `scripts/deploy-d4.mjs`
  - `tests/api/a05-orientation-live.test.ts`
  - `tests/e2e/learning-route-flow.spec.ts`
  - `docs/BITACORA_IA.csv`
