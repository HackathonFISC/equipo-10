# Cómo colaboran los agentes de IA

> **Estado conciliado — 2026-10-17:** consultar [ESTADO_ACTUAL.md](ESTADO_ACTUAL.md) para distinguir implementación, evidencia histórica y pendientes de entrega. D8 figura corregido localmente y su migración remota aplicada/verificada; el ensayo manual completo y la traza de tres agentes siguen pendientes. Los evals finales están en [el paquete reproducible](../evals/README.md).
Actualizado: 2026-10-17. Referencia de implementación para AImpulsa; no sustituye los contratos de API ni acredita una ejecución que no se haya registrado.

## 1. Qué significa colaborar en este sistema
Cada agente tiene una responsabilidad y herramientas limitadas. Los servicios de la API controlan qué recibe, validan su salida y guardan datos/versiones después de las confirmaciones necesarias. Otro agente puede consultar esos resultados autorizados.

La comunicación se realiza mediante **artefactos de dominio persistidos y contratos de herramientas**. No hay un chat libre entre cinco modelos, memoria global de todos los usuarios ni un bus de mensajes implementado. Se puede usar el mismo modelo para roles diferentes: la separación está en instrucciones, contexto, herramientas y permisos.

Las llamadas individuales a Vertex verificadas no prueban por sí solas el requisito de tres agentes comunicados en un caso. Esa evidencia correlacionada aún debe incorporarse.

## 2. Flujos de colaboración presentes
### A. Contenido formativo: A01 → revisión del centro → A02
1. Centro aporta temario y catálogo de competencias permitido.
2. A01 consulta fuente/catálogo y propone asociaciones con cita exacta. Distingue prerrequisito de resultado que el curso enseña.
3. Centro revisa/corrige y publica la versión del curso y sus resultados.
4. El servicio de evaluación consulta esa versión confirmada y construye la entrada de A02: course_version_id, catalog_version_id, syllabus_text y outcomes.
5. A02 lee el mapa y propone un banco objetivo. El centro revisa el banco antes de usarlo.
6. Joven consiente el intento; la API entrega preguntas sin clave correcta/rúbrica.
7. C01 corrige opciones en código. El joven decide asociar el resultado a su perfil; no se crea automáticamente una afirmación de dominio de toda la habilidad.

Código de intercambio: [publicación y mapa](../apps/api/src/modules/training-center/training-center.service.ts), [construcción de AssessmentSource y validación](../apps/api/src/modules/training-assessments/training-assessments.service.ts), [agente del banco](../apps/api/src/modules/training-assessments/assessment-agent.service.ts).

Este es un flujo que requiere intervención humana entre etapas. Las llamadas Vertex A01 y A02 se probaron separadamente; en la verificación integral, A02-banco agotó el tiempo. No presentar ese intento como una colaboración completa exitosa.

### B. Perfil: A02 → confirmación del joven → A03
1. Joven aporta texto o PDF con texto. El parser extrae fragmentos.
2. A02 consulta borrador, fuentes y búsquedas permitidas; propone experiencia, formación, intereses y competencias con referencias.
3. Joven revisa sugerencias. Los servicios guardan decisiones y una versión confirmada.
4. A03 consulta el perfil confirmado y una vacante normalizada/publicada. C01 calcula compatibilidad.
5. A03 explica el resultado, sus desconocidos y los datos por aclarar. No convierte una declaración sin evidencia en habilidad demostrada.

Código: [parser](../apps/api/src/modules/profile/multimodal-parser.service.ts), [A02](../apps/api/src/modules/profile/agent-a02.service.ts), [servicio de perfil](../apps/api/src/modules/profile/profile.service.ts), [servicio de oportunidades](../apps/api/src/modules/opportunities/opportunities.service.ts), [A03](../apps/api/src/modules/opportunities/agent-a03.service.ts).

### C. Vacante y ruta: A01/datos confirmados → C01 → A03 o A05
A01 propone requisitos; la empresa confirma/publica. A03 usa la vacante y el perfil para explicar una comparación. El servicio de planificación también lee el perfil y los requisitos de la vacante, calcula con C01 y persiste el plan; A05 consulta ese plan y explica su ruta.

**Precisión:** el planificador no invoca automáticamente A03 ni consume obligatoriamente su texto de explicación. Existe una dependencia funcional de las brechas, pero no se debe dibujar un mensaje directo A03 → A05 como ejecución actual si el caso no lo registra.

Código: [A01 vacante](../apps/api/src/modules/recruitment/agent-a01.service.ts), [planificación](../apps/api/src/modules/planning/planning.service.ts), [C01 matcher](../apps/api/src/modules/opportunities/c01-matcher.ts), [C01 planner](../apps/api/src/modules/planning/c01-planner.ts), [A05](../apps/api/src/modules/planning/agent-a05.service.ts).

### D. De propuesta a acción real
La explicación no es una orden autorizada. El joven confirma postulación o reserva; empresa/centro confirman sus objetos; orientador revisa solo la ruta autorizada cuando participa. Los servicios revalidan autorización, versiones, condiciones e idempotencia y guardan efecto/recibo en transacciones.

Código: [postulación y consentimiento](../apps/api/src/modules/recruitment/applications.service.ts), [reservas](../apps/api/src/modules/reservations/reservations.service.ts), [orientación](../apps/api/src/modules/orientation/orientation.service.ts), [withActor](../apps/api/src/infrastructure/database.ts).

No contar este CRUD como A04. A04 materiales/práctica sigue aplazado. El caso de reserva independiente de la misma edición figura corregido en [D8_ENTREGA.md](D8_ENTREGA.md); el [despliegue remoto D8](CIERRE_MIGRACIONES_REPOSITORIO.md) está aplicado y verificado. Sigue pendiente demostrar el recorrido completo con cuentas reales.

## 3. Dónde están los prompts y las herramientas
Las instrucciones se construyen en código; la referencia es el archivo y símbolo vigente, no una captura de una conversación de desarrollo. La columna «instrucción» es un resumen explicativo, no una copia literal del prompt completo.

| Agente/modo | Archivo y ubicación del prompt | Instrucción principal | Herramientas declaradas |
|---|---|---|---|
| A01 vacante | [agent-a01.service.ts](../apps/api/src/modules/recruitment/agent-a01.service.ts), systemInstruction en analyzeVacancy | Traducir tareas a ocupación/competencias del catálogo; detectar ambigüedades y alertas; proponer sin publicar | buscar_catalogo_ocupaciones, buscar_catalogo_competencias, proponer_vacante |
| A01 temario | [syllabus-agent.service.ts](../apps/api/src/modules/training-center/syllabus-agent.service.ts), systemInstruction en runSyllabusVertex | Fuente no confiable; citas exactas, IDs canónicos y separación de prerrequisitos/resultados | read_syllabus, read_competency_catalog, submit_syllabus_mapping |
| A02 perfil | [agent-a02.service.ts](../apps/api/src/modules/profile/agent-a02.service.ts), systemInstruction del bucle de interpretación | No inventar experiencia/fechas/evidencia; revisar fuentes y hacer preguntas breves sobre faltantes | read_profile_draft, read_source_fragments, search_occupations, search_competencies, save_profile_proposals |
| A02 banco | [assessment-agent.service.ts](../apps/api/src/modules/training-assessments/assessment-agent.service.ts), systemInstruction en runAssessmentVertex | Preguntas objetivas fundamentadas en mapa confirmado; propuesta para revisión humana | read_confirmed_course_map, submit_assessment_bank |
| A03 | [agent-a03.service.ts](../apps/api/src/modules/opportunities/agent-a03.service.ts), systemInstruction en executeVertexLoop | Explicar C01 sin alterar factibilidad/cifras; consultar datos y aclarar desconocidos | read_comparison_trace, read_vacancy, read_confirmed_profile, evaluate_compatibility, submit_explanation |
| A05 | [agent-a05.service.ts](../apps/api/src/modules/planning/agent-a05.service.ts), systemInstruction en executeVertexLoop | Explicar ruta C01; no inventar costos/cursos ni reservar; respetar factibilidad | leer_resultado, leer_meta_perfil, buscar_ediciones, calcular_rutas, entregar_explicacion |

La declaración y el despacho de herramientas están en esos archivos. Su existencia no demuestra que todas se invocaran en una ejecución: la evidencia debe registrar las llamadas observadas. El servidor aplica la autorización; la redacción del prompt no sustituye RLS ni transacciones.

Configuración del proveedor: [vertex-auth.ts](../apps/api/src/modules/profile/vertex-auth.ts). Usa Vertex/ADC; las pruebas citadas registran gemini-3.8-flash. No incluir tokens/ADC en documentos ni presentar IA inyectada como Vertex real.

## 4. Qué mostrar en código y capturas
Para cada agente mostrar: objetivo, entrada permitida, instrucciones, herramientas, validación, revisión humana y un resultado observable. Bastan un fragmento breve del prompt y otro del despacho/validación, enlazados al archivo exacto.

Ejemplo real del diseño: A01 temario exige citas del original; TrainingAssessmentsService valida que la cita esté contenida en syllabus_text y que competency_id pertenezca al mapa confirmado. Esa comprobación de código es más defendible que mostrar únicamente el texto del prompt.

No pegar chats completos ni convertir capturas de instrucciones en prueba de funcionamiento. Las capturas se eligen en la [guía de presentación](GUIA_PRESENTACION_Y_EVIDENCIAS.md); no se han creado nuevas capturas como parte de esta actualización documental.

## 5. Evidencia mínima para demostrar tres agentes colaborando
Preparar un mismo caso sintético con fuentes, perfil, vacante/curso y versiones identificables. Registrar:
- IDs de objetos y relación entre resultados producidos y consumidos.
- Agente/modo, proveedor/modelo observados y herramientas realmente llamadas.
- Confirmaciones del dueño entre propuestas y datos utilizables.
- Cálculo determinístico, aprobación aplicable y efecto persistido consultable.
- Resultado, errores, tiempos y límites; sin datos personales completos ni razonamiento interno.

No hay que ejecutar todos los agentes por cada clic. Un registro de mínimo tres agentes de casos distintos no se transforma en colaboración simplemente asignándoles un identificador al redactar el informe. El mapeo CU/agentes es diseño; la traza de ejecución debe corresponder al código de la versión entregada.
