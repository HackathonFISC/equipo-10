# Guía de Despliegue de Base de Datos en Supabase (Bloque D1)

> **ESTADO VIGENTE (2026-10-16)**: El despliegue D1 se encuentra **IMPLEMENTADA Y VERIFICADA EN PERSISTENCIA Y LOCALMENTE; ACEPTACIÓN LIVE DE SUPABASE AUTH PENDIENTE DE VALIDACIÓN MANUAL**. Los procedimientos manuales o rutas de comando descritas abajo son históricas y quedan invalidadas por esta nota. Para más detalles, consultar [D1_BASE_IMPLEMENTADA.md](D1_BASE_IMPLEMENTADA.md). El despliegue vigente opera únicamente como actualizador (*upgrade*) sobre proyecto existente mediante `scripts/deploy-d1.mjs` usando `--check`, `--apply` y `--verify`. Los comandos previos basados en `deploy-db.mjs` (`--migrate` / `--runtime`) fueron formalmente archivados y rechazan ejecución. El esquema verificado consta de 27 tablas, 18 enums y 27 políticas RLS. El acceso se divide entre el rol de conexión `equipo10_api` (`LOGIN`) y el rol de ejecución RLS `equipo10_runtime` (`NOLOGIN`).

Esta guía describe la secuencia estricta y controlada de despliegue de base de datos para el proyecto, cumpliendo con la separación de responsabilidades y el principio de mínimo privilegio.

## 1. Arquitectura de Roles y Fases

El despliegue opera en 4 fases independientes mediante el script `scripts/deploy-db.mjs`:

1. `--check` (Por defecto, reporte de estado de solo lectura):
   - Valida la concordancia entre `SUPABASE_URL` (requiere HTTPS), `DIRECT_URL` y `DATABASE_URL` (project reference de Supabase).
   - Valida que tanto `DIRECT_URL` como `DATABASE_URL` utilicen el puerto 5432 y dominios oficiales de Supabase (`db.<ref>.supabase.co` o `*.pooler.supabase.com`). Rechaza hosts arbitrarios spoofed.
   - Verifica conectividad TLS estricta mediante `node-pg` con CA oficial (`certs/supabase-prod-ca-2021.crt`) configurando explícitamente `ssl: { ca, rejectUnauthorized: true }`.
   - Inspecciona y reporta el estado actual de la base de datos (esquema `app`, tablas públicas, historial Prisma previo y roles existentes), sin rechazar por sí misma un entorno ya aprovisionado.

2. `--migrate`:
   - Aplica las migraciones oficiales declaradas en `prisma/migrations/202610160001_profile` usando el ejecutable oficial de Prisma CLI (`prisma migrate deploy`) con `sslcert` en la cadena de conexión. Exige un entorno inicial limpio (`app` no preexistente).
   - No fabrica historial a mano ni salta pasos.
   - Registra el historial en `public._prisma_migrations` con SHA256 verificado y crea las 25 tablas en el esquema `app` (migración SQL ejecutada con bytes inalterados).
   - Sanitiza salidas sin filtrar URLs ni contraseñas.

3. `--runtime`:
   - Valida la existencia, checksum SHA256 y finalización limpia de la migración previa.
   - Envuelve `prisma/runtime-access.sql` eliminando el bloque exterior para integrarlo en una única transacción controlada con advisory lock (`pg_advisory_xact_lock`).
   - Habilita RLS en las 25 tablas del esquema `app` y despliega las 25 políticas de aislamiento orientadas exclusivamente a `equipo10_runtime`.
   - Configura `equipo10_runtime` (`NOLOGIN`, `NOINHERIT`, todas las banderas admin en false) y crea el rol de aplicación `equipo10_api` (`LOGIN`, `NOINHERIT`, todas las banderas admin en false) con contraseña criptográfica local de 32 bytes en `base64url`.
   - Otorga membresía no heredable a `equipo10_runtime`: `GRANT equipo10_runtime TO equipo10_api WITH ADMIN FALSE, INHERIT FALSE, SET TRUE`.
   - Protege `.env` escribiendo un archivo temporal `.env.runtime.pending` (modo 0600) antes de confirmar el rol en PostgreSQL.
   - Genera un respaldo `.env.pre-runtime-<timestamp>`.
   - Reemplaza únicamente la línea de `DATABASE_URL` en `.env` mediante escritura atómica una vez verificado el login TLS del nuevo rol (máximo 3 intentos con intervalo de 2s); `DIRECT_URL` y las demás líneas se conservan idénticas.

4. `--verify` (Verificación activa con rollback garantizado):
   - Valida checksum, las 25 tablas, RLS activo en todas ellas y las 25 políticas dirigidas a `equipo10_runtime` sin ownership indebido.
   - Conecta con credenciales de `equipo10_api` desde `DATABASE_URL` y confirma denegación de `SELECT` directo previo a `SET ROLE`.
   - Sin actor definido retorna cero filas; el contexto se limpia completamente tras rollback.
   - Dado que el rol migrador `postgres` en Supabase no es superusuario (`NOSUPERUSER`), la transacción de prueba otorga temporalmente `GRANT equipo10_runtime TO ... WITH SET TRUE` exclusivamente dentro de la transacción de sondeo para insertar 2 usuarios, perfiles y revisiones sintéticos, probar aislamiento estricto (A solo ve A, B solo ve B) y ejecutar **siempre ROLLBACK** incondicional.
   - Comprobación posterior independiente confirma que no se conservó dicho `GRANT`, retornando 0 usuarios, 0 perfiles y 0 revisiones persistidas.

## 2. Secuencia de Ejecución de Comandos

El integrador debe ejecutar los comandos cargando variables mediante Node.js (excepto paso 0 offline):

```bash
# Paso 0: Pruebas unitarias de helpers locales (sin conexión de red, 11 tests)
node scripts/test-deploy-db.mjs

# Paso 1: Verificación de estado e inspección (solo lectura)
node --env-file=.env scripts/deploy-db.mjs --check

# Paso 2: Despliegue de migraciones estructurales con Prisma CLI (solo en BD limpia)
node --env-file=.env scripts/deploy-db.mjs --migrate

# Paso 3: Configuración de políticas de runtime y rol de aplicación equipo10_api
node --env-file=.env scripts/deploy-db.mjs --runtime

# Paso 4: Verificación transaccional de aislamiento RLS y conectividad de runtime
node --env-file=.env scripts/deploy-db.mjs --verify
```

*Nota de estado ejecutado*: Con la base de datos remota ya aprovisionada y validada exitosamente (2026-10-16), **no** se debe re-ejecutar `--migrate` ni `--runtime`. Para comprobar el entorno desplegado se debe utilizar únicamente `node --env-file=.env scripts/deploy-db.mjs --check` y `node --env-file=.env scripts/deploy-db.mjs --verify`.

## 3. Manejo de Errores y Procedimiento de Recuperación

- **Migración y Runtime desacoplados**: Si la fase `--runtime` o `--verify` fallan, la fase `--migrate` previa permanece intacta y exitosa. **Nunca** aplique `DROP SCHEMA` ni `prisma migrate reset`.
- **Archivo `.env.runtime.pending` y respaldos**: Si el script detecta un archivo `.env.runtime.pending` preexistente, aborta para prevenir inconsistencias. **No** borre este archivo a ciegas; contiene la contraseña generada para `equipo10_api` si la transacción en Postgres concluyó antes de escribir `.env`. Verifique primero si el rol fue creado en la base de datos antes de limpiar el archivo pendiente. En Windows, los archivos ignorados (`.env.runtime.pending`, `.env.runtime.tmp`, `.env.pre-runtime-*`) permanecen locales al entorno.
- **Ajuste de SSL con Prisma**: En el motor local de Prisma CLI la conexión falló al usar `sslrootcert` (parámetro también documentado para PostgreSQL según [Prisma PostgreSQL Docs](https://www.prisma.io/docs/orm/v7/core-concepts/supported-databases/postgresql)), mientras que configurar `sslcert` estricto apuntando al CA verificado (`certs/supabase-prod-ca-2021.crt`) funcionó adecuadamente.
- **Errores de Prisma**: Cualquier fallo en `prisma migrate deploy` emite el código de error oficial de Prisma (p. ej. `P3009`, `P1001`) o `UNKNOWN`, evitando la filtración de cadenas de conexión.
- **Permisos de archivos en Windows**: El modo `0600` en archivos temporales o respaldos (`.env.runtime.pending`, `.env.runtime.tmp`, `.env.pre-runtime-*`) no garantiza listas de control de acceso (ACL) POSIX bajo Windows; dichos archivos deben mantenerse estrictamente locales e ignorados por el control de versiones.

## 4. Evidencia de Estado Actual Verificado

- Comprobaciones ejecutadas: 25 tablas en esquema `app`, 25 políticas RLS aplicadas, 1 registro en `_prisma_migrations`, consulta sin actor retornando 0 filas y 2 usuarios, 2 perfiles y 2 revisiones sintéticos revertidos (6 filas en 3 tablas) con auditoría final de 0 usuarios, 0 perfiles y 0 revisiones.
- Suite de pruebas locales: 56 pruebas superadas (30 de esquema, 15 de runtime y 11 de helpers de despliegue). Sin API HTTP expuesta, sin pruebas E2E ni evals IA de producto aún.
- Archivos de evidencia externa fuera del repositorio: `magi/contexto/DESPLIEGUE_RESULTADO_migrate_20261016.json`, `magi/contexto/DESPLIEGUE_RESULTADO_runtime_20261016.json`, `magi/contexto/DESPLIEGUE_RESULTADO_verify_20261016.json` y `magi/contexto/AUDITORIA_DESPLIEGUE_SUPABASE_20261016.json`.

## 5. Estado de la Siguiente Etapa

Este despliegue establece las bases de datos y el rol de conexión de la API (`equipo10_api`). El bootstrap de usuarios, la validación de tokens JWT y la exposición del servidor HTTP pertenecen a la etapa subsiguiente del sistema y no son activados en este bloque.
