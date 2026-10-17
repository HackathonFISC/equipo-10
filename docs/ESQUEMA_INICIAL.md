# Esquema inicial del joven — D1, revisión 1

> **Diseño/plan de su etapa — conciliación 2026-10-17:** los pasos futuros y alternativas siguientes conservan su contexto original; no son una lista de todo lo que falta hoy. Implementación y pendientes vigentes en [ESTADO_ACTUAL.md](ESTADO_ACTUAL.md) y [cobertura CU](CASOS_DE_USO.md#cobertura-actual-por-caso). Los casos diseñados no se presentan como ejecutados.

> **ESTADO VIGENTE (2026-10-16)**: Esquema de base de datos D1 **IMPLEMENTADA Y VERIFICADA EN PERSISTENCIA Y LOCALMENTE; ACEPTACIÓN LIVE DE SUPABASE AUTH PENDIENTE DE VALIDACIÓN MANUAL**. Todo contenido posterior representa la propuesta inicial histórica; este bloque rige el estado de persistencia. Documento de cierre: [D1_BASE_IMPLEMENTADA.md](D1_BASE_IMPLEMENTADA.md). El catálogo activo en PostgreSQL real comprende exactamente 27 tablas en esquema `app`, 18 enums y 27 políticas RLS activas. Las migraciones `202610160001_profile` y `202610160002_identity_orgs` fueron aplicadas mediante `scripts/deploy-d1.mjs` (`--check`, `--apply`, `--verify`) sobre base existente; los comandos antiguos `deploy-db.mjs` (`--migrate`/`--runtime`) están archivados. Separación estricta de roles: `equipo10_api` (`LOGIN`) y `equipo10_runtime` (`NOLOGIN`, `NOINHERIT`, `NOBYPASSRLS`).

Fecha: 2026-10-16. Alcance: persistencia de CU01 manual y traza CU16; no toda la aplicación. Preparado con propuesta real de BALTHASAR/Gemini por Vertex y revisión/correcciones de Codex.

**Estado actual verificado (2026-10-16):** La migración `202610160001_profile` fue desplegada con éxito en la base de datos Supabase remota mediante `prisma migrate deploy` con certificado oficial CA (`sslcert`), creando las 25 tablas en el esquema `app` y registrando el hash SHA256 en `public._prisma_migrations`. Las 25 políticas RLS y el rol `equipo10_api` fueron aplicados y auditados transaccionalmente (ver `docs/DESPLIEGUE_BD.md`). El bootstrap de usuarios, la validación de JWT y la API HTTP permanecen como el siguiente bloque de implementación.

Referencias: [contrato de perfil](CONTRATO_REGISTRO_PERFIL.md), [API](API_REGISTRO_PERFIL.md), [datos y módulos](MODELO_DATOS_MODULOS_PROPUESTA.md), [ST01](STACK_TECNICO.md), [propuesta Vertex conservada](PROPUESTA_ESQUEMA_VERTEX.md). Artefactos: [schema Prisma](../prisma/schema.prisma), [migración](../prisma/migrations/202610160001_profile/migration.sql), [reglas SQL](../prisma/guards.sql), [pruebas](../scripts/test-schema.mjs), [configuración Prisma7](../prisma.config.ts).

## Decisiones físicas

25 modelos y 15 enumeraciones, todos en el esquema PostgreSQL **app**, separado de auth y public. Usuarios Auth se vinculan por authSubject UUID único; no contraseñas/tokens en dominio ni tablas del esquema auth modificadas.

| Grupo | Modelos |
|---|---|
| Identidad y perfil | AppUser, CandidateProfile, ProfileRevision |
| Datos declarados | ProfileExperience, TrainingDeclaration, JobInterest, CompetencyClaim |
| Catálogo versionado | CatalogVersion, OccupationEntry, OccupationAlias, CompetencyEntry, CompetencyAlias |
| Restricciones y horario | ProfileConstraints, AvailabilityWindow, AvailabilityException, ExceptionInterval |
| Procedencia/evidencia | ProfileSource, SourceFragment, ProfileEvidence, ProfileEvidenceLink |
| Revisión y efecto | SectionReview, ProfilePreview, ProfileConfirmation, OperationReceipt, AuditEvent |

`ProfileRevision` materializa los dos conceptos lógicos Draft/Version sin duplicar las colecciones: nace DRAFT, puede terminar CONFIRMED o DISCARDED. Al confirmar se congela la misma fila y sus hijos. Editar después crea un borrador nuevo copiando los datos de la versión vigente a filas nuevas; referencias a fuentes/evidencias inmutables pueden reutilizarse con permisos vigentes. Esto conserva snapshot y versiones, no permite editar la versión publicada por referencia compartida mutable.

Índice parcial garantiza un solo DRAFT por perfil; versión numerada única por perfil. CandidateProfile apunta solo a su versión confirmada; el puntero no puede borrarse ni retroceder y su propietario/ID no se reasignan. La base de un nuevo borrador debe ser la versión vigente o null cuando aún no existe.

Dinero Decimal(14,2): doce dígitos enteros y dos decimales, distinto de Decimal(12,2). Cada valor conocido tiene moneda/periodo; UNKNOWN implica null, cero confirmado es válido. El servicio valida escala antes de asignar al decimal para evitar redondeo silencioso. No convertir USD/PAB o periodos sin regla explícita.

Experiencia formal/informal/proyecto/voluntariado separada; formación es declarada, no finalización certificada por centro. Puesto de interés y competencia son catálogos distintos. Alias contextual puede ser ambiguo; no equivalencia global automática. IDs canónicos + versión de catálogo conservan significado histórico; entradas antiguas no se renombrarán en sitio.

EvidenceKind solo admite SELF_REPORT/DOCUMENT en esta fase. VERIFIED_EXERCISE queda para CU02 con verificador real; no puede insertarse ahora para simular dominio. Relación de evidencia exige exactamente un destino experiencia/formación/competencia con FK real; claves compuestas impiden unir perfil/revisión/evidencia de otro dueño. Solo claims aceptados y con evidencia pueden permanecer en la versión confirmada. Antes del preview, el servicio excluye propuestas rechazadas/diferidas y conserva su decisión mínima en auditoría; no las confirma globalmente.

## Qué garantiza cada capa

| Garantía | BD preparada | Servicio todavía por implementar |
|---|---|---|
| Identidad/propiedad | AuthSubject/propietario únicos e inmutables; FKs compuestas | Validar sesión Auth, usuario activo, dueño/ámbito en cada consulta y acción |
| ETag | Contador positivo e incremento exacto de uno por UPDATE del borrador | Comparar If-Match, agrupar cambios de hijos y subir contador una vez por acción; ningún cliente elige actor/versiones |
| Revisión | Preview inmutable con caducidad y revisión; 8 secciones y revisión final vigente al confirmar | Calcular snapshot/digest, invalidar revisión de secciones editadas, guardar decisiones humanas reales. Son 8 áreas de datos dentro de 4 pantallas, no 8 pasos nuevos |
| Confirmación | Recibo/actor/digest/preview/versiones, auditoría y puntero en la misma transacción; comprobación diferida al commit | Repetición misma clave/payload devuelve el mismo recibo; payload diferente se rechaza; recuperar resultado tras timeout |
| Historial | Confirmados/descartados e hijos inmutables, incluidos intervalos anidados; movimiento desde un padre congelado también bloqueado | Copiar a borrador nuevo; preservar trazabilidad y filtrar salidas por consentimiento |
| Horarios | Límites/intervalos, fechas, solapamiento de ventanas recurrentes e intervalos de excepciones | Límites de colecciones, horizonte y normalización de zonas/traslados; requisitos laborales y solver no forman parte de esta migración |
| Fuentes | Contenido original/fragmentos/evidencia inmutables; correcciones nuevas del mismo perfil; retirada no reescribe original | Validar MIME/tamaño/huella/contenido, extracción, políticas de retención, minimizar datos y almacenamiento privado |

La BD exige revisión final contra la revisión exacta y no deja cambiar campos del perfil al mismo tiempo que se confirma un preview previo. Los cambios de hijos por el backend deben pasar por el servicio con actualización de contador: estos triggers no sustituyen el contrato de ETag ni autentican al solicitante HTTP. El cálculo real del digest/completitud y la procedencia semántica no se deducen de un hash con formato válido.

La exclusión SQL de ventanas compara horarios locales del mismo calendario; el servicio debe normalizar zonas para comparar intervalos en zonas distintas y aplicar excepciones. No usar estas restricciones de guardado como sustituto del futuro motor C01 de factibilidad.

## Acceso cerrado al preparar despliegue

Migración habilita RLS en todas las tablas app y revoca acceso PUBLIC y roles anon/authenticated existentes; no crea políticas permisivas ni presupone auth.uid() en Prisma. Prueba local con rol no propietario y SELECT concedido confirma cero filas por ausencia de políticas.

**Esto protege por defecto; todavía no es la configuración de acceso operativo de la API.** Antes de desplegar: revisar rol de ejecución y rol de migración, grants/RLS efectivos, transacciones/contexto del actor y Storage. No usar el propietario de tablas como rol de ejecución para saltarse RLS. No se creó rol, contraseña o permiso remoto ni se afirma aislamiento de candidatos por API, porque la API aún no existe.

La migración crea app y todos sus objetos en una transacción con search_path explícito app/pg_catalog; falla si ese esquema ya existe para evitar tratar una base no vacía como una instalación nueva. El SQL base se generó con el motor usado por Prisma7.10.1; su salida usa nombres sin esquema y por eso fijamos el search_path explícito antes de crear objetos. Los guards se conservan aparte y se anexan a la migración: al regenerar hay que incluirlos, no perder índices parciales, triggers o revocaciones.

## Verificación real y límites

Validador/DMMF/formateador oficial correspondiente a Prisma7.10.1: esquema válido, 25 modelos y 15 enums. Instalación CLI completa en el repo falló por red/caché incompleta; se recuperaron herramientas aisladas fuera de OneDrive. El motor WASM de esquemas y las dependencias oficiales de @prisma/internals7.10.1 generaron SQL sin conectarse a Supabase. Su inicialización consultó metadatos en una instancia PGlite local; no se simuló una consulta remota exitosa.

Se ejecutó primero un borrador SQL generado con herramienta local6.19; se sustituyó por SQL del motor de Prisma7 antes de la verificación final. No se cambió el stack a Prisma6. Historial: la instalación CLI falló inicialmente en fechas previas por red/caché; posteriormente se completó `bun install --ignore-scripts --network-concurrency 4` (155 paquetes en 649.39s), generando `bun.lock` y validando exitosamente `prisma validate`, `prisma generate` y la importación de `PrismaClient` en Bun. Las políticas y roles de `PERMISOS_BD_API.md` fueron preparados localmente para las 25 tablas (archivo `prisma/runtime-access.sql`), pero no han sido aplicados en Supabase ni existe aún la API.

Pruebas aisladas en PostgreSQL/WASM PGlite0.4.3, sin .env ni URLs de BD: instalación limpia, FK entre dueños, valores monetarios, solapamientos, revisión/recibo/auditoría, rollback, historial y RLS (30 pruebas schema PASS y 12 pruebas runtime SQL PASS). Resultados definitivos en [verificación](VERIFICACION_ESQUEMA.md) y [permisos](PERMISOS_BD_API.md). No son E2E, evals de IA ni pruebas de concurrencia entre conexiones independientes. E01–E20 siguen sin resultados de producto.

Reproducir tras instalar dependencias fijadas:

```powershell
bun run db:validate
bun run test:schema
```

En esta PC se usó el módulo PGlite verificado contra integridad npm en un directorio local externo, pasándolo como primer argumento a `node scripts/test-schema.mjs`. No es dependencia vendorizada ni exige sustituir archivos del repositorio. Ejecutar desde su raíz. `prisma.config.ts` usa DIRECT_URL solo si existe; ausencia no cae silenciosamente a DATABASE_URL y los comandos estáticos no requieren conexión real.

## Revisión cruzada y correcciones

Gemini/BALTHASAR usó realmente `google-vertex/gemini-3.8-flash`, leyó CONTRATO_REGISTRO_PERFIL y API_REGISTRO_PERFIL y escribió PROPUESTA_ESQUEMA_VERTEX. Evidencia interna fuera del repo: `magi/contexto/ESQUEMA_PERFIL_BALTHASAR_20261016.json`. No afirmar ciclo completo de tres desarrolladores MAGI ni aprobación de un validador independiente de toda la implementación.

Codex integró y corrigió: datasource Prisma7 en config, generador prisma-client con salida explícita, precisión monetaria, fuentes/FKs relacionales, preview persistido (sin Redis/memoria como fuente única), identidad inmutable, mismo dueño/versión, congelación de ambos padres al mover hijos e intervalos de excepciones, cambio de contenido prohibido al confirmar, recibos/aprobación/auditoría/puntero atómicos, search_path y seguridad por defecto. La propuesta original contiene pseudocódigo y sintaxis anterior; conservarla como antecedente, no copiarla como esquema vigente.

## Siguiente bloque

La segunda llamada a BALTHASAR, de revisión final y solo lectura, agotó el tiempo permitido. Evidencia interna: `magi/contexto/REVISION_ESQUEMA_FINAL_VERTEX_20261016.json`. No produjo un dictamen utilizable. Se completó después una revisión acotada por bloques con BALTHASAR: ver resultados y límites en [verificación](VERIFICACION_ESQUEMA.md). Esto no invalida las pruebas SQL ejecutadas ni convierte la propuesta inicial en aprobación del esquema integrado.

La secuencia de revisión de estado, migración SQL inicial con rol migrador (`DIRECT_URL`), aprovisionamiento de roles de runtime y aplicación del script de permisos `runtime-access.sql` ya fue ejecutada y verificada exitosamente en Supabase. El siguiente bloque comprende el bootstrap controlado de datos iniciales y la API HTTP. A02 runs/grants/sugerencias se añaden en D2-B; vacantes, empresas, centros, rutas y reservas corresponden a dominios y etapas posteriores.
