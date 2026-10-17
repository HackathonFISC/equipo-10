# Revisión de D1–D7, agentes y entregables

> **Lectura histórica — conciliación 2026-10-17:** se conservan el alcance, resultados y autoría de la ejecución original. Los pendientes de aquel momento no describen automáticamente la entrega actual. Consultar [estado vigente](ESTADO_ACTUAL.md), [D8 corregido](D8_ENTREGA.md) y [despliegue aplicado/verificado](CIERRE_MIGRACIONES_REPOSITORIO.md). Esta nota no repite pruebas ni cambia resultados anteriores.

Fecha: 2026-10-17. Revisor: Codex. Dictamen: **NO APROBAR todavía el cierre integral ni afirmar cinco agentes validados**. Hay producto funcional e integración previamente documentada, pero faltan evidencias obligatorias y se reprodujeron defectos del planificador/A05.

Actualización de alcance posterior por decisión humana: audio, notas de voz, fotos e imágenes están excluidos de la entrega actual y no son tareas de cierre. Se mantienen texto y PDF con capa de texto, incluida una capa OCR preexistente. El parser no implementa OCR sobre escaneos sin texto. Las menciones históricas de formatos pendientes en este informe no ordenan implementarlos; H01–H05 y los entregables/evidencias restantes conservan su vigencia.

Revisión de solo lectura del código y documentación; este informe es el único archivo creado. No se corrigieron archivos de implementación ni bitácora; no hubo migraciones, fixtures que limpien BD, llamadas pagadas Vertex, commit, push o tag. Build creó sus artefactos habituales ignorados. No se probaron sesiones reales ni se repitió el despliegue remoto.

## Base y evidencia de esta revisión

- Enunciado local aportado: magi/contexto/RETO_OFICIAL.md, §§2, 5, 6 y 7. Se distingue obligación de sugerencia. §§2 exige tres agentes distintos comunicados, herramienta de acción, cálculo con código, humano, trazabilidad, 15 casos con métrica/resultados y guardrails. §5.4 describe agentes mínimos sugeridos; no establece inequívocamente siete instancias separadas.
- Documentos de alcance, contratos, CU/RGN, plan D1–D9, informes de integración y despliegue, README, metodología, arquitectura, registros, bitácora y evals. Inspección focal de agentes y callers, C01, reservas, RLS y pruebas.
- `bun run typecheck`: exit 0.
- `bun run build`: exit 0; aviso de bundle de aproximadamente 820 kB, no bloqueante para esta revisión.
- `bun test tests/api/c01-matcher.test.ts tests/api/c01-planner.test.ts tests/api/a02-result.test.ts`: **36 PASS, 0 FAIL, 204 aserciones**. Son 19 matcher, 8 planner y 9 A02; no son 36 evals semánticos oficiales.
- Dos reproducciones adicionales con datos y adaptador de BD sintéticos en memoria, sin red ni persistencia: fallan las invariantes descritas abajo. No se contaron como pruebas aprobadas.
- `INTEGRACION_D5_D7.md` documenta 66 pruebas, tres recorridos con IA inyectada/autenticación sintética y despliegue Supabase check/apply/verify. **Evidencia histórica inspeccionada; no reejecutada en este turno**. Igual distinción para llamadas reales previas A01/A02/A03/A05.
- HEAD inspeccionado: `5e448e0`, con modificaciones y módulos no registrados en Git. Los resultados actuales corresponden al árbol de trabajo, no a un commit final reproducible. No se observó tag `final-24h`.

## Hallazgos prioritarios

### H01 — P1: A05 acredita una declaración como evidencia

Ubicación: `apps/api/src/modules/planning/agent-a05.service.ts:253`, herramienta `toolCalcularRutas`. Construye todas las declaraciones con `hasEvidence: true`. El servicio normal de planificación sí consulta `evidenceLinks.length > 0`; ambos caminos no aplican la misma regla.

Reproducción ejecutada: plan de una meta con una competencia esencial; perfil con claim ACCEPTED y cero evidenceLinks; cero cursos disponibles. Invocar toolCalcularRutas mediante adaptador sintético. Resultado: VIABLE, cobertura 1 y traza `allRequirementsMet:true`, `candidateDemonstratedCount:1`. Se afirma demostración sin evidencia. No basta fijar al final el enum de factibilidad de la explicación: el resultado intermedio y los motivos que recibe el modelo ya son incorrectos.

Corrección necesaria: reutilizar un único adaptador de perfil/C01 que compruebe evidencia y versión; añadir regresión negativa que compare vista previa y herramienta A05 para la misma entrada.

### H02 — P1: horario/traslado desconocidos se convierten en compatibilidad

Ubicación: `apps/api/src/modules/planning/c01-planner.ts:146` y `:324`. Traslado ausente pasa a cero; disponibilidad vacía omite el control. `transportBudget` se declara y transporta, pero no se utiliza en el cálculo del costo de transporte.

Reproducción ejecutada: perfil sin ventanas y sin supuesto de traslado, presupuesto formativo 100 y transporte 0; un curso con sesión presencial lunes 08:00–10:00, gratuito y que cubre la brecha. Resultado: VIABLE, un paso y motivo «Horarios plenamente compatibles con tu disponibilidad semanal y traslados».

Corrección necesaria: marcar logística desconocida como PENDING y pedir aclaración; no afirmar compatibilidad comprobada. Para dinero/traslado, introducir costo y fuente/supuesto explícito o declarar su evaluación pendiente. No inventar tarifas ni asumir que cero significa dato desconocido. Las ocho pruebas existentes de planner pasan y no cubren esta frontera.

### H03 — P1 de evidencia: A05 puede registrar éxito sin entrega del modelo

Ubicación: `apps/api/src/modules/planning/agent-a05.service.ts:642–680`. Si el bucle no obtiene entregar_explicacion, genera resumen en código con status completed, lo persiste y la envoltura lo identifica como proveedor Vertex. Observado en código; no se ejecutó esta rama en el turno.

Corrección necesaria: distinguir resultado determinístico del resultado del agente, origen y estado, o devolver fallo/pending preservando C01. No contarlo como ejecución autónoma exitosa del modelo. Verificarlo con respuesta Vertex simulada sin llamadas de herramientas.

### H04 — P1 de entrega: evals obligatorios sin resultados publicados

`evals/` contiene únicamente casos.csv. Sus **20 filas** siguen DISEÑADO_NO_EJECUTADO; no hay archivo de resultados. Fixtures/tests técnicos de D3/D4/D7 y sus PASS son evidencia útil, pero no prueban por sí solos las expectativas y métricas de cada E01–E20.

Falta ejecutar/publicar al menos 15 casos con entrada, esperado, métrica, umbral, observado, PASS/FAIL, fecha, entorno/proveedor y referencia a versión/traza. Pueden mapearse pruebas existentes cuando cubran exactamente la expectativa; no renombrarlas ni declararlas aprobadas sin esa correspondencia. Reportar formatos/facultades no implementados como límite o pendiente; no simular audio/foto/A04. La calidad semántica requiere gold y resultados, no solo que JSON valide.

### H05 — P1 de entrega: colaboración de tres agentes todavía no demostrada en una evidencia común

Hay dependencias implementadas y transferencia persistida de datos, especialmente mapa A01 → banco A02, y perfil/meta → comparaciones/rutas. Existen herramientas y eventos por módulos. No se localizó una ejecución de entrega que enlace al menos tres agentes reales con el mismo caso, versiones, salidas consumidas, herramientas, intervención humana y efecto final consultable.

Esto es **evidencia insuficiente**, no afirmación de que sea necesaria una conversación directa entre LLMs. La comunicación por artefactos/BD y coordinación de código es válida si se demuestra. Preparar un caso acotado con tres agentes, conservar IDs y trazas sanitizadas, distinguir llamadas reales de simulaciones y verificar el efecto. Los agentes desarrolladores MAGI no cuentan como agentes del producto.

### H06 — P2: documentación final contradice el producto y los casos

- README y METODOLOGIA siguen anclados en D1/27 tablas, aunque existen migraciones posteriores. Metodología llama microservicios a la API modular y atribuye cálculo de rutas/tarifas MiBus/Metro y salario mínimo legal; el código inspeccionado usa supuestos de traslado y mínimo declarado, sin probar esos servicios externos o cálculo legal.
- A04 y orientador se describen como disponibles, aunque A04 se aplazó y D8 tiene solamente plan. Arquitectura declara en su cabecera diseño sin implementar, mientras otras secciones del paquete hablan de cinco agentes integrados.
- README agrupa E01–E20 con descripciones distintas a las filas reales: por ejemplo E01 es flujo de tres lados, no inyección. Debe describir el set real y su estado.
- Hay diagrama Mermaid en METODOLOGIA/ARQUITECTURA_AGENTES; no falta todo diagrama. Falta reconciliar lo implementado con lo propuesto y las herramientas/confirmaciones reales. El enunciado no exige una extensión de archivo específica.
- Enlaces locales faltantes: ARQUITECTURA_AGENTES → OPINION_VERTEX_ARQUITECTURA_MAPEO.md; REGISTROS → PLAN_FIGMA_DISENO_PLATAFORMA.md, FIGMA_PRIMER_BLOQUE.md, ENTREGA_FIGMA_V1.md. No se deben copiar evidencias privadas de MAGI para reparar enlaces sin sanitizarlas.

## Estado por etapa

| Etapa | Dictamen de alcance actual | Pendiente material |
|---|---|---|
| D1 | Base implementada; evidencia histórica de identidad, permisos y BD | Aceptación final con cuentas reales; instalación limpia y roles demo reproducibles |
| D2 | Texto y PDF digital, propuestas revisables y perfil persistido implementados | No declarar OCR/foto/audio ni compatibilidad universal de CV; evals de extracción y entradas adversarias |
| D3 | Comparación C01/A03 implementada; 19 tests matcher reejecutados pasan | Evidencia colaborativa de entrega; explicitar traslados estimados y alcance de matching, sin prometer asignación global con capacidades |
| D4 | Cursos, planner, A05 y reservas implementados, con pruebas históricas | H01–H03 impiden cierre sin reservas; cubrir logística desconocida y validar extremo a extremo actual |
| D5 | Alcance reducido de candidatura consentida implementado e integrado | A04, CV/carta adaptados y práctica privada aplazados; no declarar D5 completo original |
| D6 | Vacante A01 y consulta empresarial minimizada del alcance reducido implementadas | Entrevista bilateral, selección global avanzada, tendencias y formatos adicionales aplazados |
| D7 | Núcleo integrado: temario, banco humano, ejercicio objetivo, asociación, finalización y PDF privado | Abiertas, formación externa sin temario, nuevas ediciones/versiones y correcciones históricas; recorrido completo UI reserva → finalización no demostrado por los tests con reserva sembrada |

## ¿Son válidos todos los agentes?

| Agente | Implementación observada | Qué permite afirmar |
|---|---|---|
| A01 contenido/vacante/temario | Servicios de recruitment y training-center, herramientas de catálogo/propuesta y revisión humana | Agente implementado; pruebas reales previas descritas en documentación. Calidad semántica global pendiente |
| A02 perfil/aprendizaje | Bucle de perfil, fragmentos, propuestas; banco ligado a mapa confirmado y corrección objetiva separada | Agente implementado; 9 pruebas de resultado reejecutadas pasan. No todos los formatos/modos están cubiertos |
| A03 compatibilidad | Herramientas de perfil/vacante/C01/traza/entrega, decisión numérica en código | Agente implementado; evidencia previa de Vertex; no equivale a solver global de asignación |
| A04 postulación/práctica | No se encontró servicio de agente A04; su alcance está explícitamente aplazado | **No implementado ni validado**. El CRUD de candidatura no lo sustituye |
| A05 ruta | Bucle Vertex y herramientas C01, resultado persistido | Implementado, **validación condicionada por H01–H03**; no declararlo cerrado |

No se requiere un modelo diferente por agente ni prohibir código determinístico. El mínimo común de tres roles distintos puede cubrirse con los implementados, pero exige evidencia de comunicación y funcionamiento, no contar archivos o cinco nombres en un diagrama. Autonomía individual y colaboración se verifican por separado. No se reejecutó Vertex en este turno; credenciales/configuración no prueban acceso actual.

## Bitácora y entregables

BITACORA_IA.csv se pudo leer como CSV: **82 entradas**. Distingue ideas/dirección humanas de IA y registra integración D5/D6+D7, pruebas y límites. No está vacía ni completamente desactualizada. Falta conciliar nuevas acciones/documentos y correcciones finales, identificar modelo/proveedor solo cuando se conozca y enlazar evidencias sanitizadas. La entrada final actual cubre integración; no registrar esta auditoría como reparación implementada.

| Entregable | Estado observado y cierre necesario |
|---|---|
| Repositorio | Existe checkout e historial; parte importante del producto permanece modificada/no registrada. Verificar registro ante organización y preparar commit final limpio cuando el usuario autorice publicación |
| Tag final-24h | No observado. Crear/publicar solo con ventana oficial y acción correspondiente autorizadas; no retrofechar |
| README | Existe; corregir alcance, agentes reales, setup BD/migraciones, cuentas demo y límites; probar instalación limpia |
| Arquitectura | Existen diagramas; actualizar al código y marcar funciones aplazadas, herramientas, datos, mensajes y humano |
| Evals | 20 diseñados, cero resultados consignados en ese set; entregar 15+ ejecutados con métricas/evidencia |
| Bitácora IA | 82 entradas legibles, integración cubierta; reconciliar el cierre y referencias sin inventar autoría |
| Metodología | Existe; corregir estado, arquitectura física, cifras y afirmaciones no implementadas; documentar operación, fallos y recuperación |
| Formularios del día | El enunciado menciona metodología adicional a formularios; cumplimiento administrativo no verificado |
| Demo por perfiles | Guion existente; faltan cuentas/sesiones reales preparadas, ensayo completo y límites visibles |
| PPT | Guion existente; no se localizó archivo de presentación en el producto |
| Video | Usuario descartó producirlo. El enunciado local aún lo lista: decisión del equipo, sin evidencia de exención organizadora; no afirmar dispensa ni producirlo contra la instrucción humana |

El documento oficial menciona fechas 9–10 de octubre y equipos de tres; equipo humano confirmado es Mainor y Giovanny y sesión actual 17 de octubre. Conservar ambas fuentes, confirmar administrativamente ventana y registro sin añadir personas ni simular cumplimiento temporal.

## Orden de cierre recomendado

1. Reparar H01–H03 con regresiones dirigidas; incluir capacidad real en rutas bajo RLS al revisar los callers, sin confiar en conteos de reservas privadas visibles solo al actor. La reserva transaccional sigue siendo la autoridad del cupo.
2. Completar D8 conforme a su plan si se mostrará orientador; no usar aprobación ficticia para la demo.
3. Fijar alcance entregable: cuatro agentes implementados, A04 aplazado; no desarrollar funciones nuevas solo para sostener texto viejo.
4. Ejecutar set acotado de 15+ casos y una colaboración de tres agentes con trazas; reutilizar evidencia técnica válida sin hacer llamadas IA para CRUD o repetir suites enteras.
5. Reconciliar README, arquitectura, metodología, registros y bitácora con resultados reales y límites. Ensayar cuentas reales de joven/empresa/centro/orientador y recuperación tras recarga.
6. Preparar PPT/paquete y revisión de archivos sensibles; publicación/tag requieren la acción final correspondiente. No incluir MAGI, ADC, .env, CV personales, certificados reales ni logs privados.

El dictamen no elimina el trabajo logrado: diferencia base implementada, alcance reducido aceptado, fallos reproducidos y evidencia pendiente para una entrega defendible.
