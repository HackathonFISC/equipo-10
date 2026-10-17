# Requisitos del reto 3: Empleabilidad

> **Estado conciliado — 2026-10-17:** consultar [ESTADO_ACTUAL.md](ESTADO_ACTUAL.md) para distinguir implementación, evidencia histórica y pendientes de entrega. D8 figura corregido localmente y su migración remota aplicada/verificada; la aceptación manual, los evals publicados y la traza de tres agentes siguen pendientes.

Estado: matriz de obligaciones y alcance del enunciado. Fuente: `magi/contexto/RETO_OFICIAL.md`, documento aportado por el equipo. Referencias por sección y página impresa. No convertir sugerencias en obligaciones textuales. Las filas de planificación se contrastan con la [cobertura actual de CU](CASOS_DE_USO.md#cobertura-actual-por-caso) y los informes de verificación; no significan que el producto siga sin implementar ni que el cumplimiento formal esté aprobado. Entrada del paquete: [README](../README.md).

## Alcance de formatos confirmado para esta entrega — 2026-10-17

Decisión humana: admitir texto escrito/pegado y PDF; excluir audio, notas de voz, imágenes y fotografías de esta entrega. No tratarlos como tareas necesarias para el cierre actual ni reabrirlos sin nueva decisión. Conservar las menciones del enunciado como referencia original, sin afirmar que la organización las retiró.

Precisión verificada en código: el parser usa pdfjs getTextContent para extraer la capa de texto del PDF; no ejecuta OCR propio. Un PDF que ya tenga una capa de texto creada por OCR puede aprovecharla. Un escaneo sin capa de texto sigue sin extracción utilizable y requiere alternativa manual; no prometer OCR integrado ni compatibilidad universal.

## Marco oficial

- §1, pp. 1-2: elegir un reto; 24 horas continuas, presencial; equipos de tres; máximo cinco equipos por reto; herramientas/modelos/nube libres; investigar y conseguir datos propios; documentar uso de IA; evaluación final en CONTECS 2026.
- Regla de oro, §1 p. 2: construir sistema que perciba, decida y actúe; una interfaz sustituible por un prompt no califica.
- README del repo: `Reto: 3`; no cambiar reto sin autorización organizadora.
- Fechas del enunciado: 9-10 octubre 2026. Sesión de preparación: 16 octubre 2026. Confirmar calendario y ventana oficial; no afirmar cumplimiento, retrofechar commits ni crear congelamiento por inferencia.
- Equipo confirmado por el usuario: Mainor Villarreal y Giovanny Arpaia. No incorporar ni solicitar un tercer integrante. Conservar como dato del enunciado la mención de equipos de tres, sin alterar la composición confirmada. Verificar registro oficial del repositorio.

## Obligaciones comunes: estado conciliado y evidencia

| ID | Obligación oficial (§2, p. 2) | Criterio de aceptación del equipo | Evidencia prevista | Estado |
|---|---|---|---|---|
| O01 | Tres o más agentes con roles distintos y comunicación | Flujo de un caso con ≥3 agentes y artefactos/versiones relacionados | Definiciones y modos implementados; falta traza correlacionada | Evidencia de colaboración pendiente |
| O02 | Herramienta con acción real | Persistir acción aprobada y consultar efecto/recibo | Servicios y pruebas de reservas/postulaciones; integración D5–D7 y entrega D8 | Implementado; demo real pendiente |
| O03 | Cálculos/asignaciones/verificaciones con código | Cálculos con reglas de código y límites explícitos | C01 matcher/planner y suites; no solver global laboral | Implementado con alcance acotado |
| O04 | Humano aprobar/corregir decisiones clave y explicación | Confirmación vigente, explicación y denegación sin aprobación | Revisión de propuestas, consentimientos y D8 corregido | Implementado y probado localmente; aceptación real pendiente |
| O05 | Trazabilidad de decisiones por agente | Correlacionar agente, entrada, herramienta, aprobación y efecto | Trazas/eventos por ámbito; falta caso consolidado de tres agentes | Parcial; evidencia integrada pendiente |
| O06 | Al menos 15 casos, métrica y resultados | 15+ casos con métrica y resultados reproducibles | 20 diseñados en evals/casos.csv; sin resultados registrados | Pendiente de ejecución/registro formal |
| O07 | Guardrails ante entradas maliciosas, fuera de alcance o absurdas | Rechazar entradas inválidas o no autorizadas sin actuar | Guardrails y pruebas técnicas; falta consolidar evals adversarios y de modelo | Parcialmente verificado; evals pendientes |
| O08 | Sistema agéntico, no chat reemplazable por prompt | Recorrido ingreso → decisión → aprobación → acción → consulta | E2E sintéticos y efectos reales locales; ensayo con cuentas reales pendiente | Implementado por bloques; demo final pendiente |

Los agentes desarrolladores de MAGI no cuentan como agentes del producto. Las pruebas internas de MAGI no sustituyen los 15 evals del producto.

Precisión de diseño tras releer §§1–2/5.4: el enunciado exige agentes que perciben, deciden y actúan, roles distintos comunicados y cálculos con código; no dice que cada uno deba trabajar sin herramientas o datos de otros. El equipo añade capacidad de invocación individual con entradas suficientes y pruebas aisladas, además del recorrido colaborativo. [Contrato y propuesta de modelos](AUTONOMIA_CONTRATOS_MODELOS.md), I01–I08 diseñados, no ejecutados. No contar una plantilla sin decisión/herramientas como autonomía demostrada.

## Alcance específico oficial (§5, pp. 6-7)

Construir mercado de tres lados: jóvenes, empresas, centros de formación; asignar, agendar y reacomodar con datos sucios y restricciones de transporte, tiempo y dinero. Añadir orientador humano. Los jóvenes pueden carecer de CV y tener experiencia informal; empresas tienen pocas vacantes y requisitos vagos/discriminatorios; centros tienen cupos/horarios fijos.

| ID | Necesidad/entrada del enunciado | Evidencia por producir | Clasificación |
|---|---|---|---|
| R01 | Representar jóvenes, empresas y centros de formación | Modelo de datos y escenario con los tres lados | Objetivo específico |
| R02 | Asignar, agendar y reacomodar | Flujo de asignación, agenda y cancelación con reasignación | Objetivo específico |
| R03 | Respetar traslado, horario, salario y presupuesto | Reglas explícitas, unidades y evals de límites | Objetivo específico |
| R04 | Normalizar información incompleta/sucia y pedir datos faltantes | Entradas crudas, extracción y confirmación | Contexto del problema |
| R05 | Ofertas: texto, foto de volante, WhatsApp y PDF | Matriz de formatos implementados/limitados y muestras | Entradas esperadas §5.3 |
| R06 | Perfil: CV PDF, foto de CV o sin CV | Ingreso y entrevista para completar habilidades | Entradas esperadas §5.3 |
| R07 | Entrevistas por nota de voz | Transcripción revisable o límite explícito del prototipo | Entradas esperadas §5.3 |
| R08 | Explicar viabilidad geográfica, evitar recomendaciones inviables | Fuente/estimación de tiempo y costo; incertidumbre visible | Contexto del problema |

## Funciones sugeridas (§5.4, p. 7)

El documento titula esta lista «Agentes mínimos sugeridos». El mínimo inequívoco común es tres agentes. Planificar cobertura de las siete funciones; permitir agrupación y registrar cualquier recorte. Consultar organizadores si exigen siete instancias separadas.

| ID | Función sugerida | Cobertura propuesta |
|---|---|---|
| S01 | Inteligencia de mercado: normalizar con taxonomía tipo ESCO, detectar discriminación y tendencias | A01 + C02 para alertas/bloqueos; catálogo compartido versionado y fuentes |
| S02 | Perfil: leer CV, entrevistar y descubrir habilidades no declaradas | A02 + A01 para mapa de curso; preguntas/evidencias con fuente, sin inventar experiencia |
| S03 | Matching con capacidades, traslado, horario y salario | A03 + solver determinístico |
| S04 | Ruta óptima de cursos con cupos, horarios, costo y transporte | A05 + C01 planificador; A03 entrega brecha y A01 mapa de curso |
| S05 | Adaptar CV/carta, agendar entrevistas y enviar listas cortas | A04; acción local aprobada en primera versión; envío externo pendiente |
| S06 | Entrevista simulada para una oferta y retroalimentación | A04; sesión separada de postulación |
| S07 | Auditor: medir sesgo cambiando nombre/género/corregimiento; bloquear discriminación | C02 + análisis semántico de agentes y pruebas contrafactuales; auditoría transversal sin agente LLM separado |

## Rúbrica (§7, p. 8)

| Peso | Criterio | Prioridad de evidencia |
|---|---|---|
| 30% | Impacto y solución del problema | Problema concreto, beneficiarios, datos verificables, restricciones reales |
| 25% | Diseño agéntico | Roles, comunicación, herramientas, autonomía, código determinístico, humano |
| 20% | Funcionamiento en vivo | Demo reproducible de extremo a extremo |
| 15% | Robustez | Evals, guardrails, errores y datos inesperados |
| 10% | Presentación y bitácora de IA | Explicación clara, transparencia y documentación |

## Ambigüedades y decisiones pendientes

Confirmar ventana oficial, registro del repo y aceptación del alcance acotado de las funciones sugeridas. Stack cerrado y utilizado: React/TSX, Vite, Hono/Bun y Prisma/PostgreSQL/Supabase. Los agentes implementados usan Vertex mediante REST/ADC; sus ejecuciones registradas y límites están en ESTADO_ACTUAL.md. Catálogo acotado y datos DEMO; no hay integración automática de transporte ni equivalencia completa ESCO. No confundir modelos de desarrollo con agentes del producto. El texto remite a sección 6 para datos, pero esa sección contiene entregables; no aporta dataset ni enlaces: investigar y registrar fuentes, sin inventarlos.

Consultar FLUJO_TRABAJO.md, AGENTES.md, ENTREGABLES.md y REGISTROS.md. La matriz vigente distingue implementación, verificación técnica y evidencia formal pendiente; no interpretar los pendientes administrativos o de eval como ausencia de todo el software.

Revisión integral vigente: [dos referencias y plan por condiciones de salida](REVISION_INTEGRAL_PLAN.md), con CU/entidades/agentes y escenarios X13–X15. No cambiar requisitos oficiales por opiniones de modelos. Factibilidad del plan y ciclo/revisión separados; prerrequisitos se verifican por criterio/evidencia, sin dominio automático por curso terminado. Supabase Auth/alta controlada/reserva inmediata confirmados e implementados dentro del alcance documentado. Las decisiones de ampliaciones no implementadas permanecen separadas del estado actual.
