# Inserción Laboral Juvenil - Equipo 10

> **ESTADO VIGENTE (2026-10-16)**: El repositorio se encuentra en etapa D1 **IMPLEMENTADA Y VERIFICADA EN PERSISTENCIA Y LOCALMENTE; ACEPTACIÓN LIVE DE SUPABASE AUTH PENDIENTE DE VALIDACIÓN MANUAL**. Informe de cierre completo en [docs/D1_BASE_IMPLEMENTADA.md](docs/D1_BASE_IMPLEMENTADA.md). Base de datos con 27 tablas, 18 enums y 27 políticas RLS en Supabase, desplegadas mediante `scripts/deploy-d1.mjs` (`--check`, `--apply`, `--verify`) como actualizador sobre base existente. API en Hono/Bun autentica vía `supabase.auth.getUser(token)` con roles `equipo10_api` (`LOGIN`) y `equipo10_runtime` (`NOLOGIN`). 21 pruebas de integración API pasando, typecheck en 0 errores y build verificado.

<!-- Cambia el 0 por el número de su reto y deja la línea tal cual ("Reto: N"):
       1 = Agua · 2 = Educación · 3 = Empleabilidad
     No cambien de reto sin autorización de los organizadores. -->
Reto: 3

## Equipo

- Mainor Villarreal (@tlegend7)
- Giovanny Arpaia (@giovaar)

## Problema

La transición de los estudios al primer empleo es uno de los momentos más críticos para los jóvenes panameños, con tasas de desempleo juvenil muy por encima de la media nacional e informalidad recurrente. El sistema aborda una desconexión tripartita:
1. **Jóvenes:** Carecen de experiencia formal o de un CV tradicional estructurado; tienen dificultades para traducir su experiencia informal (apoyo en negocios familiares, voluntariados) a competencias laborales, y enfrentan severas restricciones de transporte, tiempo y dinero que vuelven inviables ciertas ofertas geográficamente distantes.
2. **Empresas:** Reciben postulaciones masivas sin ajuste a sus vacantes, y publican ofertas con requisitos ambiguos o discriminatorios (género, edad, apariencia).
3. **Centros de formación (INADEH y afines):** Cursos con cupos y horarios fijos que no siempre se alinean a la demanda de habilidades ni llegan a los jóvenes con mayores brechas.

Nuestra solución implementa un **mercado agéntico de tres lados** con supervisión humana (orientador independiente), donde los agentes extraen competencias, resuelven compatibilidad mediante solvers determinísticos considerando transporte metropolitano, y recomiendan rutas formativas y postulaciones transparentes.

## Arquitectura de agentes

Sistema multiagente e híbrido diseñado conforme a los requisitos oficiales (mínimo 3 agentes, herramientas con acción real, componentes determinísticos y humano en el ciclo):

- **A01 - Inteligencia de mercado:** Normaliza vacantes contra taxonomías de ocupaciones y competencias (ESCO / O*NET), identifica tendencias y detecta requisitos potencialmente discriminatorios.
- **A02 - Perfil y aprendizaje:** Modela la identidad del joven mediante conversación estructurada; extrae habilidades no declaradas a partir de experiencia informal (sin obligar a contar con un CV en PDF) y mapea evidencia verificable.
- **A03 - Matching y compatibilidad:** Evalúa la viabilidad entre candidato y vacante cruzando habilidades requeridas contra restricciones duras de movilidad (tiempo de traslado y costo de transporte MiBus/Metro), disponibilidad horaria y salario mínimo legal.
- **A04 - Postulación y preparación:** Asiste en la postulación consentida, adaptación de cartas y simulación de entrevistas laborales con retroalimentación formativa.
- **A05 - Rutas de formación:** Recomienda y agenda cursos pertinentes en centros de formación para cerrar brechas específicas de habilidades detectadas por A03.
- **Componentes determinísticos de código (no delegados al LLM):**
  - **C01 (Cálculos y Solver):** Algoritmos determinísticos de optimización de rutas, evaluación de elegibilidad y cálculo estricto de tiempos y tarifas.
  - **C02 (Guardrails y Seguridad):** Detección y bloqueo de sesgo (pruebas contrafactuales de nombre/género/zona), validación de esquemas Zod y control de inyecciones de prompts.
  - **C03 (Acción y Recibos):** Persistencia transaccional con generación de recibos auditables (`OperationReceipt`), garantizando que ninguna acción externa o reserva se ejecute sin consentimiento humano.

Detalles y contratos en [docs/ARQUITECTURA_AGENTES.md](docs/ARQUITECTURA_AGENTES.md) y [docs/METODOLOGIA.md](docs/METODOLOGIA.md).

## Tecnologías y fuentes de datos

- **Frontend:** React 19, TypeScript, Vite 8, CSS Modules y sistema de diseño extraído de Figma v2 (tokens de color terracota/marfil/carbón/oliva con soporte nativo para tema claro y oscuro).
- **Backend API:** Hono sobre Bun 1.3, estructurado en módulos verticales (`identity`, `profile`) bajo validación de esquemas Zod compartidos ([packages/contracts](packages/contracts)).
- **Base de Datos y Seguridad:** PostgreSQL 17 en Supabase, Prisma 7 (`@prisma/adapter-pg`), 27 tablas en esquema `app`, 18 enums y 27 políticas de Row Level Security (RLS) activas.
- **Segregación de Roles PostgreSQL:** Rol de conexión `equipo10_api` (`LOGIN`, sin privilegios de bypass) y rol transaccional de datos `equipo10_runtime` (`NOLOGIN`, ejecución controlada por GUC de actor y políticas RLS). Conexión TLS obligatoria con CA oficial verificado (`certs/supabase-prod-ca-2021.crt`).
- **Fuentes de Datos Consultadas:** Taxonomía ocupacional ESCO / O*NET, portales oficiales de empleo de Panamá (MITRADEL / Empleos Panamá / Mi Primer Empleo), catálogo formativo de INADEH, datos de movilidad metropolitana (MiBus / Metro de Panamá) y lineamientos de protección de datos ANTAI. Catálogo completo en [docs/FUENTES.csv](docs/FUENTES.csv).

## Instalación y ejecución

### Prerrequisitos
- [Bun](https://bun.sh/) versión `>= 1.3.14` (o Node.js `>= 24.11.0`)
- [Git](https://git-scm.com/)

### Pasos de arranque local

1. **Clonar e instalar dependencias:**
   ```bash
   git clone https://github.com/HackathonFISC/equipo-10.git
   cd equipo-10
   bun install --frozen-lockfile
   ```

2. **Configuración de variables de entorno:**
   Copiar la plantilla de entorno:
   ```bash
   cp .env.example .env
   ```
   Completar las variables requeridas en `.env` (URL y llave pública de Supabase, y credenciales de conexión de base de datos). Para conectividad segura TLS, se incluye el certificado público de la CA en `certs/supabase-prod-ca-2021.crt`.

3. **Preparar entorno web y generar cliente Prisma:**
   ```bash
   bun run setup:web      # Genera apps/web/.env.local con las variables públicas allowlisted
   bun run db:generate    # Genera el cliente tipado de Prisma 7
   ```

4. **Iniciar servicios en modo desarrollo:**
   - **Backend API (Hono en Bun, puerto 3001):**
     ```bash
     bun run dev:api
     ```
     Verificación de salud: `curl http://127.0.0.1:3001/health`
   - **Frontend Web (Vite + React, puerto 5173):**
     ```bash
     bun run dev:web
     ```
     Abrir navegador en `http://127.0.0.1:5173`

5. **Ejecutar suite de pruebas automatizadas:**
   - Pruebas unitarias y de integración API (21 tests):
     ```bash
     bun test tests/api
     ```
   - Verificación de tipos TypeScript:
     ```bash
     bun run typecheck
     ```
   - Compilación del frontend web:
     ```bash
     bun run build
     ```

### Credenciales de Demo
Para la demostración en vivo de la plataforma:
- Se utiliza autenticación vía Supabase Auth.
- La base de datos cuenta con segregación por roles de usuario (`AppUser`: candidato, reclutador de empresa, representante de centro formativo y orientador humano independiente).
- Cuentas de demostración documentadas en [docs/DEMO_PPT_DISENO.md](docs/DEMO_PPT_DISENO.md). El archivo `.env.example` provee la configuración sintética limpia sin exponer claves privadas.

## Evals

El set de evaluación de robustez agéntica comprende **20 casos de prueba formalmente diseñados** en [evals/casos.csv](evals/casos.csv), cubriendo:
- **E01–E05:** Manejo de entradas maliciosas, intentos de inyección de prompts y peticiones fuera de alcance.
- **E06–E10:** Detección de ofertas discriminatorias (restricciones de edad, género o apariencia) y pruebas contrafactuales de equidad.
- **E11–E15:** Asignación determinística, compatibilidad de transporte metropolitano (costo y duración de traslado) y horarios viables.
- **E16–E20:** Normalización y extracción de habilidades desde experiencia informal y notas de voz.

Métricas de evaluación, criterios de éxito e invariantes se detallan en [docs/METODOLOGIA.md](docs/METODOLOGIA.md).

## Bitácora de IA

El uso de Inteligencia Artificial en el ciclo de ingeniería se documenta con estricta transparencia y trazabilidad en [docs/BITACORA_IA.csv](docs/BITACORA_IA.csv).
- **Herramientas y Modelos empleados:** Gemini 3.8 Flash (Vertex AI), GPT-6 Sol medium y Codex.
- **Aportes de IA:** Generación de esquemas DDL, borradores de políticas RLS, suites de pruebas automatizadas y asistencia en arquitectura documental.
- **Aportes y Validaciones Humanas:** Dirección del problema, autoría de las ideas iniciales, reglas de negocio, selección del reto y aprobación de cada etapa por Mainor Villarreal y Giovanny Arpaia.
- **Límites éticos:** Ningún secreto, token de producción o dato personal real fue procesado o incluido en el repositorio.

---

## Documentación del Proyecto

- [Documento de Metodología Oficial (D07)](docs/METODOLOGIA.md)
- [Cierre de Etapa Base D1 Implementada](docs/D1_BASE_IMPLEMENTADA.md)
- [Arquitectura de Agentes y Sistema Híbrido](docs/ARQUITECTURA_AGENTES.md)
- [Especificación Completa de Casos de Uso (CU01–CU17)](docs/ESPECIFICACION_CASOS_USO.md)
- [Guía y Resultados de Despliegue de Base de Datos](docs/DESPLIEGUE_BD.md)
- [Handoff de Rediseño Figma v2](docs/ENTREGA_REDISENO_FIGMA_V2.md)
- [Plan Maestro por Etapas (D1–D9)](docs/PLAN_DESARROLLO_ETAPAS.md)
- [Plan de Demostración en Vivo y Presentación PPT](docs/DEMO_PPT_DISENO.md)
- [Matriz de Entregables y Congelamiento oficial](docs/ENTREGABLES.md)
