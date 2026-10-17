# Stack técnico cerrado — decisión ST01

Fecha: 2026-10-16. Usuario solicita cerrar el stack; selección técnica de esta etapa, manteniendo React/TSX, Bun, Prisma, Supabase y tres capas. Cierra la opción de framework pendiente: **Hono con Bun**. No inicia aplicación ni migración. Sustituye las menciones anteriores de NestJS como candidato; conserva contratos CU01–CU17, roles y permisos. [Plan](PLAN_DESARROLLO_ETAPAS.md), [registro/perfil](CONTRATO_REGISTRO_PERFIL.md) y [TLS](CONEXION_SUPABASE_TLS.md).

## Selección por responsabilidad

| Parte | Selección | Uso concreto |
|---|---|---|
| Lenguaje | TypeScript estricto y TSX en interfaz | Tipos compartidos y chequeo separado; ejecutar TS con Bun no reemplaza comprobar tipos |
| Frontend | React + Vite, aplicación SPA | Vistas por rol; ejecución local y build estático; renderizado de componentes reutilizables |
| Rutas de interfaz | React Router, modo declarativo | Registro, Inicio, Explorar, Mi ruta, Agenda y gestión por perfil; no agregar otro framework fullstack |
| Estilos | CSS Modules y variables CSS semánticas | Tokens de Figma v2, claro/oscuro, componentes propios; Source Sans3, terracota/marfil/carbón/oliva. Mismo componente para ambos temas |
| API | Hono sobre Bun | API REST /api/v1, módulos por dominio, controladores y servicios; CORS y validación explícitos |
| Contratos/validación | Zod compartido | DTO estrictos, errores y límites UI/API. Reglas/permiso/transacción siguen en servicios |
| Persistencia | Prisma7 + @prisma/adapter-pg + pg | PostgreSQL Supabase, pool único por proceso, transacciones cortas, decimales y versiones; CA verificada |
| Autenticación | Supabase Auth + supabase-js | Login/verificación/recuperación; API valida identidad y usuario activo; roles/propiedad en datos propios |
| Archivos | Supabase Storage privado | CV/evidencias por propietario y propósito; acceso mediado/autorizado; implementación/políticas pendientes |
| IA de producto | SDK oficial @google/genai, Vertex AI | Adaptador por servidor con contratos A01–A05 y herramientas C01–C03. Modelo propuesto del proyecto Gemini Flash3.8; acceso API real y calidad pendientes antes de activar agentes |
| Unitarias/integración | bun:test | Reglas, validadores, servicios y HTTP Hono; BD de pruebas aislada cuando se defina |
| E2E | Playwright Test sobre Node | Navegador real, sesiones aisladas por perfil y evidencias; distinto de evals IA |
| Herramientas | Bun para dependencias/workspaces/scripts; Node24 para CLIs compatibles | Fijar versiones y bun.lock al crear proyecto; no asumir que instalar con Bun ejecuta todo automáticamente en Bun |

Solicitud al backend con fetch y un módulo de acceso API; estado local React al inicio. Añadir caché/estado global solo si un recorrido demuestra necesidad. Formularios usan controles accesibles y esquemas compartidos, sin otra librería de formularios por anticipación. La biblioteca visual se construye desde Figma según necesidades del bloque; iconos Lucide se incorporan cuando hagan falta, sin duplicar SVG manualmente.

## Por qué Hono y cómo conservar las tres capas

Hono documenta ejecución en Bun y pruebas con bun:test. Para este prototipo permite mantener controlador/servicio/módulo mediante archivos y composición explícita, sin contenedor de inyección o decoradores obligatorios. Esta es una decisión de tamaño/organización para nuestro alcance, no una afirmación de mejor rendimiento medido frente a NestJS.

NestJS sigue siendo una opción válida para proyectos con sus convenciones; aquí era una propuesta sin código existente que conservar. No se selecciona ni se instala un segundo framework. Elysia tampoco se añade. Si un requisito futuro requiere cambiar esta elección, registrar motivo y evidencia; no cambiarla silenciosamente al generar código con Gemini.

Tres capas:

1. Presentación: React y controladores HTTP (adaptadores de entrada de la API).
2. Aplicación/negocio: servicios/casos de uso; autorización por objeto, confirmaciones, versiones, idempotencia, cálculos C01 y coordinación C02/C03.
3. Persistencia: Prisma/adapter-pg, PostgreSQL y servicio de documentos. Solo servidor; el navegador no importa Prisma, pg o credenciales BD.

En la estructura API, controller → service → Prisma/servicio de persistencia. `module` registra rutas/dependencias del dominio; no es capa adicional ni microservicio. No crear un repositorio genérico que replique Prisma sin una regla específica.

## Estructura prevista, todavía sin crear

```text
apps/
  web/src/
    app/                  # rutas, shell y tema
    features/             # candidato, formación, vacantes... por bloque
    components/           # controles y composiciones compartidas
    styles/               # tokens semánticos
    lib/                  # API y Auth cliente
  api/src/
    app.ts                # composición Hono
    server.ts             # arranque Bun
    modules/candidates/
      candidates.module.ts
      candidates.controller.ts
      candidates.service.ts
    infrastructure/       # Prisma, Storage, adaptador Vertex
    security/             # identidad, ámbito, consentimiento
packages/contracts/       # esquemas Zod/DTO sin secretos ni modelos Prisma
prisma/                   # esquema/migraciones cuando se autoricen
tests/e2e/                # escenarios Playwright
evals/                    # gold/métricas/resultados de IA
```

Crear módulos solo cuando se trabaje su CU. Dos procesos locales (Vite y API), una BD Supabase; Bun workspaces administra paquetes. No Nx/Turborepo, contenedores, microservicios, Redis o cola externa por costumbre. Trabajos A02 se guardan con estado/versiones y límites; durante D2 definir recuperación ante reinicio, sin fingir que una promesa en memoria es una cola durable. No capturar excepciones para anunciar éxito.

## Identidad, datos y entorno

Frontend usa únicamente URL y clave publishable de Auth; la API recibe access token y lo valida con `supabase.auth.getUser(token)` en el primer prototipo. Devuelve sujeto auténtico o deniega; comprueba además usuario de aplicación activo y ámbito de cada operación. Esta llamada depende de disponibilidad de Auth; no confiar en sesión decodificada ni hacer fallback a permisos sin verificar ante fallo.

Prisma no hereda el JWT. Todos los datos del dominio pasan por servicios API autorizados. La elección humana de creación de proyecto fue Data API desactivada, exposición automática desactivada y RLS automático activado; no se presenta como estado remoto auditado. D1 verificará grants, rol BD de ejecución y migración, RLS y Storage antes de guardar datos personales. No usar una conexión administrativa como permiso global del usuario final.

Runtime Prisma: `DATABASE_URL` → PrismaPg con PEM `DATABASE_SSL_CA_FILE` y validación de CA/hostname, sin parámetros de URL que sobrescriban ssl. Herramientas Prisma7: configuración explícita en prisma.config.ts y `DIRECT_URL`; prueba de conexión/migración y aislamiento pendientes antes de ejecutar DDL. No copiar ejemplos Prisma6 con configuración antigua automáticamente.

No exportar todo .env a Vite: al crear web exponer solo VITE_SUPABASE_URL/VITE_SUPABASE_PUBLISHABLE_KEY y VITE_API_URL. Son nombres previstos; los secretos BD siguen exclusivamente en servidor. Auth/Storage no requieren habilitar acceso REST automático a tablas del dominio.

Entorno de pruebas de datos separado obligatorio; la conexión remota ya verificada no implica que sea descartable. No reset ni migraciones destructivas contra ella por ejecutar un test. E2E con cuentas demo distintas/sesiones aisladas, sin selector de rol que suplante permisos.

## Versiones base y política

Las siguientes versiones se consultaron en el registro npm para esta decisión. Se fijarán **sin rangos flotantes** en manifests iniciales y se guardará bun.lock para reproducibilidad al crear aplicación. No usar latest en tareas de Gemini. Runtime local medido: Bun1.3.14 y Node24.13.0; no se actualizaron.

| Paquete | Versión seleccionada |
|---|---|
| react / react-dom | 19.3.1 / 19.3.1 |
| vite / @vitejs/plugin-react | 8.3.4 / 6.1.2 |
| typescript | 7.0.2 |
| react-router | 8.4.0 |
| hono | 4.13.13 |
| zod | 4.6.7 |
| prisma / @prisma/client / @prisma/adapter-pg | 7.10.1 los tres |
| pg | 8.23.1 |
| @supabase/supabase-js | 2.118.0 |
| @playwright/test | 1.64.1 |
| @google/genai | 2.30.0; incorporar en D2-B, sin llamada de modelo en esta decisión |

El tag latest de prisma consultado devolvió 8.0.0-rc.23, mientras client/adapter devolvieron 7.10.1: seleccionar explícitamente la misma versión estable de los tres. Que un paquete aparezca bajo latest no garantiza que sea estable o compatible con sus compañeros. Versiones consultadas hoy no son garantía futura; actualizaciones deliberadas con pruebas, sin instalar prereleases accidentalmente.

## Evidencia de compatibilidad y límites

Comprobaciones en carpetas temporales externas al repositorio; paquetes exactos, sin scripts de instalación. La instalación completa agotó180segundos con npm y120segundos con Bun durante resolución/instalación, antes de generar cliente o ejecutar build. No se llegó a ejecutar el esquema temporal ni las pruebas de Prisma/Vite/TypeScript/Playwright previstas. No hay evidencia para calificarlas como aprobadas o fallidas por incompatibilidad; su integración queda pendiente en D1.

Prueba acotada realmente ejecutada: Hono4.13.13 + Zod4.6.7 sobre Bun1.3.14, entrada válida200 y clave role inesperada422; pg8.23.1 autenticó con Supabase y ejecutó SELECT1 en transacción READ ONLY, TLSv1.3/socket autorizado con CA y hostname verificados. Salida0. El resultado solo valida esa muestra y conexión, no autorización del producto. Evidencia sanitizada fuera de entrega: `magi/contexto/STACK_NUCLEO_20261016.json`; los intentos completos y versiones en `magi/contexto/STACK_COMPATIBILIDAD_20261016.json`. La prueba no acredita Auth end-to-end, RLS, migraciones, UI, evaluaciones IA, E2E reales o despliegue. CLI/navegadores Playwright, generación Prisma, build Vite y typecheck quedan sin ejecutar en esta etapa. La selección de sus versiones procede de documentación/metadatos, no de una integración completa ya probada.

## Fuentes primarias consultadas

- [Hono con Bun y bun:test](https://hono.dev/docs/getting-started/bun).
- [Validación Hono/Zod](https://hono.dev/docs/guides/validation); se puede usar Zod directo sin añadir wrapper si basta al controlador.
- [Prisma7 PostgreSQL y driver adapter](https://www.prisma.io/docs/orm/v7/core-concepts/supported-databases/postgresql), [migración a Prisma7 y SSL](https://docs.prisma.io/docs/guides/upgrade-prisma-orm/v7).
- [Vite](https://vite.dev/guide/) y [CSS Modules](https://vite.dev/guide/features.html), [Bun y Vite](https://bun.sh/guides/ecosystem/vite).
- [Supabase Auth getUser](https://supabase.com/docs/reference/javascript/auth-getuser).
- [Google Gen AI SDK y Vertex](https://googleapis.github.io/js-genai/release_docs/index.html).
- [Playwright CLI](https://playwright.dev/docs/test-cli).
- Versiones/engines/peers: metadatos oficiales de paquetes en registry.npmjs.org; runtime local obtenido de bun --version y node --version.

## Próximo bloque

Preparar esquema físico inicial y configuración D1 con este stack, después implementar registro manual D2-A. Front/API, permisos y pruebas crecen juntos. Gemini BALTHASAR escribe unidades acotadas mediante Vertex según la guía; no sustituye validación ni constituye el agente A02 del producto. Esta decisión no realizó una llamada Gemini ni inició una instalación en el repositorio.
