# Verificación del esquema inicial

Fecha: 2026-10-16. [Alcance y decisiones](ESQUEMA_INICIAL.md). Esquema válido con validador oficial del conjunto Prisma7.10.1: 25 modelos y 15 enumeraciones. Migración final generada con su motor de esquemas; no con Prisma6. Se añadió search_path app/pg_catalog explícito y guards SQL versionados.

## Ejecución local

Node24.13.0; PostgreSQL/WASM PGlite0.4.3 en memoria, sin .env, conexión a Supabase o datos reales. Comando: node scripts/test-schema.mjs con ruta del módulo PGlite externo verificado por integridad npm. Salida0.

**30 pruebas aprobadas.**

| Caso | Resultado |
|---|---|
| migration applies to a fresh isolated database | passed |
| only one active draft per candidate | passed |
| auth identity cannot be reassigned | passed |
| negative money and unknown with value are rejected | passed |
| null mobility array cannot bypass known/unknown validation | passed |
| confirmed zero is distinct from unknown and maximum decimal fits | passed |
| source fragments cannot cross owners | passed |
| original source content is immutable | passed |
| evidence links cannot cross profiles | passed |
| overlapping availability is rejected | passed |
| adjacent half-open availability is allowed | passed |
| confirmation without receipt is rejected | passed |
| confirmation cannot use another candidates preview | passed |
| partial profile requires acknowledgement | passed |
| confirmation cannot change previewed content | passed |
| confirmation requires audit | passed |
| confirmation without pointer rolls back at commit | passed |
| failed confirmation leaves no receipt or confirmation behind | passed |
| valid atomic confirmation persists one immutable version | passed |
| confirmed revision cannot be edited | passed |
| confirmed child cannot be edited or deleted | passed |
| nested exception intervals are frozen too | passed |
| new draft cannot silently drop its current base version | passed |
| moving a child OUT of a confirmed version is rejected | passed |
| current version cannot point to another candidate | passed |
| old preview cannot confirm a newer draft revision | passed |
| expired preview cannot confirm even with current revision | passed |
| idempotency key is unique per actor and operation | passed |
| all application tables have RLS enabled | passed |
| non-owner role has no row access even after SELECT grant | passed |

## Huellas de los archivos comprobados

| Archivo | SHA256 |
|---|---|
| prisma\schema.prisma | aff6dc47458abb2bf5c50dd56fbe55eb8d9ee9fc17347ca562fc13856aa109c4 |
| prisma\guards.sql | 53d13f8c6f41c415de93cfb001fc58b8b578d753a037e5c03091d6b5f8f9fe99 |
| prisma\migrations\202610160001_profile\migration.sql | 8a088cb1ece1478a2b4517aca3f74a6e4596642c8db4b9bddfa7a85ca0fa4750 |
| scripts\test-schema.mjs | 33f7860fa621f00b7b5835a624767b1494bec95ec171e2953536c84e24881e83 |

## Límites y siguiente paso

No aplicación de migración en Supabase, configuración remota de roles/grants/políticas operativas en BD, servicio API ni login/bootstrap de runtime, pruebas multi-conexión, E2E o evals IA. Las pruebas de unicidad y rollback validan reglas SQL; no equivalen a prueba concurrente de dos navegadores. E01–E20 conservan estado diseñado sin resultados del producto.

Historial de instalación: la primera ejecución falló por red/caché. Con fecha de cierre D1, se completó con éxito `bun install --ignore-scripts --network-concurrency 4` (155 paquetes instalados, 649.39s) y posterior verificación congelada `bun install --frozen-lockfile` (156 paquetes checked en 94ms) con `bun.lock`. Prisma CLI 7.10.1 `validate` y `generate` pasaron satisfactoriamente, junto con la prueba de importación de `PrismaClient` en Bun. La matriz y script de permisos de base de datos para 25 tablas (`prisma/runtime-access.sql`) han sido validados localmente en memoria alcanzando 15 pruebas runtime PASS (incluyendo 3 pre-checks de aislamiento), pero permanecen sin aplicar en remoto (Supabase) y la API aún no está aprovisionada. No desactivar TLS ni sustituir esta comprobación por consultar una BD remota compartida.

Evidencia detallada sanitizada conservada fuera del repo en magi/contexto/VERIFICACION_ESQUEMA_20261016.json. Cambios posteriores a estos archivos requieren repetir la comprobación afectada; estas huellas describen esta revisión, no versiones futuras.

## Revisión acotada con BALTHASAR por Vertex

Límite local de 300 segundos por llamada. Relaciones/permisos terminó en 203,21 s. Dos alertas iniciales surgieron al revisar un extracto sin todos los triggers: puntero de versión ajeno y preview de otra revisión. El primer caso ya tenía regresión; se añadió la segunda y se ejecutó la suite completa: 30 aprobadas. Ambos escenarios son rechazados por los triggers vigentes; no fue necesario cambiar la migración.

La primera llamada de transacciones terminó sin respuesta de OpenCode (no fue timeout). Un único reintento secuencial con el SQL completo terminó en 20,33 s, sin hallazgos pendientes. Confirmó guard_profile_pointer, guard_revision y check_confirmation_commit. Revisión estática limitada al esquema: no aprobación de API, roles operativos, despliegue o producto completo.

Evidencia interna fuera del producto: REVISION_CU01_RELACIONES_PERMISOS_20261016.json, REVISION_CU01_ESTADOS_TRANSACCIONES_20261016.json y REVISION_CU01_TRANSACCIONES_REINTENTO_20261016.json, bajo magi/contexto/. Para revisiones siguientes: un bloque a la vez; incluir restricciones y triggers que lo implementan; respuesta breve; límite explícito de 300 s; guardar cada resultado y no reintentar en bucle. La ejecución simultánea coincidió con un fallo, pero no se ha demostrado causalidad.
