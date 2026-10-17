# Mapa Documental de Desarrollo y Gobernanza del Proyecto

> **Lectura histórica — conciliación 2026-10-17:** se conservan el alcance, resultados y autoría de la ejecución original. Los pendientes de aquel momento no describen automáticamente la entrega actual. Consultar [estado vigente](ESTADO_ACTUAL.md), [D8 corregido](D8_ENTREGA.md) y [despliegue aplicado/verificado](CIERRE_MIGRACIONES_REPOSITORIO.md). Esta nota no repite pruebas ni cambia resultados anteriores.

**Estado:** Consolidación documental y alineación canónica (Planificación sin código).  
**Rol/Autor:** BALTHASAR (`google-vertex/gemini-3.8-flash` en Vertex AI, proyecto `magi-511816/global`).  
**Fecha de corte:** 2026-10-16.

---

## 1. Declaración Honesta de Cobertura Documental

Para garantizar la integridad y transparencia metodológica:

1. **Lectura y Verificación de Cuerpos Completos (FULL)**:  
   Se declara lectura íntegra, palabra por palabra, de 5 documentos suministrados de forma textual:
   - `docs/REQUISITOS.md`
   - `docs/PLAN_DESARROLLO_ETAPAS.md`
   - `docs/GUIA_IMPLEMENTACION_Y_REVISION.md`
   - `docs/PLANTILLA_TAREA_DESARROLLO.md`
   - `docs/D1_BASE_IMPLEMENTADA.md`
   (Adicionalmente se cargaron 3 archivos operativos: las skills `.opencode/skills/magi-equipo10-desarrollo/SKILL.md` y `.opencode/skills/magi-equipo10-validacion/SKILL.md`, junto con `GEMINI.md`).

2. **Alcance de Inventario y Encabezados (Metadatos)**:  
   Para los 52 documentos restantes del total de 57 documentos inventariados en el repositorio, la cobertura declarada se limita a: ruta física, resumen criptográfico SHA-256, cantidad de líneas y jerarquía formal de encabezados (`headings`). **No se asume ni se afirma lectura completa de cuerpos no suministrados.** Cualquier afirmación funcional sobre estos documentos se apoya estrictamente en sus metadatos y en referencias cruzadas explícitas de los documentos leídos en su totalidad.

---

## 2. Jerarquía de Autoridad y Resolución de Conflictos

En caso de contradicción o ambigüedad en los requerimientos, el orden estricto de gobernanza y toma de decisiones es:

1. **Nivel 1 (Máxima Autoridad)**: Instrucciones directas de los usuarios humanos (Mainor Villarreal y Giovanny Arpaia), marco oficial del reto 3 (`REQUISITOS.md`, marco oficial CONTECS 2026).
2. **Nivel 2 (Reglas Funcionales y Aceptación)**: Especificaciones de casos de uso `CU01` a `CU17` y Reglas Generales de Negocio `RGN01` a `RGN14` (`ESPECIFICACION_CASOS_USO.md`, `CASOS_DE_USO.md`, `ACOMPANAMIENTO_JOVEN.md`).
3. **Nivel 3 (Contratos Técnicos y de Datos Vigentes)**: Contrato funcional y de datos de perfil (`CONTRATO_REGISTRO_PERFIL.md`), API y contratos de agentes (`API_REGISTRO_PERFIL.md`, `AUTONOMIA_CONTRATOS_MODELOS.md`, `STACK_TECNICO.md`).
4. **Nivel 4 (Diseño de Interfaz Canónico)**: Figma v2 (`ENTREGA_REDISENO_FIGMA_V2.md`, `PLAN_REDISENO_FIGMA_V2.md`, `PROPUESTA_NAVEGACION_FEED.md`).
5. **Nivel 5 (Planes Operativos de Desarrollo)**: Secuencia y etapas de desarrollo (`PLAN_DESARROLLO_ETAPAS.md`, `D1_BASE_IMPLEMENTADA.md`).
6. **Nivel 6 (Material Histórico y de Consulta)**: Investigaciones de etapa 1 (`docs/investigacion/*`, `INVESTIGACION.md`), propuestas tempranas y Figma v1 (`ENTREGA_FIGMA_V1.md`, `PLAN_FIGMA_DISENO_PLATAFORMA.md`), bitácoras y matrices de fuentes (`BITACORA_IA.csv`, `FUENTES.csv`).

> **Aviso de precisión terminológica:** La categorización de un documento como "referencia histórica" (p. ej. etapa 1 o borradores de flujo) delimita su alcance temporal, pero **no descarta las reglas de negocio, invariantes y casos de uso vigentes** aprobados por el equipo humano.

---

## 3. Estado Vigente de la Implementación (Línea Base D1 y Siguiente Paso D2)

- **Bloque D1 (Completado y Verificado en Persistencia/Local)**:
  - Base de datos consolidada con 27 tablas en esquema `app`, 18 enums y 27 políticas RLS activas en Supabase real mediante `scripts/deploy-d1.mjs`.
  - Roles de base de datos definidos: `equipo10_api` (`LOGIN`, `NOINHERIT`) y `equipo10_runtime` (`NOLOGIN`, `NOINHERIT`, `actorGUC`).
  - API Hono sobre Bun y `@prisma/adapter-pg` con endpoints base `/health`, `/api/v1/me`, `/api/v1/me/candidate-profile` y `/api/v1/organizations/:id/context`.
  - Frontend React + Vite con autenticación base, temas (claro/oscuro) y componentes de layout.
  - **Invariante técnica:** El stack técnico (ST01) y la arquitectura de 27 tablas están **cerrados y consolidados**. No se reabrirán decisiones de stack ni se reestructurará el esquema DDL desplegado.
- **Pendiente Crítico de D1**: Aceptación live de Supabase Auth (confirmación de correo y flujo de redirección en dashboard) requiere validación manual; no se afirma fallo ni ausencia de configuración sin comprobación directa.
- **Siguiente Etapa Inmediata (Bloque D2)**:
  - CU01 / CU16: Registro y perfil manual persistido del joven (texto, experiencia informal, sin CV inicial).
  - Integración progresiva de A02 en modo perfil (interpretación de texto) y posterior soporte de archivos (PDF/imagen/audio) condicionado a fixtures gold.

---

## 4. Matriz Exhaustiva del Inventario Documental

La siguiente tabla agrupa la totalidad de las 43 rutas del inventario según su fase operativa y nivel de autoridad:

| Ruta del Documento | Fase / Categoría | Nivel Autoridad | Uso Canónico / Estado | Cobertura Declarada |
|---|---|---|---|---|
| `docs/REQUISITOS.md` | Requisitos y Marco | Nivel 1 (Oficial) | Marco oficial CONTECS 2026, obligaciones O01–O08, rúbrica | **FULL** (Lectura completa) |
| `docs/IDEAS_EQUIPO.md` | Requisitos y Marco | Nivel 1 (Humana) | Texto original y acuerdos aportados por Mainor y Giovanny | Inventario + Headings |
| `docs/SUGERENCIA_DEFINICION_EQUIPO.md` | Requisitos y Marco | Nivel 1 (Humana) | Sugerencia funcional inicial por actores aportada por el equipo | Inventario + Headings |
| `docs/CASOS_DE_USO.md` | Casos de Uso | Nivel 2 (Reglas) | Catálogo consolidado de casos de uso CU01–CU17 y fronteras | Inventario + Headings |
| `docs/ESPECIFICACION_CASOS_USO.md` | Casos de Uso | Nivel 2 (Reglas) | Especificación detallada y contrato transversal de CU01–CU17 | Inventario + Headings |
| `docs/ACOMPANAMIENTO_JOVEN.md` | Casos de Uso | Nivel 2 (Reglas) | Especificación concreta de CU14 y rol de orientador independiente | Inventario + Headings |
| `docs/VALIDACION_REQUISITOS_CASOS_USO.md` | Casos de Uso | Nivel 2 (Reglas) | Matriz de trazabilidad CU contra el reto y evals diseñados | Inventario + Headings |
| `docs/DEFINICION_FUNCIONAL_PROPUESTA.md` | Casos de Uso | Nivel 2 (Histórico) | Borrador de definición funcional de etapa 2 | Inventario + Headings |
| `docs/CONTRATO_REGISTRO_PERFIL.md` | Contratos y Datos | Nivel 3 (Contrato) | Contrato funcional y de datos v1 para registro y perfil (D1-D2) | Inventario + Headings |
| `docs/API_REGISTRO_PERFIL.md` | Contratos y Datos | Nivel 3 (Contrato) | Rutas HTTP, contratos de servicio y contrato A02 v1 | Inventario + Headings |
| `docs/AUTONOMIA_CONTRATOS_MODELOS.md` | Contratos y Datos | Nivel 3 (Contrato) | Definición de sistema híbrido, contratos I01–I08 y modelos | Inventario + Headings |
| `docs/AGENTES.md` | Arquitectura e IA | Nivel 3 (Contrato) | Reparto vigente de agentes (A01–A05, C01–C03), revisión 2 | Inventario + Headings |
| `docs/ARQUITECTURA_AGENTES.md` | Arquitectura e IA | Nivel 3 (Contrato) | Arquitectura lógica de agentes, mensajes y dependencias | Inventario + Headings |
| `docs/CATALOGOS_CURSOS_PUESTOS_HABILIDADES.md` | Contratos y Datos | Nivel 3 (Contrato) | Separación de cursos, puestos y competencias observables | Inventario + Headings |
| `docs/MODELO_DATOS_MODULOS_PROPUESTA.md` | Contratos y Datos | Nivel 3 (Contrato) | Entidades lógicas, invariantes y módulos de API propuestos | Inventario + Headings |
| `docs/PROPUESTA_ESQUEMA_VERTEX.md` | Contratos y Datos | Nivel 3 (Técnico) | Propuesta inicial de esquema Prisma 7 y disparadores SQL | Inventario + Headings |
| `docs/STACK_TECNICO.md` | Arquitectura Técnica| Nivel 3 (Técnico) | Decisión ST01 cerrada: Bun, Vite, React, Hono, Prisma 7, Supabase | Inventario + Headings |
| `docs/PERMISOS_BD_API.md` | Seguridad y Datos | Nivel 3 (Técnico) | Matriz de permisos, segregación de roles y GUC transaccional | Inventario + Headings |
| `docs/CONEXION_SUPABASE_TLS.md` | Seguridad y Datos | Nivel 3 (Técnico) | Diagnóstico de conectividad TLS y configuración de red | Inventario + Headings |
| `docs/ESQUEMA_INICIAL.md` | Base de Datos | Nivel 3 (Técnico) | Esquema físico inicial desplegado y límites verificados | Inventario + Headings |
| `docs/VERIFICACION_ESQUEMA.md` | Base de Datos | Nivel 3 (Técnico) | Registro de verificación local de modelos y huellas | Inventario + Headings |
| `docs/DESPLIEGUE_BD.md` | Base de Datos | Nivel 3 (Técnico) | Guía de despliegue paso a paso y verificación de roles | Inventario + Headings |
| `docs/ENTREGA_REDISENO_FIGMA_V2.md` | Diseño UI/UX | Nivel 4 (Diseño) | Especificación de rediseño Figma v2 y cobertura de navegación | Inventario + Headings |
| `docs/PLAN_REDISENO_FIGMA_V2.md` | Diseño UI/UX | Nivel 4 (Diseño) | Plan y reglas de feeds acotados del rediseño v2 | Inventario + Headings |
| `docs/PROPUESTA_NAVEGACION_FEED.md` | Diseño UI/UX | Nivel 4 (Diseño) | Navegación por perfil e inicio acotado a tareas | Inventario + Headings |
| `docs/FIGMA_COMPONENTES_BALTHASAR.md`| Diseño UI/UX | Nivel 4 (Diseño) | Handoff de biblioteca mínima y tokens semánticos | Inventario + Headings |
| `docs/REVISION_FIGMA_NAVEGACION_PROGRESO.md` | Diseño UI/UX | Nivel 4 (Diseño) | Revisión de enlaces visuales y cálculo de progreso | Inventario + Headings |
| `docs/ENTREGA_FIGMA_V1.md` | Diseño UI/UX | Nivel 6 (Histórico) | Entrega original de diseño Figma v1 (referencia de IDs) | Inventario + Headings |
| `docs/PLAN_FIGMA_DISENO_PLATAFORMA.md` | Diseño UI/UX | Nivel 6 (Histórico) | Plan original para Figma v1 | Inventario + Headings |
| `docs/FIGMA_PRIMER_BLOQUE.md` | Diseño UI/UX | Nivel 6 (Histórico) | Especificación de vistas V01–V06 del bloque inicial v1 | Inventario + Headings |
| `docs/FLUJOS_FIGMA_DESARROLLO.md` | Diseño UI/UX | Nivel 6 (Histórico) | Protocolo de coordinación entre diseño Figma y programación | Inventario + Headings |
| `docs/PLAN_DESARROLLO_ETAPAS.md` | Plan Operativo | Nivel 5 (Operativo)| Plan maestro por etapas D1–D9, condiciones de salida y estado | **FULL** (Lectura completa) |
| `docs/DEMO_PPT_DISENO.md` | Presentación / Demo | Nivel 5 (Operativo)| Plan D9 de presentación diapositivas PPT (demo sin video según decisión humana) | Inventario + Headings |
| `docs/GUIA_IMPLEMENTACION_Y_REVISION.md`| Protocolo Dev | Nivel 5 (Operativo)| Reparto de roles, contrato vertical, protocolo MAGI y skills | **FULL** (Lectura completa) |
| `docs/PLANTILLA_TAREA_DESARROLLO.md` | Protocolo Dev | Nivel 5 (Operativo)| Plantilla estructurada para emisión de órdenes de bloque | **FULL** (Lectura completa) |
| `docs/ORDEN_D1_BASE.md` | Plan Operativo | Nivel 5 (Histórico)| Orden de trabajo ejecutada para el bloque D1 | Inventario + Headings |
| `docs/D1_BASE_IMPLEMENTADA.md` | Plan Operativo | Nivel 5 (Operativo)| Cierre de D1: BD remota, API, web base y pendientes Auth | **FULL** (Lectura completa) |
| `docs/ACEPTACION_REGISTRO_PERFIL.md` | Plan Operativo | Nivel 5 (Operativo)| Criterios observables de aceptación y orden D1-A / D2-A-C | Inventario + Headings |
| `docs/README.md` | Índice General | Nivel 5 (Operativo)| Resumen de entrada al sistema documental del producto | Inventario + Headings |
| `docs/ENTREGABLES.md` | Índice General | Nivel 5 (Operativo)| Control de congelamiento y entregables CONTECS | Inventario + Headings |
| `docs/REGISTROS.md` | Auditoría y Evidencia| Nivel 5 (Operativo)| Tablero de evidencias por acumular y métricas | Inventario + Headings |
| `docs/REVISION_PREVIA_DESARROLLO.md`| Auditoría y Evidencia| Nivel 5 (Operativo)| Auditoría previa a la implementación y resolución de dudas | Inventario + Headings |
| `docs/REVISION_INTEGRAL_PLAN.md` | Auditoría y Evidencia| Nivel 5 (Operativo)| Cruce integral de procesos, invariantes y escenarios X13–X15 | Inventario + Headings |
| `docs/REVISION_BALTHASAR_CU_AGEN_DATOS.md` | Auditoría y Evidencia| Nivel 5 (Operativo)| Revisión técnica crítica realizada por BALTHASAR | Inventario + Headings |
| `docs/OPINION_VERTEX_ARQUITECTURA_MAPEO.md` | Auditoría e IA | Nivel 5 (Operativo)| Dictamen técnico de Vertex/Gemini sobre agentes y mapeo | Inventario + Headings |
| `docs/MAPEO_CASOS_AGENTES.md` | Casos de Uso / IA | Nivel 3 (Contrato) | Trazabilidad entre actores, CU y agentes A01–A05 | Inventario + Headings |
| `docs/ANALISIS_IDEAS.md` | Requisitos / Diseño | Nivel 6 (Histórico) | Análisis preliminar de ideas humanas y modelos de habilidades | Inventario + Headings |
| `docs/FLUJO_TRABAJO.md` | Plan Operativo | Nivel 6 (Histórico) | Estimación inicial histórica de 20 horas (sustituida) | Inventario + Headings |
| `docs/BITACORA_IA.csv` | Auditoría y Evidencia| Nivel 6 (Histórico)| Registro cronológico de intervenciones y llamadas de IA | Inventario + Headings |
| `docs/FUENTES.csv` | Auditoría y Evidencia| Nivel 6 (Histórico)| Catálogo de fuentes de datos consultadas | Inventario + Headings |
| `docs/INVESTIGACION.md` | Investigación | Nivel 6 (Histórico) | Índice de investigación documental de etapa 1 | Inventario + Headings |
| `docs/investigacion/ESTADO.md` | Investigación | Nivel 6 (Histórico) | Estado de investigación MAGI etapa 1 | Inventario + Headings |
| `docs/investigacion/DOMINIO_REFERENTES.md` | Investigación | Nivel 6 (Histórico) | Referentes de intermediación laboral juvenil | Inventario + Headings |
| `docs/investigacion/HABILIDADES_FORMACION.md`| Investigación | Nivel 6 (Histórico) | Marcos de cualificaciones y fuentes de formación | Inventario + Headings |
| `docs/investigacion/MOVILIDAD_DATOS_RIESGOS.md`| Investigación | Nivel 6 (Histórico) | Transporte metropolitano y riesgos de intermediación | Inventario + Headings |
| `docs/investigacion/SINTESIS_ETAPA_1.md` | Investigación | Nivel 6 (Histórico) | Síntesis consolidada de hallazgos de etapa 1 | Inventario + Headings |
| `docs/investigacion/EVIDENCIA_COORDINADOR.json`| Investigación | Nivel 6 (Histórico)| JSON de extracción de evidencias de etapa 1 | Inventario + Headings |

---

## 5. Auditoría de Skills y Entorno Operativo

1. **Estado de las Skills**:
   - `magi-equipo10-desarrollo` y `magi-equipo10-validacion` se encuentran presentes físicamente en `.opencode/skills/` y `.codex/skills/`.
   - **Mecanismo de carga comprobado**: El contenido de ambas skills fue **inyectado de forma explícita** en el prompt de la llamada REST a la API de Vertex AI. No existe evidencia de ejecución ni de autodescubrimiento dinámico mediante CLI de OpenCode en esta llamada.
2. **Diagnóstico de Brechas Arquitectónicas para D2**:
   - Las skills definen la filosofía de integración y validación, pero carecen de **reglas concretas de componentización UI y separación estricta de capas** para la construcción vertical en React/Vite y Hono.
   - Existe riesgo de sobrecargar componentes de vista con llamadas directas a persistencia o dispersar la lógica de negocio del CU01.
3. **Propuesta Canónica de Componentización y Capas para D2 (Sin Nuevas Dependencias)**:
   - **Capa UI (Frontend - `apps/web`)**:
     - *Vistas / Features*: En `src/features/identity/` o `src/features/profile/` estructuradas por pantalla. Reutilizar componentes compartidos existentes en `src/components/Controls.tsx` (evitar crear carpetas como `src/components/ui/` hasta que sea estrictamente indispensable).
     - *Client API*: Mantener y consumir el cliente existente `apps/web/src/lib/api.ts` vía `fetch` con token Bearer. Prohibido crear clientes alternativos como `src/services/apiClient.ts`.
   - **Capa HTTP y Aplicación (API - `apps/api`)**:
     - *Módulo e Integración*: Organizar perfil como módulo vertical separado en `apps/api/src/modules/profile/` junto al módulo de identidad (`apps/api/src/modules/identity/`), estructurado en controlador, servicio y módulo con helpers de dominio según necesidad. Prohibido crear rutas sueltas como `src/routes/profile.ts` o servicios en `src/services/`.
     - *Controllers*: Valida entradas mediante esquemas Zod existentes en `packages/contracts/src/index.ts` y extrae actor del contexto.
     - *Services*: Orquestan reglas de dominio sin acceder a peticiones u objetos de Hono.
     - *IA Integrada*: Los agentes de IA se invocan como adaptadores dentro de los servicios de aplicación, no como una capa arquitectónica separada.
   - **Capa de Persistencia (Prisma / PostgreSQL)**:
     - Uso exclusivo de Prisma en `prisma/schema.prisma` tipado bajo el rol `equipo10_runtime` configurando `actorGUC` por transacción corta (`withActor`).

---

## 6. Detección de Contradicciones y Puntos Abiertos

1. **Evaluaciones de Producto (E01–E20)**:
   - *Hecho observable*: `REQUISITOS.md` y `PLAN_DESARROLLO_ETAPAS.md` referencian los 20 evals del producto diseñados en `docs/VALIDACION_REQUISITOS_CASOS_USO.md`.
   - *Estado real*: Permanecen en estado `DISEÑADO_NO_EJECUTADO`. Las pruebas automatizadas descritas en `D1_BASE_IMPLEMENTADA.md` (30 schema, 15 runtime, 21 api, etc.) corresponden exclusivamente a infraestructura y código D1. **Nunca deben reportarse como evals de IA ejecutados.**
2. **Autenticación en Vivo frente a Persistencia**:
   - `DESPLIEGUE_BD.md` y `D1_BASE_IMPLEMENTADA.md` confirman persistencia y roles 100% operativos en Supabase remoto.
   - La redirección en Supabase Auth no está fallando por mala configuración de allowlist en código, sino que requiere la configuración y verificación manual pendiente en el dashboard de Supabase.
3. **25 frente a 27 Tablas**:
   - `PERMISOS_BD_API.md` y `PROPUESTA_ESQUEMA_VERTEX.md` mencionaban inicialmente 25 tablas.
   - La migración consolidada final (`202610160002_identity`) desplegó **27 tablas y 18 enums**. El valor canónico oficial de la base de datos es 27 tablas.
4. **Cuerpos Pendientes de Inspección**:
   - Documentos como `docs/ESPECIFICACION_CASOS_USO.md` y `docs/CONTRATO_REGISTRO_PERFIL.md` rigen D2. Si bien sus encabezados y esquemas están mapeados, al redactar la orden D2 se deberá requerir la lectura textual de sus secciones específicas.

---

## 7. Instrucciones para la Emisión de la Orden D2

Cuando se autorice el inicio de la etapa D2:
1. Completar la `PLANTILLA_TAREA_DESARROLLO.md` enfocada exclusivamente en **CU01 (Completar y confirmar perfil, con o sin CV)**.
2. Limitar los archivos editables a `apps/api/src/modules/profile/` (controlador, servicio y módulo de perfil), `packages/contracts/src/index.ts`, callers necesarios de wiring y componentes bajo `apps/web/src/features/profile/`.
3. Prohibir modificaciones en `prisma/schema.prisma` o scripts de base de datos salvo necesidad crítica demostrada de corrección de bugs.
4. Exigir la ejecución reproducible de pruebas unitarias y de integración de perfil antes de solicitar validación.
