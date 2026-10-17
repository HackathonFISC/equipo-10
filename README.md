# Inserción Laboral Juvenil - Equipo 10

## AImpulsa
**Mainor Villarreal y Giovanny Arpaia**

<!-- Cambia el 0 por el número de su reto y deja la línea tal cual ("Reto: N"):
       1 = Agua · 2 = Educación · 3 = Empleabilidad
     No cambien de reto sin autorización de los organizadores. -->
Reto: 3

AImpulsa conecta jóvenes, empresas y centros de formación. Convierte experiencia y contenido laboral/formativo en información revisable, compara requisitos con reglas de código y permite confirmar postulaciones y reservas internas. El orientador humano acompaña al joven con autorización específica.

## Equipo
- Mainor Villarreal (@tlegend7)
- Giovanny Arpaia (@giovaar)

Proyecto construido mediante colaboración iterativa del equipo humano con Codex y Antigravity/Gemini. Las ideas y decisiones del producto son humanas; la IA participó en investigación, diseño, documentación, código, integración y pruebas. Ver [aportes y autoría por etapa](docs/COLABORACION_HUMANO_IA.md).

## Problema
Los jóvenes, especialmente quienes buscan su primera experiencia, pueden tener conocimientos adquiridos en estudios, trabajos informales, voluntariado y proyectos que no logran expresar en el lenguaje de una vacante. Las empresas describen requisitos heterogéneos y los cursos no siempre explican qué brecha laboral ayudan a cubrir. Además, horarios y traslado pueden hacer inviable una oportunidad aunque existan habilidades compatibles.

AImpulsa ayuda al joven a construir y confirmar su perfil desde texto o PDF; a la empresa, a traducir vacantes a puestos y habilidades revisables; y al centro, a relacionar temarios con competencias y evaluaciones. Compara condiciones conocidas, explica brechas y permite gestionar formación y postulaciones con consentimiento. Un orientador independiente acompaña al joven cuando este lo autoriza.

Se trabaja con perfiles consentidos, catálogos acotados y vacantes/cursos sintéticos de demostración. La cobertura de requisitos no se presenta como probabilidad de contratación, ni la IA acredita por sí sola habilidades o certificados.

## Estado y alcance de la entrega
Actualizado: 2026-10-17. D1–D4, el alcance reducido D5/D6 y el núcleo D7 están implementados. Antigravity registra D8 corregido y verificado localmente, incluida la reserva independiente de la misma edición tras revocación. Esta actualización documental no reejecutó esas pruebas. Posteriormente, Codex aplicó y verificó la migración D8 en Supabase por autorización del equipo: sin migraciones pendientes, con verificación del rol runtime y sin cambios en los conteos de registros existentes comprobados.

Ver [migración aplicada y preparación del repositorio](docs/CIERRE_MIGRACIONES_REPOSITORIO.md). Consultar el [cierre posterior D8 de Antigravity](docs/D8_ENTREGA.md), la [revisión focal previa de Codex](docs/REVISION_D8_CIERRE_FOCAL.md) y la [verificación integral](docs/VERIFICACION_INTEGRAL_D1_D8.md). Son evidencias de momentos distintos: el fallo histórico motivó la corrección posterior.

Se admiten **texto escrito/pegado y CV PDF con capa de texto**. Audio, fotos e imágenes están fuera de esta entrega. Se aprovecha una capa OCR preexistente en un PDF; no se implementó OCR propio sobre escaneos. A04, CV/carta adaptados, práctica de entrevista y agenda bilateral de entrevistas siguen aplazados. No se afirma cálculo de tarifas/rutas MiBus/Metro, verificación de salario mínimo legal ni equivalencia completa con ESCO.

## Documentación: por dónde empezar
| Documento | Qué explica |
|---|---|
| [Catálogo de casos de uso](docs/CASOS_DE_USO.md) | Actores, objetivos y recorrido de CU01–CU17; estado por función |
| [Especificaciones de casos de uso](docs/ESPECIFICACION_CASOS_USO.md) | Precondiciones, entradas, pasos, alternos, estados, permisos y aceptación |
| [Metodología](docs/METODOLOGIA.md) | Tres capas, modularización, operación y proceso de desarrollo |
| [Arquitectura de agentes](docs/ARQUITECTURA_AGENTES.md) | Roles, datos, herramientas y decisiones humanas |
| [Colaboración, prompts y código](docs/COLABORACION_AGENTES.md) | Cómo se transfieren resultados; dónde están instrucciones y herramientas reales |
| [Guía de presentación y evidencias](docs/GUIA_PRESENTACION_Y_EVIDENCIAS.md) | Orden para explicar el proyecto y elegir capturas |
| [Colaboración humana e IA](docs/COLABORACION_HUMANO_IA.md) | Ideas y decisiones del equipo; aportes de Codex, Antigravity y MAGI por etapa |
| [Bitácora de IA](docs/BITACORA_IA.csv) | Autoría humana/IA, herramientas, cambios y verificaciones |
| [Entregables](docs/ENTREGABLES.md) | Paquete oficial, congelamiento y plan de demo/PPT del equipo |

## Actores y decisiones humanas
| Actor | Responsabilidad y límite |
|---|---|
| Joven/candidato | Confirma su perfil, decide qué compartir y autoriza postulaciones/reservas; sus datos no son públicos |
| Reclutador de empresa | Publica vacantes propias y consulta candidaturas consentidas; no recibe toda la base de jóvenes |
| Responsable de centro | Gestiona cursos propios, revisa mapas/bancos y registra finalización y certificado existente |
| Orientador independiente | Revisa la ruta autorizada y propone aclaraciones; no representa a empresa/centro ni actúa por el joven |
| Administrador de organización | Opera dentro de las facultades de su membresía; no obtiene autoridad global |

## Arquitectura de agentes

### Arquitectura de software en tres capas
El lenguaje principal es **TypeScript**; la interfaz usa **TSX**, los estilos **CSS Modules** y la persistencia **SQL/PostgreSQL**. Scripts auxiliares usan JavaScript. Bun es el runtime y gestor de paquetes; no un lenguaje.

| Capa | Implementación |
|---|---|
| Presentación | React 19 + React Router + Vite 8; componentes, hooks y tokens claro/oscuro en apps/web |
| Aplicación/negocio | Hono sobre Bun 1.3; módulos, controladores, servicios, agentes y controles en apps/api |
| Datos | Prisma 7 + adapter-pg + PostgreSQL/Supabase; acceso de servidor bajo RLS y transacciones |

Son frontend y API separados dentro de un monorepo Bun; la API es un **monolito modular**, no un conjunto de microservicios. Dentro de cada módulo, el controlador valida HTTP, el servicio ejecuta el caso de uso y Prisma/SQL persiste. El módulo ensambla rutas/dependencias: no es una cuarta capa.

Contratos Zod compartidos: [packages/contracts](packages/contracts). Versiones fijadas: [package.json](package.json), [web](apps/web/package.json), [API](apps/api/package.json) y [bun.lock](bun.lock).

### Agentes, herramientas y colaboración
| ID | Función implementada o prevista |
|---|---|
| A01 | Propone normalización de vacantes y mapas de temario contra el catálogo del producto |
| A02 | Propone perfil desde fuentes y preguntas sobre mapas formativos confirmados |
| A03 | Explica compatibilidad y brechas calculadas por C01 |
| A05 | Explica rutas formativas; consulta datos y cálculo C01 |
| A04 | Postulación asistida/materiales/práctica: **aplazado**, no contar como implementado |

Los agentes implementados usan Gemini por **Vertex AI**, con ADC en el servidor; las pruebas registradas usaron gemini-3.8-flash. C01 calcula; los controles C02 autorizan y validan; C03 representa coordinación de acciones/recibos en servicios. Estos componentes de código no son agentes LLM adicionales.

**Ejemplo de colaboración:** A01 propone el mapa de un curso → el centro lo confirma → la BD conserva su versión → A02 consulta ese mapa y propone preguntas → el centro revisa el banco → el joven responde → C01 corrige objetivas → el joven decide asociar el resultado. En el perfil, las propuestas A02 solo llegan a la comparación A03 después de confirmación del joven.

A03 y A05 leen perfil/objetivo/catálogos autorizados; actualmente el planificador puede leer directamente los requisitos de la vacante. No afirmar una llamada automática A03 → A05 ni un bus de mensajes que no existe. La colaboración está mediada por servicios y datos versionados. Falta incorporar una traza de un mismo caso con tres agentes reales para acreditar ese criterio de entrega. Ver [detalle y fuentes](docs/COLABORACION_AGENTES.md).


### Diagrama de arquitectura y puntos de intervención humana

~~~mermaid
flowchart TD
  U["Joven · empresa · centro · orientador independiente"] --> WEB["Presentación: React / TSX"]
  WEB --> API["API Hono: módulos, controladores y servicios"]
  API --> C["Reglas C01 · permisos C02 · acciones C03"]
  API --> A01["A01: normalizar vacante y temario"]
  API --> A02["A02: interpretar perfil y proponer preguntas"]
  API --> A03["A03: explicar compatibilidad"]
  API --> A05["A05: explicar rutas formativas"]
  A01 --> V["Gemini mediante Vertex AI"]
  A02 --> V
  A03 --> V
  A05 --> V
  A01 --> H["Revisión y confirmación humana según actor"]
  A02 --> H
  A03 --> H
  A05 --> H
  H --> API
  API --> DB["Datos: Prisma / PostgreSQL Supabase · RLS"]
  C --> DB
  API --> AUTH["Supabase Auth"]
~~~

Las flechas muestran responsabilidades y dependencias, no una conversación automática entre todos los agentes. Sus herramientas acceden a información autorizada mediante servicios; las propuestas se validan antes de persistir o ejecutar acciones. El joven confirma perfil y acciones, la empresa revisa vacantes y el centro confirma mapas y bancos de preguntas. El orientador interviene solo dentro del acompañamiento autorizado.

## Tecnologías y fuentes de datos

| Elemento | Uso |
|---|---|
| TypeScript / TSX | Lenguaje principal de API, contratos e interfaz |
| React, React Router, Vite y CSS Modules | Vistas, navegación, componentes y estilos reutilizables |
| Bun y Hono | Ejecución, paquetes y API HTTP modular |
| Prisma, PostgreSQL y Supabase | Persistencia, transacciones, autenticación y políticas de acceso |
| Zod | Contratos y validación de entradas/salidas |
| Gemini por Vertex AI | Interpretación y explicaciones con herramientas y salidas controladas |
| PDF.js | Extracción de texto de PDF digital; no lectura del archivo binario como texto |
| Bun Test, PGlite y Playwright | Pruebas de lógica, datos/permisos y recorridos del navegador |
| Figma | Diseño de referencia, componentes, navegación y temas claro/oscuro |

Fuentes: información aportada y confirmada por el usuario; catálogos internos de puestos/habilidades; vacantes, cursos y participantes sintéticos DEMO. La investigación de ESCO, formación y movilidad se registra en [FUENTES.csv](docs/FUENTES.csv). Investigar una fuente no implica que exista una integración automática con ella. MAGI/OpenCode se usó como apoyo externo de desarrollo y no forma parte del producto entregado.

## Instalación y ejecución
Requiere Bun 1.3.14, Node.js 24 según engines, Git y acceso autorizado a una BD configurada. Las cuentas/credenciales y ADC no se incluyen en el repositorio.

~~~powershell
git clone https://github.com/HackathonFISC/equipo-10.git
cd equipo-10
bun install --frozen-lockfile
Copy-Item .env.example .env
~~~

Completar .env sin publicar secretos. [La plantilla](.env.example) distingue credenciales del servidor y valores públicos del navegador. Para la IA, configurar ADC del servidor y proyecto/modelo Vertex según la configuración existente.

~~~powershell
bun run setup:web
bun run db:generate
bun run dev:api
~~~

En otra terminal:
~~~powershell
bun run dev:web
~~~

Abrir http://127.0.0.1:5173; API en http://127.0.0.1:3001/health. Esto presupone esquema y permisos aprovisionados. Una web compilada no crea tablas.

Despliegue BD: [base](docs/DESPLIEGUE_BD.md), [D3](docs/D3_DESPLIEGUE_BD.md), [D4](docs/D4_DESPLIEGUE_BD.md), [integración D5–D7](docs/INTEGRACION_D5_D7.md) y [D8](docs/D8_ENTREGA.md). Usar actualizadores incrementales check/apply/verify sobre el destino autorizado; no sustituirlos por reset o db push. La instalación limpia desde clon todavía no se ha acreditado en los informes actuales.

El producto se ejecuta localmente con BD/Auth en Supabase. El despliegue público frontend/API es una etapa posterior; Netlify no está declarado desplegado.

## Evals

Se distinguen las pruebas técnicas del software y las evaluaciones de calidad de los agentes. El requisito de entrega pide al menos 15 casos, métricas y resultados; tener casos diseñados no acredita haberlos ejecutado.

### Pruebas técnicas y evidencia
~~~powershell
bun run typecheck
bun run build
bun run db:validate
bun test tests/api/c01-matcher.test.ts tests/api/c01-planner.test.ts tests/api/a05-regression.test.ts
~~~

Las integraciones reinicializan bases **locales de prueba identificadas** y se ejecutan secuencialmente. El navegador tiene su propio servidor/fixture. Algunos casos live invocan Vertex; distinguirlos de mocks y no usar las URLs remotas como destinos de fixtures.

La [verificación integral](docs/VERIFICACION_INTEGRAL_D1_D8.md) registró 267 API PASS, 56 controles de datos/permisos y 10 E2E PASS; detectó fronteras D8. La [revisión focal de Codex](docs/REVISION_D8_CIERRE_FOCAL.md) registró 17 D8 y 10 reservas PASS, y detectó un caso independiente fallido. El [cierre posterior de Antigravity](docs/D8_ENTREGA.md) registra su corrección y suites 17/17, 16/16, 10/10, 8/8 y 9/9 PASS, además de tipos, build y comprobación CLI. No se reejecutaron en esta actualización documental. Son snapshots distintos; no sumar sus resultados como pruebas únicas.

[evals/casos.csv](evals/casos.csv) contiene 20 casos diseñados. Falta completar al menos 15 evals de calidad con entradas/gold, métricas y resultados reproducibles. [El resultado técnico JSON](evals/verificacion_d1_d8.json) no se presenta como esos 15 evals.

## Datos, acceso demo y límites
Se utiliza un catálogo acotado y datos sintéticos identificados como DEMO; no representan ofertas, matrículas ni certificados reales de instituciones externas. [Fuentes investigadas](docs/FUENTES.csv) no equivalen a integraciones activas o a datos vigentes importados.

La demo requiere cuentas autenticadas y membresías/habilitación reales del servidor; cambiar un selector visual no concede permisos. Las identidades de los fixtures son sintéticas y no constituyen credenciales Supabase de producción.

Certificados adjuntos se conservan en almacenamiento local privado .local/certificates; requieren sesión y respaldo al mover el servidor. No es almacenamiento multiinstancia. No publicar .env, ADC, MAGI, documentos personales ni registros privados.

## Bitácora de IA

**Mainor Villarreal y Giovanny Arpaia trabajaron en colaboración activa con la IA:** plantearon la idea, discutieron y corrigieron las definiciones, eligieron alcance y diseño, probaron recorridos y comunicaron fallos. Su participación no se limitó a aprobar una entrega automática.

**Codex** investigó fuentes, convirtió los acuerdos en requisitos y 17 CU/especificaciones, definió arquitectura y contratos, construyó y revisó el diseño Figma, preparó planes para Gemini, integró aportes y también escribió código: correcciones de D2, marca AImpulsa, integración D7 y arreglos A05. Ejecutó verificaciones, investigó errores de BD y documentó hallazgos y límites.

**Antigravity/Gemini** implementó buena parte de D2–D6 y D8 y corrigió entregas tras las revisiones. **MAGI/BALTHASAR y otros modelos por OpenCode** aportaron investigación, propuestas y revisión en etapas anteriores. El detalle y los matices de autoría por bloque están en [Colaboración humana e IA](docs/COLABORACION_HUMANO_IA.md) y en el registro original [BITACORA_IA.csv](docs/BITACORA_IA.csv).

La bitácora identifica fecha, bloque, herramienta/modelo, aporte IA, intervención humana confirmada, archivos y evidencia. Se conservan intentos fallidos y resultados históricos. No se atribuye a los integrantes edición manual de código sin confirmación; sus decisiones, pruebas y retroalimentación sí están registradas. Una ejecución del agente del producto no demuestra que ese modelo haya escrito el código. Cuando no se registró el modelo exacto de Codex, no se inventa.

## Presentación y entrega

Para explicar el proyecto: problema → actores/CU → tres capas → colaboración de agentes → demo → resultados y límites. [Guía de evidencias](docs/GUIA_PRESENTACION_Y_EVIDENCIAS.md). El equipo eligió demo en vivo y PPT; el video está excluido por decisión humana sin afirmar una exención organizadora. Registro, ventana oficial y tag final-24h requieren verificación administrativa.


---
Entrega: tag de git `final-24h` sobre el último commit válido, al cumplirse la hora 24.

Esta línea conserva la indicación de la plantilla; no afirma que el tag ya exista ni que se haya realizado la entrega administrativa.
