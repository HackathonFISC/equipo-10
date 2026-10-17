# Cierre Documental D1 — Base de Datos, Identidad, API y Frontend Base

> **Lectura histórica — conciliación 2026-10-17:** se conservan el alcance, resultados y autoría de la ejecución original. Los pendientes de aquel momento no describen automáticamente la entrega actual. Consultar [estado vigente](ESTADO_ACTUAL.md), [D8 corregido](D8_ENTREGA.md) y [despliegue aplicado/verificado](CIERRE_MIGRACIONES_REPOSITORIO.md). Esta nota no repite pruebas ni cambia resultados anteriores.

Fecha de consolidación: 2026-10-16.  
Estado de la etapa D1: **IMPLEMENTADA Y VERIFICADA EN PERSISTENCIA Y LOCALMENTE; ACEPTACIÓN LIVE DE SUPABASE AUTH PENDIENTE DE VALIDACIÓN MANUAL**.

---

## 1. Resumen Ejecutivo del Bloque D1

La etapa D1 establece los cimientos de arquitectura, datos, permisos y autenticación para el reto 3 sobre la base acordada en `docs/STACK_TECNICO.md` y `docs/CONTRATO_REGISTRO_PERFIL.md`:

1. **Persistencia y Permisos en Supabase Real**:
   - Migración de perfil e identidad aplicadas (`202610160001_profile` y `202610160002_identity_orgs`).
   - 27 tablas en esquema `app`, 18 enums y 27 políticas RLS activadas.
   - Modelo estricto de roles PostgreSQL: rol de conexión `equipo10_api` (`LOGIN`, `NOINHERIT`, `NOBYPASSRLS`) y rol de ejecución `equipo10_runtime` (`NOLOGIN`, `NOINHERIT`, `NOBYPASSRLS`).
   - Funciones SQL de bootstrap (`bootstrap_app_user`) y resolución (`resolve_app_user`) con `SECURITY DEFINER`, `search_path` estático fijo y permisos de ejecución exclusivos otorgados a `equipo10_api`.
   - Organizaciones tipificadas (`COMPANY`, `TRAINING_CENTER`) y membresías auditables, previniendo autorregistro de accesos privilegiados.
   - Scripts de despliegue: `scripts/deploy-d1.mjs` ejecutado con `--apply` y `--verify` (código de salida 0), con prueba de aislamiento entre dos actores bajo rollback completo y cero seeds permanentes. Dicho script opera únicamente como actualizador (`UPGRADE`) sobre proyecto existente y no como aprovisionador en limpio (`freshprovisioner`). Los scripts previos `deploy-db.mjs` (`--migrate`/`--runtime`) quedaron archivados y rechazan nuevas ejecuciones.

2. **Servicio HTTP (API con Hono y Bun)**:
   - Adaptador `@prisma/adapter-pg` integrado a Prisma 7 y Bun.
   - Validación de identidad remota mediante `supabase.auth.getUser(token)`, requiriendo correo confirmado.
   - En cada transacción de datos se configuran de forma local `SET LOCAL ROLE equipo10_runtime` y los parámetros de contexto de actor (`actorGUC`).
   - Endpoints implementados:
     - `GET /health`: comprobación de vida (*liveness*).
     - `GET /api/v1/me` y `PUT /api/v1/me`: gestión de identidad de usuario.
     - `GET /api/v1/me/candidate-profile` y `PUT /api/v1/me/candidate-profile`: lectura y creación inicial de perfil privado base con validación estricta de cuerpo (`{}` para perfil privado inicial vacío).
     - `GET /api/v1/organizations/:id/context`: resolución de contexto para organizaciones autorizadas.

3. **Aplicación Web (React + Vite + Tailwind)**:
   - Rutas implementadas: `/acceso`, `/registro`, `/cuenta`, `/recuperar`, `/inicio` y `/mi-cuenta`.
   - Soporte de temas: Claro, Oscuro y Sistema.
   - Componentes comunes de diseño, iconos SVG extraídos del sistema Figma y navegación inferior móvil (*bottomnav*).
   - Bootstrap idempotente en frontend: garantiza la creación de `AppUser` y el perfil privado base vacío tras autenticación, sin implementar aún el editor completo de CV ni la inferencia de habilidades (reservados para D2).

---

## 2. Evidencia de Pruebas Automatizadas Ejecutadas

Pruebas automatizadas ejecutadas y aprobadas localmente al 2026-10-16:
- **test:schema**: 30 PASS (validación de modelos, enums, triggers y restricciones relacionales en PGlite).
- **test:runtime-access**: 15 PASS (aislamiento de roles y aplicación estricta de políticas RLS en PGlite).
- **test:identity**: 11 PASS (comprobaciones de bootstrap, roles `equipo10_runtime` y funciones seguras en PGlite).
- **test-deploy-db / deploy helper**: 11 PASS (validación de scripts de migración y actualización).
- **test-public-env**: 10 PASS (control de variables públicas Vite en `setup:web`, exclusión estricta de credenciales en cliente).
- **test:api**: 21 PASS (ejecutado contra contenedor PostgreSQL Docker real y fixture de autenticación local simulado).
- **test:e2e**: 5 PASS (ejecutado en Microsoft Edge sobre fixture local; no constituye prueba positiva contra Supabase Auth real).
- **Compilación y tipado**: `bun run typecheck`, `bun run build`, `bun run db:validate` y `bun run db:generate` con salida exitosa (código 0). Aviso no bloqueante de Vite sobre tamaño de fragmentos (*chunks* > 500 kB en bundle de frontend). Bloqueo de dependencias inalterado (`bun install --frozen-lockfile` con 198 dependencias / 242 paquetes).

---

## 3. Pruebas de Humo en Configuración Real

Verificaciones de configuración real ejecutadas:
- `GET /health` responde HTTP 200.
- Endpoint protegido `GET /api/v1/me` responde HTTP 401 ante petición sin cabecera `Authorization` y ante token inválido (`/api/v1/me/candidate-profile` fue probado en local).
- Servidor de frontend sirve HTTP 200 en rutas base.
- Comprobación de configuración en Supabase Auth (`/auth/v1/settings`) devuelve HTTP 200 mostrando el proveedor de correo habilitado (`external.email=true`), lo cual no prueba registro habilitado ni envío efectivo.
- Auditoría de empaquetado: el bundle web resultante excluye de manera estricta `DATABASE_URL`, `DIRECT_URL` y contraseñas de base de datos.

---

## 4. Pendientes y Limitación de Aceptación Live de Auth

**Aceptación de Autenticación Real Pendiente:**
- No se ejecutaron flujos live de registro, inicio de sesión, confirmación de correo ni recuperación de contraseña a través del servicio de Supabase Auth, quedando pendientes de validación manual.
- Queda pendiente la verificación manual en el Dashboard de Supabase de la lista de redirección permitida (*Redirect URLs allowlist*):
  - `http://127.0.0.1:5173/acceso`
  - `http://127.0.0.1:5173/recuperar`
- Esta limitación técnica impide declarar la aceptación de Supabase Auth como completamente cerrada de extremo a extremo en entorno de producción; el código y la base de datos se declaran implementados y verificados con fixtures locales controlados.

---

## 5. Instrucciones de Arranque y Entorno de Pruebas Local

### Arranque de Aplicación
1. Instalar dependencias exactas:  
   `bun install --frozen-lockfile`
2. Generar cliente Prisma:  
   `bun run db:generate`
3. Configurar entorno público web (genera únicamente 3 variables `VITE_*` públicas requeridas; si `.env` ya existe en raíz no debe sobrescribirse):  
   `bun run setup:web`
4. Iniciar servicio API (puerto `http://127.0.0.1:3001`):  
   `bun run dev:api`
5. Iniciar servicio Web (puerto `http://127.0.0.1:5173`):  
   `bun run dev:web`

### Entorno Local de Pruebas PostgreSQL (Docker)
- Contenedor de referencia local: `equipo10-d1-20261016` (imagen `postgres:17-alpine`, host `127.0.0.1:55435`, base de datos `equipo10_d1_test`).
- Inicio del contenedor si se encuentra detenido:  
   `docker start equipo10-d1-20261016`
- **Protección de Datos:** Las rutinas de prueba que reinician esquemas (`RESET`) ejecutan comprobaciones estrictas para operar única y exclusivamente contra dicha base de datos local y jamás contra las instancias de Supabase.
- Comandos de suite de pruebas:  
   `bun run test:schema`  
   `bun run test:runtime-access`  
   `bun run test:identity`  
   `bun run test:api`  
   `bun run test:e2e`  
   `node scripts/test-deploy-db.mjs`  
   `node scripts/test-public-env.mjs`

---

## 6. Autoría y Gobernanza del Código

- **Autoría de Código y Configuración**: Modelos Gemini 3.8 Flash en Vertex REST (`magi-511816/global`) actuaron como autores del código fuente base y scripts. Codex intervino en la delimitación de contratos, orquestación, integración, corrección tras error HTTP 429 (adecuando nombres de funciones y postcondiciones del helper de despliegue) y ejecución de suites de pruebas.
- **Revisión Gemini**: Revisión técnica final realizada en modo sólo lectura por Gemini sin observaciones críticas bloqueantes. No se declara independencia de proveedor ni ejecución de ciclo MAGI completo.
- **Intervención Humana**: El usuario autorizó el reinicio del contenedor Docker y la continuidad de las tareas. Las ideas y arquitectura provienen de los integrantes humanos Mainor Villarreal y Giovanny Arpaia. No se han registrado ediciones manuales de código adicionales.
- **Alcance Restante**: Etapas D2 a D9 permanecen pendientes. El almacenamiento de archivos de aplicación (*Storage*), el editor exhaustivo de currículum y las capacidades de inteligencia artificial del producto no forman parte de este cierre. Los 20 casos de evaluación de producto (E01–E20) permanecen en estado `DISEÑADO_NO_EJECUTADO`; las pruebas de infraestructura y HTTP aquí descritas no deben contabilizarse como evaluaciones de IA del producto.
