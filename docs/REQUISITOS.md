# Requisitos del reto 3: Empleabilidad

Estado: análisis del enunciado; producto aún sin implementar. Fuente: `magi/contexto/RETO_OFICIAL.md`, documento aportado por el equipo. Referencias por sección y página impresa. No convertir sugerencias en obligaciones textuales.

## Marco oficial

- §1, pp. 1-2: elegir un reto; 24 horas continuas, presencial; equipos de tres; máximo cinco equipos por reto; herramientas/modelos/nube libres; investigar y conseguir datos propios; documentar uso de IA; evaluación final en CONTECS 2026.
- Regla de oro, §1 p. 2: construir sistema que perciba, decida y actúe; una interfaz sustituible por un prompt no califica.
- README del repo: `Reto: 3`; no cambiar reto sin autorización organizadora.
- Fechas del enunciado: 9-10 octubre 2026. Sesión de preparación: 16 octubre 2026. Confirmar calendario y ventana oficial; no afirmar cumplimiento, retrofechar commits ni crear congelamiento por inferencia.
- Equipo confirmado por el usuario: Mainor Villarreal y Giovanny Arpaia. No incorporar ni solicitar un tercer integrante. Conservar como dato del enunciado la mención de equipos de tres, sin alterar la composición confirmada. Verificar registro oficial del repositorio.

## Obligaciones comunes: comprobar con evidencia

| ID | Obligación oficial (§2, p. 2) | Criterio de aceptación del equipo | Evidencia prevista | Estado |
|---|---|---|---|---|
| O01 | Tres o más agentes con roles distintos y comunicación | Ejecutar flujo con al menos tres identidades de agente y mensajes relacionados por caso | Traza y definición de agentes | Pendiente |
| O02 | Herramienta con acción real | Persistir asignación aprobada; mostrar cambio real consultable, no solo texto | Registro antes/después y prueba | Pendiente |
| O03 | Cálculos/asignaciones/verificaciones con código | Resolver elegibilidad, capacidades, horarios y costos con reglas/solver determinísticos | Código y evals reproducibles | Pendiente |
| O04 | Humano aprobar/corregir decisiones clave y explicación | Revisar propuesta y motivos; impedir ejecución sin aprobación vigente | Pantalla, evento de aprobación, prueba negativa | Pendiente |
| O05 | Trazabilidad de decisiones por agente | Correlacionar entrada, decisión, herramienta, aprobación y resultado | Traza sanitizada | Pendiente |
| O06 | Al menos 15 casos, métrica y resultados | Ejecutar set versionado y publicar resultados reales | evals/casos.csv y resultados | Pendiente |
| O07 | Guardrails ante entradas maliciosas, fuera de alcance o absurdas | Rechazar/derivar sin actuar; explicar la causa | Casos adversarios y logs | Pendiente |
| O08 | Sistema agéntico, no chat reemplazable por prompt | Completar ingreso → decisión → aprobación → acción → seguimiento | Demo de extremo a extremo | Pendiente |

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

Confirmar ventana oficial, registro del repo y exigencia sobre siete funciones/agentes. Elegir stack y modelos del producto, fuentes de ofertas/cursos/transporte, taxonomía y canales. No asumir que los modelos de desarrollo MAGI son los modelos de ejecución del producto. El texto remite a sección 6 para datos, pero esa sección contiene entregables; no aporta dataset ni enlaces: investigar y registrar fuentes, sin inventarlos.

Consultar FLUJO_TRABAJO.md, AGENTES.md, ENTREGABLES.md y REGISTROS.md. Estados «pendiente» significan sin evidencia implementada.

Revisión integral vigente: [dos referencias y plan por condiciones de salida](REVISION_INTEGRAL_PLAN.md), con CU/entidades/agentes y escenarios X13–X15. No cambiar requisitos oficiales por opiniones de modelos. Factibilidad del plan y ciclo/revisión separados; prerrequisitos se verifican por criterio/evidencia, sin dominio automático por curso terminado. Supabase Auth/alta controlada/reserva inmediata ya confirmados; otras decisiones técnicas pendientes.
