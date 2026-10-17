# Propuesta de Esquema Inicial D1–D2 (Prisma 7 / PostgreSQL) — CU01

> **Diseño/plan de su etapa — conciliación 2026-10-17:** los pasos futuros y alternativas siguientes conservan su contexto original; no son una lista de todo lo que falta hoy. Implementación y pendientes vigentes en [ESTADO_ACTUAL.md](ESTADO_ACTUAL.md) y [cobertura CU](CASOS_DE_USO.md#cobertura-actual-por-caso). Los casos diseñados no se presentan como ejecutados.

**Autor:** BALTHASAR (Gemini por Vertex)  
**Estado:** Propuesta de arquitectura de datos para Codex / Integración  
**Alcance:** Ruta manual de registro y perfil (CU01). No incluye modelos A02 (runs, grants, sugerencias IA), los cuales se difieren a la migración subsiguiente.

---

## 1. Premisas Arquitectónicas y Estrategia de Persistencia

1. **Stack:** PostgreSQL sobre Supabase consumido mediante Prisma 7 con `@prisma/adapter-pg` en runtime Bun.
2. **Identidad:** `AppUser` mapea `auth_subject` (Supabase Auth). La capa de servicio deriva y valida el actor activo en cada petición. Se descarta RLS basado en `auth.uid()` ficticio para consultas backend, evitando acoplamiento al pooler.
3. **Normalización:** Se prohíbe el uso de `Json` como sustituto de relaciones de dominio. `Json` se restringe estrictamente a snapshots de recibos, metadatos variables de auditoría y `missing_fields`.
4. **Competencias y datos:** Sin puntuaciones globales arbitrarias ni contraseñas. Valores monetarios en `Decimal(12,2)`.

---

## 2. Modelo Unificado: `ProfileRevision` (Draft y Version)

Para evitar duplicar más de diez tablas hijas entre borrador y versión histórica, se materializa una única entidad relacional `ProfileRevision`:

- **Estados (`RevisionStatus`):** `DRAFT`, `CONFIRMED`, `DISCARDED`.
- **Concurrencia y ETag:** Campo `revision Int @default(1)` incrementado secuencialmente en cada mutación de borrador.
- **Numeración oficial:** `versionNumber Int?` asignado únicamente al confirmar (`status = CONFIRMED`).
- **Unicidad de borrador activo:** Se impone a nivel SQL mediante índice único parcial:
  ```sql
  CREATE UNIQUE INDEX uq_profile_active_draft 
  ON "ProfileRevision" (profile_id) 
  WHERE status = 'DRAFT';
  ```
- **Unicidad de versión:** `@@unique([profileId, versionNumber])` para revisiones confirmadas.

---

## 3. Definición de Modelos Prisma 7 (CU01 Manual)

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum UserStatus {
  ACTIVE
  DISABLED
}

enum RevisionStatus {
  DRAFT
  CONFIRMED
  DISCARDED
}

enum SectionReviewDecision {
  REVIEWED
  DEFERRED
}

enum SourceKind {
  MANUAL_TEXT
  PDF
  IMAGE
  AUDIO
}

enum SourceStatus {
  RECEIVED
  VALIDATED
  READY
  FAILED
  WITHDRAWN
}

model AppUser {
  id          String            @id @default(uuid()) @db.Uuid
  authSubject String            @unique @map("auth_subject") @db.VarChar(255)
  status      UserStatus        @default(ACTIVE)
  locale      String            @default("es") @db.VarChar(10)
  theme       String            @default("system") @db.VarChar(20)
  createdAt   DateTime          @default(now()) @map("created_at") @db.Timestamptz
  updatedAt   DateTime          @updatedAt @map("updated_at") @db.Timestamptz
  profile     CandidateProfile?

  @@map("app_users")
}

model CandidateProfile {
  id               String            @id @default(uuid()) @db.Uuid
  ownerUserId      String            @unique @map("owner_user_id") @db.Uuid
  currentVersionId String?           @unique @map("current_version_id") @db.Uuid
  createdAt        DateTime          @default(now()) @map("created_at") @db.Timestamptz
  updatedAt        DateTime          @updatedAt @map("updated_at") @db.Timestamptz

  owner            AppUser           @relation(fields: [ownerUserId], references: [id], onDelete: Restrict)
  currentVersion   ProfileRevision?  @relation("CurrentProfileVersion", fields: [currentVersionId], references: [id], onDelete: SetNull)
  revisions        ProfileRevision[] @relation("ProfileRevisions")
  sources          ProfileSource[]

  @@map("candidate_profiles")
}

model ProfileRevision {
  id               String                  @id @default(uuid()) @db.Uuid
  profileId        String                  @map("profile_id") @db.Uuid
  baseVersionId    String?                 @map("base_version_id") @db.Uuid
  status           RevisionStatus          @default(DRAFT)
  revision         Int                     @default(1)
  versionNumber    Int?                    @map("version_number")
  displayName      String                  @map("display_name") @db.VarChar(100)
  headline         String?                 @db.VarChar(160)
  snapshotDigest   String?                 @map("snapshot_digest") @db.VarChar(64)
  confirmedAt      DateTime?               @map("confirmed_at") @db.Timestamptz
  createdAt        DateTime                @default(now()) @map("created_at") @db.Timestamptz
  updatedAt        DateTime                @updatedAt @map("updated_at") @db.Timestamptz

  profile          CandidateProfile        @relation("ProfileRevisions", fields: [profileId], references: [id], onDelete: Cascade)
  activeForProfile CandidateProfile?       @relation("CurrentProfileVersion")
  baseVersion      ProfileRevision?        @relation("RevisionLineage", fields: [baseVersionId], references: [id], onDelete: Restrict)
  derivedRevisions ProfileRevision[]       @relation("RevisionLineage")

  experiences      ProfileExperience[]
  trainings        ProfileTraining[]
  jobInterests     ProfileJobInterest[]
  competencies     ProfileCompetencyClaim[]
  windows          AvailabilityWindow[]
  exceptions       AvailabilityException[]
  constraints      ProfileConstraint?
  sectionReviews   ProfileSectionReview[]
  confirmations    ProfileConfirmationAudit[]

  @@unique([profileId, versionNumber])
  @@index([profileId, status])
  @@map("profile_revisions")
}

model ProfileExperience {
  id               String          @id @default(uuid()) @db.Uuid
  revisionId       String          @map("revision_id") @db.Uuid
  kind             String          @db.VarChar(30)
  title            String          @db.VarChar(120)
  organizationName String?         @map("organization_name") @db.VarChar(160)
  description      String          @db.VarChar(3000)
  startMonth       String?         @map("start_month") @db.VarChar(7)
  endMonth         String?         @map("end_month") @db.VarChar(7)
  ongoing          Boolean         @default(false)
  createdAt        DateTime        @default(now()) @map("created_at") @db.Timestamptz

  revision         ProfileRevision @relation(fields: [revisionId], references: [id], onDelete: Cascade)

  @@index([revisionId])
  @@map("profile_experiences")
}

model ProfileTraining {
  id            String          @id @default(uuid()) @db.Uuid
  revisionId    String          @map("revision_id") @db.Uuid
  name          String          @db.VarChar(160)
  providerName  String?         @map("provider_name") @db.VarChar(160)
  completedOn   DateTime?       @map("completed_on") @db.Date
  status        String          @db.VarChar(30)
  createdAt     DateTime        @default(now()) @map("created_at") @db.Timestamptz

  revision      ProfileRevision @relation(fields: [revisionId], references: [id], onDelete: Cascade)

  @@index([revisionId])
  @@map("profile_trainings")
}

model ProfileJobInterest {
  id             String          @id @default(uuid()) @db.Uuid
  revisionId     String          @map("revision_id") @db.Uuid
  originalText   String          @map("original_text") @db.VarChar(160)
  occupationId   String?         @map("occupation_id") @db.Uuid
  catalogVersion String?         @map("catalog_version") @db.VarChar(30)
  createdAt      DateTime        @default(now()) @map("created_at") @db.Timestamptz

  revision       ProfileRevision @relation(fields: [revisionId], references: [id], onDelete: Cascade)

  @@index([revisionId])
  @@map("profile_job_interests")
}

model ProfileCompetencyClaim {
  id              String            @id @default(uuid()) @db.Uuid
  revisionId      String            @map("revision_id") @db.Uuid
  competencyId    String?           @map("competency_id") @db.Uuid
  catalogVersion  String?           @map("catalog_version") @db.VarChar(30)
  originalText    String            @map("original_text") @db.VarChar(300)
  criterion       String?           @db.VarChar(1000)
  decision        String            @default("proposed") @db.VarChar(20)
  createdAt       DateTime          @default(now()) @map("created_at") @db.Timestamptz

  revision        ProfileRevision   @relation(fields: [revisionId], references: [id], onDelete: Cascade)
  evidences       ProfileEvidence[]

  @@index([revisionId])
  @@map("profile_competency_claims")
}

model ProfileEvidence {
  id              String                 @id @default(uuid()) @db.Uuid
  claimId         String                 @map("claim_id") @db.Uuid
  sourceId        String?                @map("source_id") @db.Uuid
  fragmentId      String?                @map("fragment_id") @db.Uuid
  kind            String                 @db.VarChar(30)
  scope           String?                @db.VarChar(1000)
  createdAt       DateTime               @default(now()) @map("created_at") @db.Timestamptz

  claim           ProfileCompetencyClaim @relation(fields: [claimId], references: [id], onDelete: Cascade)
  source          ProfileSource?         @relation(fields: [sourceId], references: [id], onDelete: SetNull)
  fragment        SourceFragment?        @relation(fields: [fragmentId], references: [id], onDelete: SetNull)

  @@index([claimId])
  @@map("profile_evidences")
}

model AvailabilityWindow {
  id         String          @id @default(uuid()) @db.Uuid
  revisionId String          @map("revision_id") @db.Uuid
  weekday    Int             @db.SmallInt
  startTime  String          @map("start_time") @db.VarChar(5)
  endTime    String          @map("end_time") @db.VarChar(5)
  timezone   String          @default("America/Panama") @db.VarChar(50)
  validFrom  DateTime?       @map("valid_from") @db.Date
  validTo    DateTime?       @map("valid_to") @db.Date

  revision   ProfileRevision @relation(fields: [revisionId], references: [id], onDelete: Cascade)

  @@index([revisionId])
  @@map("availability_windows")
}

model AvailabilityException {
  id         String          @id @default(uuid()) @db.Uuid
  revisionId String          @map("revision_id") @db.Uuid
  date       DateTime        @db.Date
  intervals  Json            @default("[]")
  createdAt  DateTime        @default(now()) @map("created_at") @db.Timestamptz

  revision   ProfileRevision @relation(fields: [revisionId], references: [id], onDelete: Cascade)

  @@index([revisionId])
  @@map("availability_exceptions")
}

model ProfileConstraint {
  id                 String          @id @default(uuid()) @db.Uuid
  revisionId         String          @unique @map("revision_id") @db.Uuid
  locationApprox     String?         @map("location_approx") @db.VarChar(160)
  mobilityModes      String[]        @default([]) @map("mobility_modes")
  maxOneWayMinutes   Int?            @map("max_one_way_minutes")
  salaryMinimum      Decimal?        @map("salary_minimum") @db.Decimal(12, 2)
  salaryCurrency     String?         @map("salary_currency") @db.VarChar(3)
  salaryPeriod       String?         @map("salary_period") @db.VarChar(10)
  transportBudget    Decimal?        @map("transport_budget") @db.Decimal(12, 2)
  transportCurrency  String?         @map("transport_currency") @db.VarChar(3)
  transportPeriod    String?         @map("transport_period") @db.VarChar(10)
  trainingBudget     Decimal?        @map("training_budget") @db.Decimal(12, 2)
  trainingCurrency   String?         @map("training_currency") @db.VarChar(3)
  trainingPeriod     String?         @map("training_period") @db.VarChar(10)

  revision           ProfileRevision @relation(fields: [revisionId], references: [id], onDelete: Cascade)

  @@map("profile_constraints")
}

model ProfileSectionReview {
  id         String                @id @default(uuid()) @db.Uuid
  revisionId String                @map("revision_id") @db.Uuid
  section    String                @db.VarChar(30)
  decision   SectionReviewDecision
  reviewedAt DateTime              @default(now()) @map("reviewed_at") @db.Timestamptz

  revision   ProfileRevision       @relation(fields: [revisionId], references: [id], onDelete: Cascade)

  @@unique([revisionId, section])
  @@map("profile_section_reviews")
}

model ProfileSource {
  id          String            @id @default(uuid()) @db.Uuid
  profileId   String            @map("profile_id") @db.Uuid
  kind        SourceKind
  version     Int               @default(1)
  sha256      String            @db.VarChar(64)
  mediaType   String            @map("media_type") @db.VarChar(100)
  sizeBytes   Int               @map("size_bytes")
  storagePath String?           @map("storage_path") @db.VarChar(255)
  rawText     String?           @map("raw_text") @db.Text
  status      SourceStatus      @default(RECEIVED)
  createdAt   DateTime          @default(now()) @map("created_at") @db.Timestamptz

  profile     CandidateProfile  @relation(fields: [profileId], references: [id], onDelete: Cascade)
  fragments   SourceFragment[]
  evidences   ProfileEvidence[]

  @@index([profileId])
  @@map("profile_sources")
}

model SourceFragment {
  id          String            @id @default(uuid()) @db.Uuid
  sourceId    String            @map("source_id") @db.Uuid
  fragmentSeq Int               @map("fragment_seq")
  content     String            @db.Text
  pageNumber  Int?              @map("page_number")
  startSec    Int?              @map("start_sec")
  endSec      Int?              @map("end_sec")
  createdAt   DateTime          @default(now()) @map("created_at") @db.Timestamptz

  source      ProfileSource     @relation(fields: [sourceId], references: [id], onDelete: Cascade)
  evidences   ProfileEvidence[]

  @@unique([sourceId, fragmentSeq])
  @@map("source_fragments")
}

model IdempotencyRecord {
  id             String    @id @default(uuid()) @db.Uuid
  idempotencyKey String    @map("idempotency_key") @db.VarChar(128)
  actorUserId    String    @map("actor_user_id") @db.Uuid
  operation      String    @db.VarChar(60)
  payloadHash    String    @map("payload_hash") @db.VarChar(64)
  receiptPayload Json      @map("receipt_payload")
  createdAt      DateTime  @default(now()) @map("created_at") @db.Timestamptz

  @@unique([actorUserId, operation, idempotencyKey])
  @@map("idempotency_records")
}

model ProfileConfirmationAudit {
  id             String          @id @default(uuid()) @db.Uuid
  revisionId     String          @map("revision_id") @db.Uuid
  actorUserId    String          @map("actor_user_id") @db.Uuid
  previewRef     String          @map("preview_ref") @db.VarChar(128)
  snapshotDigest String          @map("snapshot_digest") @db.VarChar(64)
  confirmedAt    DateTime        @default(now()) @map("confirmed_at") @db.Timestamptz

  revision       ProfileRevision @relation(fields: [revisionId], references: [id], onDelete: Restrict)

  @@map("profile_confirmation_audits")
}
```

---

## 4. Disparadores SQL para Inmutabilidad e Integridad Estricta

Prisma no provee reglas declarativas de inmutabilidad en tiempo de ejecución. La migración SQL inicial debe incorporar los siguientes disparadores:

```sql
-- 1. Inmutabilidad de ProfileRevision una vez confirmada o descartada
CREATE OR REPLACE FUNCTION fn_enforce_revision_immutability()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IN ('CONFIRMED', 'DISCARDED') THEN
    RAISE EXCEPTION 'Revision % is immutable (status=%)', OLD.id, OLD.status;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_revision_immutability
BEFORE UPDATE OR DELETE ON profile_revisions
FOR EACH ROW EXECUTE FUNCTION fn_enforce_revision_immutability();

-- 2. Inmutabilidad de colecciones hijas asociadas a revisiones confirmadas
CREATE OR REPLACE FUNCTION fn_prevent_child_mutation_on_confirmed()
RETURNS TRIGGER AS $$
DECLARE
  v_status VARCHAR(20);
  v_rev_id UUID;
BEGIN
  v_rev_id := COALESCE(NEW.revision_id, OLD.revision_id);
  SELECT status INTO v_status FROM profile_revisions WHERE id = v_rev_id;
  IF v_status IN ('CONFIRMED', 'DISCARDED') THEN
    RAISE EXCEPTION 'Cannot modify child record: ProfileRevision % is %', v_rev_id, v_status;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Aplicar a cada tabla dependiente de revision_id
CREATE TRIGGER trg_exp_immutability
BEFORE INSERT OR UPDATE OR DELETE ON profile_experiences
FOR EACH ROW EXECUTE FUNCTION fn_prevent_child_mutation_on_confirmed();

CREATE TRIGGER trg_train_immutability
BEFORE INSERT OR UPDATE OR DELETE ON profile_trainings
FOR EACH ROW EXECUTE FUNCTION fn_prevent_child_mutation_on_confirmed();

CREATE TRIGGER trg_interest_immutability
BEFORE INSERT OR UPDATE OR DELETE ON profile_job_interests
FOR EACH ROW EXECUTE FUNCTION fn_prevent_child_mutation_on_confirmed();

CREATE TRIGGER trg_claim_immutability
BEFORE INSERT OR UPDATE OR DELETE ON profile_competency_claims
FOR EACH ROW EXECUTE FUNCTION fn_prevent_child_mutation_on_confirmed();

CREATE TRIGGER trg_window_immutability
BEFORE INSERT OR UPDATE OR DELETE ON availability_windows
FOR EACH ROW EXECUTE FUNCTION fn_prevent_child_mutation_on_confirmed();

CREATE TRIGGER trg_constraint_immutability
BEFORE INSERT OR UPDATE OR DELETE ON profile_constraints
FOR EACH ROW EXECUTE FUNCTION fn_prevent_child_mutation_on_confirmed();
```

---

## 5. Distribución de Responsabilidades: BD frente a Servicio

| Mecanismo | Responsable | Regla implementada |
|---|---|---|
| **Unicidad de borrador** | PostgreSQL (Índice parcial) | Exactamente 0..1 `DRAFT` por `profile_id`. |
| **Inmutabilidad de versiones** | PostgreSQL (Triggers) | Bloqueo absoluto de `UPDATE`/`DELETE` en confirmados y sus hijos. |
| **Integridad referencial y ETag** | BD + Servicio | BD incrementa `revision`; Servicio valida encabezado `If-Match`. |
| **Confirmación e Idempotencia** | Transacción de Servicio | Operación atómica: verificar `If-Match`, validar `preview_ref`, fijar `versionNumber`, actualizar `currentVersionId`, congelar borrador y registrar recibo en `idempotency_records`. |
| **Validez semántica y completitud** | Servicio | Verificación de fechas (`endMonth >= startMonth`), estados `none` vs colecciones vacías, y cómputo de `missing_fields`. |
| **Expiración de Previews** | Servicio / Redis / Memoria | Invalidez tras 15 minutos o ante cualquier cambio de `revision`. |

---

## 6. Opinión Crítica y Huecos Detectados

1. **Dependencia circular `CandidateProfile` ↔ `ProfileRevision`:**  
   `CandidateProfile.currentVersionId` apunta a `ProfileRevision`, mientras `ProfileRevision.profileId` apunta a `CandidateProfile`. Requiere que `currentVersionId` sea estrictamente `nullable` y que el borrador inicial se cree antes de poder fijar versión actual.
2. **Limitación de Prisma frente a DDL avanzado:**  
   Prisma 7 no representa nativamente índices parciales (`WHERE status = 'DRAFT'`) ni `TRIGGER` plpgsql en el archivo `.prisma`. Estas directivas deben mantenerse como código SQL explícito en migraciones bajo control de versiones (`prisma/migrations/`).
3. **Referencias cruzadas entre revisiones:**  
   Para evitar que un `ProfileEvidence` referencie un `SourceFragment` de otro usuario, o que una relación foránea mezcle revisiones distintas, la capa de servicio debe comprobar la propiedad del `profile_id` antes de enlazar IDs, respaldado por índices compuestos `(revision_id, id)`.
4. **Ausencia temporal de tablas A02:**  
   Al posponer `InterpretationRun`, `ProcessingGrant` y `Suggestion` para la fase IA, el frontend y la API manual operan sin dependencias bloqueantes, garantizando que el flujo CU01 funcione de extremo a extremo sin invocar modelos ni requerir credenciales externas.
