# Colaboración humana e IA en AImpulsa

> **Estado conciliado — 2026-10-17:** consultar [ESTADO_ACTUAL.md](ESTADO_ACTUAL.md) para distinguir implementación, evidencia histórica y pendientes de entrega. D8 figura corregido localmente y su migración remota aplicada/verificada; la aceptación manual, los evals publicados y la traza de tres agentes siguen pendientes.

Fecha de revisión: 2026-10-17. Este documento sintetiza las 89 entradas existentes de [BITACORA_IA.csv](BITACORA_IA.csv) antes de registrar esta actualización. La bitácora conserva el detalle histórico de fechas, herramientas/modelos, archivos y verificaciones; esta síntesis no lo reemplaza.

## Cómo trabajamos

**Mainor Villarreal y Giovanny Arpaia construyeron AImpulsa mediante colaboración iterativa con Codex y Antigravity/Gemini.** El equipo planteó las ideas y necesidades, discutió propuestas, tomó decisiones, probó la experiencia y comunicó problemas. La IA investigó, propuso alternativas, formalizó acuerdos, escribió documentación y código, integró cambios y ejecutó verificaciones.

El proceso se repitió por bloques: idea o problema humano → análisis y propuesta de IA → discusión y decisión humana → implementación → revisión técnica y pruebas → uso del sistema y retroalimentación humana → corrección. Hubo fallos, cambios de alcance y revisiones cruzadas; no fue una única generación automática.

La colaboración de desarrollo entre humanos y asistentes es distinta de la [colaboración entre agentes del producto](COLABORACION_AGENTES.md). Codex, Antigravity y MAGI ayudaron a construir el software; A01, A02, A03 y A05 son funciones de IA que utiliza la aplicación.

## Aportes del equipo humano

La autoría conceptual corresponde a **Mainor y Giovanny**, como se registra en [IDEAS_EQUIPO.md](IDEAS_EQUIPO.md). No se asigna a uno u otro una idea individual cuando el registro solo confirma autoría conjunta.

- Propusieron conectar experiencia del joven, vacantes y formación mediante etiquetas de puestos y habilidades; considerar trabajo informal, intereses, brechas y condiciones reales de acceso.
- Definieron el papel de empresa, centro de formación y joven, y aclararon que el orientador es una persona independiente que ayuda al joven, no un representante de la empresa.
- Discutieron los casos de uso, las tareas individuales de los agentes, la separación entre IA y algoritmos, los datos, permisos, relaciones y estados.
- Eligieron Supabase Auth, alta controlada de organizaciones y confirmación inmediata de reservas con descuento transaccional de cupo; participaron en la elección del stack y la arquitectura.
- Eligieron el nombre **AImpulsa**, el énfasis visual en AI, el cohete, la paleta marfil/carbón/terracota/oliva, los temas claro/oscuro y cambios de navegación y progreso.
- Aportaron indicaciones del reto, ideas escritas, archivos de ejemplo, capturas y errores reales; probaron recorridos y señalaron problemas de comprensión, carga, extracción, guardado y consulta del perfil.
- Dirigieron prioridades y ajustes de alcance bajo la restricción de tiempo: texto/PDF, empresa reducida, centros y orientador, demo por perfiles y PPT.

Estas decisiones y pruebas son aportes humanos al desarrollo. **No se afirma que los integrantes hayan escrito manualmente archivos o líneas concretas de código cuando no existe confirmación.** Tampoco se reduce su participación a aprobar lo generado por IA.

## Trabajo realizado por Codex

| Etapa | Aporte de Codex y colaboración | Evidencia documental |
|---|---|---|
| Investigación y requisitos | Leyó las indicaciones, organizó requisitos/entregables, investigó fuentes y coordinó síntesis de MAGI. Separó fuentes investigadas de integraciones efectivamente disponibles. Organizó las ideas humanas sin atribuirse su autoría. | [Requisitos](REQUISITOS.md), [fuentes](FUENTES.csv), [ideas humanas](IDEAS_EQUIPO.md) |
| Definición funcional | Convirtió acuerdos en catálogo y especificaciones de 17 CU, reglas, estados, consentimientos y permisos. Incorporó las correcciones humanas sobre orientador y agentes compartidos. Integró opiniones de BALTHASAR y documentó revisiones no verificables. | [CU](CASOS_DE_USO.md), [especificaciones](ESPECIFICACION_CASOS_USO.md), [validación](VALIDACION_REQUISITOS_CASOS_USO.md) |
| Arquitectura y planificación | Preparó contratos, modelo de datos, módulos, separación en tres capas, reglas de componentes y planes por etapas. Preparó instrucciones y skills para que Gemini trabajara por bloques. | [Metodología](METODOLOGIA.md), [stack](STACK_TECNICO.md), [plan](PLAN_DESARROLLO_ETAPAS.md), [reglas](REGLAS_COMPONENTES_CAPAS.md) |
| Diseño Figma | Preparó flujos, tokens y componentes; construyó Figma v1 y ejecutó el rediseño v2 mediante MCP, con revisión de navegación/progreso y referencias investigadas. Incorporó la dirección visual y las correcciones humanas; aprovechó propuestas previas de BALTHASAR. | [Entrega Figma v2](ENTREGA_REDISENO_FIGMA_V2.md), [revisión](REVISION_FIGMA_NAVEGACION_PROGRESO.md) |
| Configuración y D1 | Preparó variables, resolvió conexión TLS, contrastó compatibilidad del stack e integró propuestas de esquema, permisos y despliegue de BALTHASAR/Gemini. Ejecutó pruebas SQL/runtime y comprobaciones de despliegue. La autoría D1 es compartida según cada entrada, no íntegramente de Codex. | [D1](D1_BASE_IMPLEMENTADA.md), [TLS](CONEXION_SUPABASE_TLS.md), [esquema](VERIFICACION_ESQUEMA.md) |
| Correcciones D2 | Investigó extracción incorrecta de CV y escribió correcciones para mostrar análisis, carga, entrevista y revisión por etapas. Trabajó recuperación de análisis interrumpido, validación de propuestas, guardado por lote ante P2028 y consulta/continuidad del perfil guardado. Ejecutó verificaciones dirigidas y pruebas de navegador. | [Análisis A02](CORRECCION_A02_ANALISIS_ENTREVISTA.md), [UX por etapas](UX_TRAYECTORIA_POR_ETAPAS.md), [timeout BD](CORRECCION_GUARDADO_LOTE_TIMEOUT.md), [consulta guardada](CONSULTA_PERFIL_GUARDADO.md) |
| D3 y D4 | Preparó planes para Antigravity, revisó entregas y resolvió fallos reales P2021 por tablas aún no desplegadas. Activó migraciones incrementales, permisos y datos DEMO; corrigió el seed obligatorio de cursos. No se atribuye la implementación base completa de D3/D4. | [Revisión D3](REVISION_D3_ENTREGA_ANTIGRAVITY.md), [BD D3](D3_DESPLIEGUE_BD.md), [BD D4](D4_DESPLIEGUE_BD.md) |
| Marca | Implementó el nombre AImpulsa y el componente reutilizable de marca con cohete y énfasis en AI, a partir de la elección y solicitud humana. | Entradas «Nombre AImpulsa en plataforma» y «Marca visual AImpulsa» de la bitácora |
| D5/D6 y D7 | Acotó el bloque de empresa y preparó D7 en paralelo. Codex y subagentes Codex implementaron/integraron el núcleo de centros: temarios, mapas, bancos y evaluaciones, participantes, finalización y certificado privado. Revisó contratos y controles de consentimiento, versiones, idempotencia y acceso. Gemini se utilizó también como agente del producto durante pruebas; eso no lo convierte en autor del código D7. | [Integración D5–D7](INTEGRACION_D5_D7.md), [núcleo D7](D7_NUCLEO_VERIFICADO.md), [entrega D7](D7_ENTREGA_PARA_INTEGRAR.md) |
| Correcciones A05 | Corrigió evidencia y logística desconocida, evitando declarar cumplido lo no acreditado y presentar una entrega incompleta como éxito. Añadió regresiones y verificó el bloque. | [Corrección A05](CORRECCION_A05_EVIDENCIA_LOGISTICA.md) |
| D8 y revisión integral | Preparó el plan, verificó entregas y descubrió errores de límites de autorización, versiones, dictámenes y reservas. Ejecutó pruebas técnicas, E2E y llamadas reales separadas a agentes; registró también el timeout de A02 banco sin presentarlo como éxito. La revisión focal detectó el caso de reserva independiente que Antigravity corrigió después. | [Verificación integral](VERIFICACION_INTEGRAL_D1_D8.md), [revisión focal previa](REVISION_D8_CIERRE_FOCAL.md), [cierre posterior](D8_ENTREGA.md) |
| Documentación de entrega | Actualizó README, metodología, arquitectura, CU/especificaciones, alcance, colaboración/prompts, guía de evidencias y presentación. Conservó resultados históricos y explicitó pendientes en lugar de declarar todo terminado. Esta actualización añade la síntesis de colaboración humana/IA. | [README](../README.md), [guía de presentación](GUIA_PRESENTACION_Y_EVIDENCIAS.md), [bitácora](BITACORA_IA.csv) |

Codex participó como analista, diseñador, coordinador, implementador, integrador y revisor. La evidencia de pruebas corresponde a ejecuciones concretas registradas, no garantiza automáticamente cualquier versión posterior.

## Trabajo de Antigravity/Gemini y MAGI

**Antigravity/Gemini** implementó la base de D2: identidad/borrador, trayectoria, disponibilidad, revisión/confirmación y A02; registró correcciones de extracción PDF y sincronización. Las entradas históricas incluyen Gemini 3.8 Flash y, para dos bloques de corrección, Gemini 2.5 Flash: no se reasigna todo a un único modelo.

También implementó la base de D3 (oportunidades, comparación C01 y A03), D4 (cursos, rutas, reservas y A05), el bloque reducido D5/D6 de empresa/candidaturas y D8 de acompañamiento independiente. Las revisiones de Codex y las pruebas humanas motivaron correcciones posteriores. La [integración D5–D7](INTEGRACION_D5_D7.md) distingue la base de Antigravity de la implementación/integración D7 de Codex.

**MAGI/OpenCode** fue apoyo externo para investigación, propuestas y revisión. BALTHASAR/Gemini por Vertex aportó síntesis, opiniones funcionales, propuestas de componentes, esquema y permisos; MELCHIOR y CASPER participaron en bloques registrados. Algunos intentos agotaron tiempo o no produjeron evidencia verificable. Se mantienen esas limitaciones en el CSV. MAGI no se incluye como parte de la aplicación entregada.

**Vertex AI es el proveedor de ejecución de Gemini** en los bloques indicados; no es otro integrante humano ni otro agente con autoría propia. La herramienta que genera código durante desarrollo y el modelo invocado por la aplicación en una prueba son hechos distintos.

## Cómo leer y presentar la bitácora

[BITACORA_IA.csv](BITACORA_IA.csv) conserva las columnas fecha, bloque, herramienta, modelo, aporte_ia, cambio_manual_confirmado, archivos y revision_evidencia.

- El campo histórico **cambio_manual_confirmado** incluye decisiones, aclaraciones y solicitudes humanas; no siempre significa edición manual de código. Su contenido debe leerse literalmente.
- Los informes diferencian propuesta, implementación, inspección y ejecución. Un PASS de integración con respuestas simuladas no acredita por sí solo calidad del modelo ni autenticación real.
- No se suman indiscriminadamente pruebas repetidas entre revisiones. Las 267 pruebas API, 56 controles de datos/permisos y 10 E2E del informe integral corresponden a ese estado y entorno.
- El cierre posterior D8 de Antigravity registra correcciones y suites locales aprobadas, incluido el caso independiente detectado por Codex. En esta actualización documental se contrastó el informe y el CSV; **no se reejecutaron esas suites ni se aplicó una migración remota**.
- Los 20 casos de [evals/casos.csv](../evals/casos.csv) están diseñados; siguen pendientes al menos 15 casos con métricas y resultados publicados. Las pruebas técnicas pueden aportar si se mapean a los casos; el enunciado no exige 15 llamadas LLM ni se cumple solo contando pruebas.
- Los formatos multimodales aparecen en la historia de desarrollo, pero el alcance final aceptado es **texto y PDF con capa de texto**. Audio e imágenes no se presentan como soportados.
- No se inventa el modelo exacto de Codex cuando la bitácora no lo registra. La configuración de MAGI no prueba qué modelo escribió un archivo.

## Explicación breve para la presentación

> Mainor y Giovanny definimos la idea y construimos AImpulsa mediante discusión, pruebas y decisiones continuas con asistentes de IA. Codex nos ayudó a investigar y formalizar requisitos, diseñó en Figma, preparó los bloques de trabajo, escribió e integró código, corrigió fallos y verificó entregas. Antigravity/Gemini implementó otros bloques y los corrigió tras las revisiones; MAGI aportó investigación y segundas opiniones. Documentamos quién hizo qué, qué probamos y qué sigue pendiente. Las decisiones del producto son nuestras y no presentamos el trabajo asistido como código escrito íntegramente a mano.

Esta síntesis conserva la autoría humana de las ideas y declara el alcance real del trabajo de IA. Para atribuir un archivo o resultado concreto, consultar su entrada y evidencia antes de afirmarlo.
