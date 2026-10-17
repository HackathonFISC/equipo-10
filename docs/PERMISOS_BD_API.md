# Matriz de Seguridad y Permisos de Base de Datos (Bloque D1)

> **ESTADO VIGENTE (2026-10-16)**: El modelo de permisos D1 está **IMPLEMENTADA Y VERIFICADA EN PERSISTENCIA Y LOCALMENTE; ACEPTACIÓN LIVE DE SUPABASE AUTH PENDIENTE DE VALIDACIÓN MANUAL**. Las descripciones normativas posteriores deben interpretarse a la luz de este estado consolidado; este bloque prevalece. Detalle de verificación en [D1_BASE_IMPLEMENTADA.md](D1_BASE_IMPLEMENTADA.md). Implementación activa sobre 27 tablas y 18 enums: el rol de conexión es `equipo10_api` (`LOGIN`, `NOINHERIT`, `NOBYPASSRLS`), mientras que las transacciones y RLS se ejecutan bajo `equipo10_runtime` (`NOLOGIN`). En la API, el servidor valida credenciales llamando a `supabase.auth.getUser(token)` requiriendo email confirmado. Despliegues gestionados exclusivamente con `scripts/deploy-d1.mjs` (`--check`, `--apply`, `--verify`); scripts con `--migrate` y `--runtime` archivados.

## 1. Segregación de Roles

- **Bootstrap / Migrador (`postgres` / `migrator`)**: Dueño del esquema `app` y ejecutor de DDL, migraciones y seeds de catálogos. Puede ser un usuario no-superusuario que conserva acceso de gestión al no habilitarse `FORCE ROW LEVEL SECURITY`.
- **Rol de Runtime API (`equipo10_runtime`)**: Rol no interactivo con privilegios estrictamente mínimos: `NOLOGIN`, `NOINHERIT`, `NOSUPERUSER`, `NOCREATEROLE`, `NOCREATEDB`, `NOREPLICATION`, `NOBYPASSRLS`. No posee esquema, tablas, tipos ni funciones; no pertenece a ningún otro rol y no puede ejecutar DDL, `TRUNCATE`, `REFERENCES` ni `TRIGGER`.

## 2. Contrato de Contexto Transaccional (GUC)

1. **Validación JWT**: La API verifica la firma criptográfica, emisor (`issuer`), audiencia (`audience`) y caducidad (`exp`) del JWT, asegurando que la cuenta esté activa. El actor (`actor_user_id`) se obtiene exclusivamente de esta identidad validada, **nunca del cuerpo de la petición HTTP (`request body`)**.
2. **Resolución de Sujeto e Identidad**: Localiza o vincula `AppUser` activo (`status = 'ACTIVE'`) por `authSubject`. La creación inicial o alta de usuarios debe resolverse mediante un bootstrap o función controlada fuera de los permisos del rol de runtime API. No se utiliza el GUC `app.actor_user_id` para autorizar la creación libre de usuarios desde el cliente.
3. **Login y Bootstrap Separados**: Las operaciones de login de la API y de aprovisionamiento corren sin privilegios de owner, separadas de las transacciones operativas normales de runtime.
4. **Fijación de Contexto Transaccional**: En cada transacción de negocio, la API ejecuta:
   ```sql
   SET LOCAL ROLE equipo10_runtime;
   SELECT set_config('app.actor_user_id', $1, true);
   ```
   El parámetro `is_local = true` restringe el GUC estrictamente a la transacción activa, garantizando aislamiento y limpieza automática tanto al hacer `COMMIT` como al hacer `ROLLBACK`.
5. **Sin Contexto = Cero Acceso**: Si `app.actor_user_id` no está definido, está vacío o no es un UUID válido (error `22P02`), RLS bloquea todas las filas, **incluyendo los catálogos**.

*Nota sobre estado actual (2026-10-16)*: La segregación de roles y las 25 políticas RLS han sido desplegadas y verificadas en Supabase remoto mediante `scripts/deploy-db.mjs --runtime` y `--verify`. El rol `equipo10_api` está aprovisionado con contraseña criptográfica y membresía no heredable a `equipo10_runtime`. La verificación transaccional con rollback confirmó el aislamiento estricto sin dejar filas residuales. Sin embargo, el servicio HTTP de la API, la verificación de JWT y el bootstrap de usuarios `AppUser` aún NO están construidos ni expuestos; son el foco de la etapa inmediata.

## 3. Matriz de Privilegios por Tabla (25 Tablas)

| Grupo de Tablas | Tablas | Privilegios `equipo10_runtime` | Regla RLS |
|---|---|---|---|
| **Identidad** (1) | `AppUser` | `SELECT` | `id = app.actor_user_id()` |
| **Catálogos** (5) | `CatalogVersion`, `OccupationEntry`, `OccupationAlias`, `CompetencyEntry`, `CompetencyAlias` | `SELECT` | `app.actor_user_id() IS NOT NULL` (escritura solo migrador/owner) |
| **Perfil y Raíz** (2) | `CandidateProfile`, `ProfileRevision` | `SELECT, INSERT, UPDATE` | Perfil propio (`ownerUserId = actor`) |
| **Hijos de Revisión** (8) | `ProfileExperience`, `TrainingDeclaration`, `JobInterest`, `CompetencyClaim`, `ProfileConstraints`, `AvailabilityWindow`, `AvailabilityException`, `ProfileEvidenceLink` | `SELECT, INSERT, UPDATE, DELETE` | Perfil propio vía `profileId` mediante helper `app.is_candidate_profile_owner` |
| **Excepciones Anidadas** (1) | `ExceptionInterval` | `SELECT, INSERT, UPDATE, DELETE` | Perfil propio vía join con `AvailabilityException` |
| **Fuentes y Evidencia** (3) | `ProfileSource`, `SourceFragment`, `ProfileEvidence` | `ProfileSource`: `SELECT, INSERT, UPDATE`<br>`SourceFragment`, `ProfileEvidence`: `SELECT, INSERT` | Perfil propio vía `profileId` |
| **Revisión y Previo** (2) | `SectionReview`, `ProfilePreview` | `SectionReview`: `SELECT, INSERT, UPDATE, DELETE`<br>`ProfilePreview`: `SELECT, INSERT` | `SectionReview`: `actorUserId = actor` y revisión propia.<br>`ProfilePreview`: sin columna de actor directa; validado vía `revisionId` del perfil propio. |
| **Append-Only Auditoría** (3) | `ProfileConfirmation`, `OperationReceipt`, `AuditEvent` | `SELECT, INSERT` | `ProfileConfirmation`: `actorUserId = actor`, revisión del perfil propio, `previewId` coincidente y `operationId` perteneciente al actor/perfil propio.<br>`OperationReceipt`: `actorUserId = actor` y `profileId` propio si no es nulo.<br>`AuditEvent`: `actorUserId = actor`, `profileId` propio si no es nulo, y coherencia estricta de `revisionId` y `operationId` incluso cuando `profileId` es NULL. |

## 4. Procedimientos de Prueba Local

```bash
bun run test:runtime-access
```
La suite ejecutada arrojó **15 pruebas aprobadas (PASS)** (exit code 0) en PGlite en memoria:
- 3 pre-checks de aislamiento ejecutados: rechazo `28000` si el rol tiene `BYPASSRLS`, rechazo si posee membresía/herencia en otro rol, y rechazo `42710` con rollback limpio ante colisión de políticas existentes.
- 12 pruebas de acceso y RLS: validación de aislamiento de inquilinos (actores A y B), ausencia de contexto, denegación de DDL/TRUNCATE, ausencia de fugas tras `COMMIT` y `ROLLBACK`, no afectación en operaciones cruzadas y confirmación atómica bajo RLS.

Evidencia externa completa con hashes conservada en `magi/contexto/VERIFICACION_RUNTIME_D1_20261016.json`.
