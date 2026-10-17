# Autonomía, respuestas y propuesta de modelos

> **Diseño/plan de su etapa — conciliación 2026-10-17:** los pasos futuros y alternativas siguientes conservan su contexto original; no son una lista de todo lo que falta hoy. Implementación y pendientes vigentes en [ESTADO_ACTUAL.md](ESTADO_ACTUAL.md) y [cobertura CU](CASOS_DE_USO.md#cobertura-actual-por-caso). Los casos diseñados no se presentan como ejecutados.

Fecha: 2026-10-16. Diseño para revisión, no agentes del producto implementados. Complementa [arquitectura](ARQUITECTURA_AGENTES.md), reparto (`AGENTES.md`, referencia interna no distribuida), [mapeo](MAPEO_CASOS_AGENTES.md), [fichas](ESPECIFICACION_CASOS_USO.md) y [requisitos](REQUISITOS.md). El usuario pide asegurar responsabilidad individual, estructurar respuestas y proponer modelos. No confundir agentes del producto con desarrolladores MAGI.

## Qué exige el enunciado y qué añadimos como criterio de diseño

Relectura del original `magi/contexto/RETO_OFICIAL.md`: regla de oro §1 exige percibir/decidir/actuar; §2 exige al menos tres agentes con roles distintos que se comuniquen, herramienta real, cálculos/rutas/asignaciones/verificaciones en código, humano que aprueba/corrige decisiones clave, trazas, ≥15 evals y guardrails. §5.4 sugiere siete funciones; no afirma que cada agente deba ejecutarlo todo solo ni prohíbe herramientas/componentes compartidos. No convertir «individual» en independencia absoluta de datos, herramientas o autorizaciones.

**Criterio de diseño que adoptamos:** cada agente puede invocarse por separado con un encargo y entradas mínimas válidas; tiene instrucciones/estado/herramientas acotados, elige cómo resolver ambigüedades y qué herramienta pedir, y entrega resultado verificable o estado pendiente/error. No necesita ejecutar toda la cadena ni depender de una conversación global con el coordinador. Si necesita datos confirmados de otro proceso, puede recibirlos por contrato; si faltan, los solicita, no los inventa. C03 coordina y hace cumplir límites, no toma todas las decisiones semánticas en lugar de los agentes.

Las decisiones de un agente incluyen pedir aclaración, elegir interpretación sustentada, proponer etiquetas/preguntas, solicitar verificador/solver y, tras observar su salida, explicar o pedir otra alternativa dentro del objetivo. Una plantilla de texto sin decisión ni herramientas no basta. Los agentes colaboran cuando el caso lo necesita, sin invocar cinco modelos para un CRUD simple.

## Sistema híbrido: IA + algoritmos + autorizaciones humanas

- IA: interpretar CV/experiencia/temario/oferta, detectar ambigüedades y alertas semánticas, preparar preguntas/materiales y explicar resultados de herramientas.
- C01/código: calcular cobertura, salario/costo/periodos, tiempos, conflictos, cupos, matching, rutas formativas y corrección de ejercicios objetivos. El LLM no sustituye esas cuentas.
- C02/código: permisos, consentimiento/versiones, aplicación de bloqueos, contrafactuales y trazas; exige análisis semántico vigente de A01/A03 cuando corresponde. Un formato JSON correcto no garantiza verdad ni autorización.
- C03/runtime: exponer herramientas permitidas, ejecutar las llamadas autorizadas, persistir estados/efectos y devolver recibos. El agente puede solicitar la herramienta; la aplicación valida argumentos, ámbito y aprobación antes de ejecutarla. El uso de este intermediario no convierte al agente en una función de texto pasiva.
- Humanos: cada dueño confirma sus datos/acciones; orientador ayuda al joven autorizado y revisa su plan, sin representar empresa ni centro. Autonomía nunca significa saltarse esta aprobación.

## Responsabilidad invocable por separado

| Agente | Entrada mínima de su encargo | Decisión IA propia | Herramienta propia expuesta por runtime | Resultado verificable individual |
|---|---|---|---|---|
| A01 Contenido | Oferta o temario con fuente, ámbito y versión; catálogo permitido | Interpretar requisitos/resultados, proponer etiquetas o pedir aclaración | Extraer, consultar catálogo, guardar borrador; publicación solo con confirmación | Mapa/requisitos con fragmentos, desconocidos y alertas; no exige CV ni plan |
| A02 Perfil/aprendizaje | Modo perfil: CV o respuestas; modo evaluación: mapa/banco revisado y permiso del joven | Qué preguntar, qué evidencia falta y cómo retroalimentar sin inventar dominio | Leer fuentes autorizadas, consultar banco, transcribir, verificar ejercicio, guardar evidencia propuesta | Perfil o intento vinculado a fuente/rúbrica; modo perfil no exige curso ni vacante |
| A03 Compatibilidad | Perfil/vacante confirmados, restricciones y versiones; ámbito/permiso | Qué aclarar, solicitar comparación/selección, interpretar brecha o alternativa | Motor de requisitos, logística, cobertura y solver de selección | Resultado calculado viable/inviable/pendiente, brechas y motivos; sin ruta formativa obligatoria |
| A04 Postulación/práctica | Modo postulación: perfil y oferta; modo práctica: puesto/oferta y permiso; modo cita: partes/disponibilidad | Adaptar material sustentado, elegir preguntas de práctica, proponer coordinación | Generar borrador, transcribir, consultar agenda, solicitar postulación/cita autorizada | Borrador/práctica o recibo real de acción; sin entrevista ficticia ni ejecución sin consentimiento |
| A05 Formación | Meta/brecha estructurada, perfil/restricciones y ediciones/mapas confirmados | Qué información falta, solicitar planificador y explicar opciones/brecha residual | Consulta catálogo/ediciones, C01 planificador, guardar propuesta de plan | Plan calculado con costo/agenda/restricciones o inviabilidad; puede recibir brecha directamente sin ejecutar A03 |

Herramienta «propia» significa incluida en la lista permitida del rol; puede reutilizar una implementación compartida. Guardar un borrador privado no autoriza publicar ni compartir. Cuentas/organizaciones y artefactos se comprueban por objeto en cada llamada; referencias aportadas por el cliente o LLM no conceden permisos.

## Modelo recomendado: propuesta pendiente de evals del producto

**Base propuesta:** usar `gemini-3.8-flash` por **Vertex AI** para los cinco agentes, con configuraciones, objetivos, herramientas y estados separados. Tener el mismo modelo no los vuelve un solo agente; cinco nombres sobre una única respuesta indiferenciada tampoco demuestran cinco agentes. Esta recomendación prioriza reutilizar la integración Vertex ya ejercitada en desarrollo y reducir integraciones iniciales; no afirma superioridad ni menor precio para nuestros casos sin medirlos.

| Agentes | Modelo base propuesto | Alternativa controlada |
|---|---|---|
| A01/A02 | Gemini 3.8 Flash por Vertex | Revisar muestras de etiquetas, preguntas y entradas multimodales antes de cerrar |
| A03/A05 | Gemini 3.8 Flash + motor C01 | Evaluar GPT-6 Sol `medium` en casos ambiguos complejos si las métricas justifican usarlo; solver sigue siendo código |
| A04 | Gemini 3.8 Flash por Vertex | Evaluar fidelidad del CV y práctica; sin añadir otro proveedor por defecto |
| C01/C02/C03 | Código, sin modelo propio | Análisis semántico lo solicitan los agentes; no automatizar sustituciones de proveedor ante fallos |

Alternativa de despliegue si las evals lo justifican: A01/A02/A04 en Gemini y A03/A05 en GPT-6 Sol `medium`. No es una asignación ya aprobada ni una garantía de mayor calidad. Antes de usar OpenAI en producto, comprobar acceso API, credenciales y facturación del producto; el acceso de OpenCode/MAGI no los demuestra. `medium` es esfuerzo de razonamiento, no modalidad Flex. No cambiar proveedores/configuración ni gastar llamadas de producto durante esta documentación.

La ficha oficial de [Gemini 3.8 Flash](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/3-8-flash) publica entrada de texto/imagen/audio y soporte de function calling y structured output. Eso respalda considerarlo para las entradas del reto; no demuestra precisión con nuestros documentos ni que los créditos cubran consumo. La [documentación Vertex de llamadas a funciones](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/tools/function-calling) separa solicitud del modelo de ejecución de herramienta por aplicación. La [salida estructurada](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/capabilities/control-generated-output) permite restringir esquema; conservar validación de aplicación, permisos y coherencia de negocio.

[GPT-6 Sol](https://developers.openai.com/api/docs/models/gpt-6-sol) documenta `medium` y uso de Responses API para herramientas/function calling; sería la opción propuesta si se usa con herramientas y razonamiento medium. No asumir capacidades de audio del mismo modelo; mantener transcripción validada separada o entrada multimodal Vertex. Consulta de fuentes: 2026-10-16. La selección final depende de calidad, latencia, consumo y permisos medidos en nuestro conjunto.

## Entrada común y respuesta interna

Entrada asignada por servidor: `task_id`, `case_id`, `agent_id`, `contract_version`, `task_type`, `goal`, `actor_scope_ref`, `consent_ref`, `input_refs`, `source_versions`, `tool_allowlist`, `budget_ref`. Objetivo y límites explícitos; solo datos necesarios. Los refs no son tokens de autorización. El servidor deriva identidad/ámbito de sesión confiable; no confiar en rol declarado en documento o respuesta del modelo.

Respuesta en JSON validado. No enviar razonamiento interno, conversaciones completas ni códigos binarios/base64. El texto al usuario es español claro; no exponer mensajes técnicos sin necesidad.

| Campo | Tipo / significado |
|---|---|
| `contract_version` | Versión de este formato, propuesta `agent-result/1` |
| `task_id`, `case_id`, `agent_id` | IDs que deben coincidir con encargo y ámbito verificados por servidor |
| `status` | `completed`, `needs_input`, `needs_approval`, `blocked` o `error` |
| `summary` | Explicación breve para la persona, basada en hechos/resultados observados |
| `decision` | Código de decisión, motivos y referencias de evidencia; no pensamiento interno |
| `data` | Objeto específico del agente; datos grandes por referencia, con versiones |
| `missing_fields` | Lista de campos desconocidos; no usar cero/cadena vacía como sustituto de desconocido |
| `questions` | Preguntas concretas para resolver faltantes, con campo/fuente a que pertenecen |
| `requested_actions` | Solicitudes propuestas con tipo/objeto/versión y motivo; nunca prueba de autorización o ejecución |
| `artifact_refs` | Resultados guardados que el runtime pueda comprobar; vacío si aún no existen |
| `evidence_refs` | Fuente/versión/fragmento y resultados de herramientas observados |

El runtime añade separadamente `tool_receipts`, `approval_state`, `effect_status` (`none`, `requested`, `confirmed`, `unknown`) y la traza con `message_id`/`parent_id` del sobre de arquitectura. Nunca aceptar esos campos autodeclarados por el LLM como evidencia. `completed` exige verificar el resultado del encargo: puede ser borrador preparado, cálculo consultado o acción confirmada, según `task_type`. Si el encargo era reservar, generar una solicitud no completa el encargo. Si solo era proponer plan, guardar propuesta no significa matrícula.

Invariantes: `needs_input` incluye campos/preguntas; `needs_approval` identifica objeto/versión y actor competente; `blocked` incluye motivo sin propuesta de bypass; `error` indica fallo y recuperación segura sin efecto supuesto. Salida inválida → error controlado o reparación acotada, sin ejecutar acciones extra. Escritura incierta → consultar clave única; no repetir ni anunciar éxito mientras `effect_status=unknown`.

Ejemplo ficticio de A03; etiquetas y refs son datos de demo, no cálculos ejecutados:

```json
{"contract_version":"agent-result/1","task_id":"t-demo","case_id":"c-demo","agent_id":"A03","status":"needs_input","summary":"Falta confirmar el salario y el tiempo de traslado para evaluar esta oferta.","decision":{"code":"MISSING_CRITICAL_DATA","reasons":["salary_unknown","travel_time_unknown"]},"data":{"feasibility":"pending","vacancy_ref":"vac-demo@2","profile_ref":"perfil-demo@3"},"missing_fields":["salary.amount_and_period","travel.minutes_per_trip"],"questions":[{"field":"salary.amount_and_period","text":"¿Cuál es el salario y su periodo de pago?"},{"field":"travel.minutes_per_trip","text":"¿Qué estimación de tiempo por trayecto podemos confirmar?"}],"requested_actions":[],"artifact_refs":[],"evidence_refs":["vac-demo@2","perfil-demo@3"]}
```

Datos específicos: A01 `requirements`/`learning_outcomes`/`tag_proposals`/`alerts`; A02 `profile_proposals` o `question_bank_ref`/`attempt_ref`/`evidence_proposals`; A03 `feasibility`/`coverage_result_ref`/`gaps`/`unknowns`; A04 `draft_refs`/`practice_ref`/`action_request_ref`; A05 `plan_ref`/`solver_result_ref`/`residual_gaps`. Cifras se toman de resultados C01 con procedencia; claves opcionales dependen de modo, sin rellenar datos ficticios para completar JSON. Esquemas técnicos por modo deben cerrarse antes de implementar.

## Comprobaciones individuales y de colaboración por diseñar/ejecutar

| ID | Escenario aislado | Resultado/medida esperada | Estado |
|---|---|---|---|
| I01 | Invocar A01 con vacante/temario sin CV | Etiquetas/requisitos con fuentes o aclaración; cero invocaciones obligatorias a A02–A05 | Diseñado, no ejecutado |
| I02 | Invocar A02 sin vacante, con experiencia informal; luego modo curso con banco autorizado | Perfil confirmado o preguntas válidas según modo; cero habilidades inventadas/certeza por LLM solo | Diseñado, no ejecutado |
| I03 | Invocar A03 con perfil/vacante fixtures, sin A05 | Consultar C01 y explicar brechas o pendientes; cero cálculos LLM sustituyendo solver | Diseñado, no ejecutado |
| I04 | Invocar A04 con perfil sin CV y oferta, sin ruta previa | Borrador sustentado; sin compartir/postular sin permiso; cero acciones ficticias | Diseñado, no ejecutado |
| I05 | Invocar A05 con meta/brecha explícita y cursos, sin ejecutar A03 | Llamar planificador y explicar costo/agenda/brecha residual; cero matrículas por recomendación | Diseñado, no ejecutado |
| I06 | Encargo de reservar; modelo afirma completado sin recibo o con error de herramienta | Runtime rechaza éxito; cero descuentos/confirmaciones ficticias, lectura por clave si incierto | Diseñado, no ejecutado |
| I07 | Cambiar actor o refs/versión de respuesta; formato JSON válido | Denegar fuera de ámbito y rechazar versión incorrecta; cero fugas ni privilegios extra | Diseñado, no ejecutado |
| I08 | Flujo A01→A02→A03→A05/A04 con interacción de herramientas y humano | ≥3 agentes reales deciden y se comunican con trazas; efecto aprobado consultable; no basta contar nombres | Diseñado, no ejecutado |

Estos casos complementan E01–E20 y X01–X12, sin convertirlos en resultados. Límites de tokens/pasos/tiempo/reintentos se fijarán por encargo y medirán; no ciclos ilimitados ni rotación de cuentas. El funcionamiento individual y cooperativo se demuestra con ejecuciones aisladas y de extremo a extremo sobre el mismo contrato.

## Concreción de registro/perfil D0-01

[Diccionario, permisos y estados v1](CONTRATO_REGISTRO_PERFIL.md), [API/A02](API_REGISTRO_PERFIL.md) y [aceptación](ACEPTACION_REGISTRO_PERFIL.md) concretan CU01 para D1-D2. Perfil parcial permitido; borrador y versiones inmutables separados; A02 solo propone, joven confirma. Sin schema/migración, API o modelo del producto ejecutados. Decisiones de otros módulos siguen pendientes.
