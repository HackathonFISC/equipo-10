# Orden D3 — Explorar oportunidades y entender brechas

> **Diseño/plan de su etapa — conciliación 2026-10-17:** los pasos futuros y alternativas siguientes conservan su contexto original; no son una lista de todo lo que falta hoy. Implementación y pendientes vigentes en [ESTADO_ACTUAL.md](ESTADO_ACTUAL.md) y [cobertura CU](CASOS_DE_USO.md#cobertura-actual-por-caso). Los casos diseñados no se presentan como ejecutados.

Fecha: 2026-10-17. Estado: PLAN DEFINIDO; NO IMPLEMENTADO NI VERIFICADO.
Destino: Gemini en Antigravity. Objetivo humano: avanzar por bloques, revisar durante el trabajo y evitar regresiones de D2. No promete ausencia de errores.

## Resultado visible

El joven abre Explorar, filtra vacantes demo, consulta una y ve qué cumple, qué falta y qué no se sabe según su perfil confirmado. Puede solicitar explicación a A03 por Vertex. Inicio propone una próxima acción coherente. Explorar no comparte su perfil, no postula ni consume plazas.

D2 se conserva con texto y PDF digital. No reabrir OCR, audio, edición de versiones confirmadas ni funcionalidades de D4–D8 como parte implícita de esta orden.

## Lectura mínima y arranque

1. Leer AGENTS.md; PLAN_DESARROLLO_ETAPAS.md sección D3; ESPECIFICACION_CASOS_USO.md CU03 y CU16 completos y RGN01–RGN14 transversales; GUIA_IMPLEMENTACION_Y_REVISION.md; REGLAS_COMPONENTES_CAPAS.md.
2. Leer AUTONOMIA_CONTRATOS_MODELOS.md para A03/C01 y CATALOGOS_CURSOS_PUESTOS_HABILIDADES.md; cotejar schema.prisma y contratos actuales. Las propuestas históricas no son tablas implementadas.
3. Revisar D2 solo por interfaces: lector del perfil confirmado, fuentes, claims, consentimientos, withActor, cliente HTTP y sesión. Leer CONSULTA_PERFIL_GUARDADO.md y CORRECCION_GUARDADO_LOTE_TIMEOUT.md.
4. Diseño: archivo Figma `cWPzNNsLPoUenKyfhf4Diu`, entrega v2 y sus referencias para Inicio/Explorar/detalle. Identificar nodos reales antes de implementar esas vistas. Si no hay acceso, usar evidencia documental existente y declarar fidelidad pendiente; no inventar que se consultó Figma.
5. Registrar estado inicial y ejecutar typecheck. Probar módulos que se tocarán; no consumir Vertex para comprobar archivos ni ejecutar simultáneamente suites que reinician la misma BD.

Skills pertinentes: magi-equipo10-desarrollo; magi-equipo10-validacion para revisión final; skills Figma al consultar/implementar sus diseños. Usar las disponibles realmente, sin afirmar carga o revisión no ejecutada.

## Decisiones de implementación acotadas

- Mantener React/TSX/Vite, Hono/Bun y Prisma/PostgreSQL, componentes y cliente HTTP existentes. No instalar otro framework, motor de estado ni un cliente API paralelo.
- Vacantes iniciales sintéticas, identificadas como demo con organización, fuente y versión. Catálogo pequeño versionado; no afirmar importación oficial de ESCO. No implementar administración de reclutador ni publicación real en D3.
- Modelo de producto A03: Gemini 3.8 Flash por Vertex, global, ADC; conexión directa desde API. No MAGI como intermediario de producción ni sustitución silenciosa de proveedor.
- C01 es código determinístico. La IA no decide cifras, elegibilidad, evidencias acreditadas ni porcentajes.
- Comparación usa perfil confirmado, incluido parcial. Sin él se puede explorar, pero se pide confirmarlo antes de comparar; no usar el borrador silenciosamente.
- Declarar una habilidad no la demuestra. Nombres de cursos no conceden habilidades. Falta de evidencia es desconocido, no incumplimiento probado.
- Crear y probar migraciones/fixtures solo en BD local aislada `127.0.0.1:55435/equipo10_d1_test`. Preparar artefactos para Supabase; no ejecutar despliegue remoto dentro de esta orden. No desactivar RLS para acelerar.

## Contratos a fijar en D3-0

Escribir `docs/CONTRATOS_D3.md` con Zod y DTOs correspondientes en packages/contracts; conservar sobre data/request_id y errores del proyecto. Las siguientes rutas son el objetivo; revisar colisiones y ampliar el allowlist del cliente existente únicamente para estas rutas:

| Método y ruta | Contenido / regla |
|---|---|
| GET /api/v1/opportunities | Vacantes demo activas; q, occupation_id, modalidad y paginación con tamaño máximo validado; filtros efectivos |
| GET /api/v1/opportunities/:id | Detalle con requisitos, salario/periodo/moneda, horario/vigencia, ubicación/modalidad, restricciones y refs de versión |
| POST /api/v1/me/opportunity-comparisons | vacancy_ref y perfil confirmado vigente resuelto en servidor; supuestos logísticos explícitos y limitados, sin sobrescribir perfil; Idempotency-Key; devuelve resultado C01 persistido y trazado |
| GET /api/v1/me/opportunity-comparisons/:id | Resultado propio, versiones y estado vigente/desactualizado; acceso ajeno denegado |
| POST /api/v1/me/opportunity-comparisons/:id/explanations | Consentimiento explícito para los datos enviados a Vertex, resultado C01 y refs autorizadas; Idempotency-Key; salida A03 validada, sin alterar cálculo |

Cerrar también entrada/salida de herramientas A03: read_confirmed_profile, read_vacancy, evaluate_compatibility (C01), read_comparison_trace y submit_explanation. IDs recibidos se autorizan en servidor; no aceptar actor/perfil ajeno ni cifras C01 aportadas por el modelo.

Datos mínimos a diseñar con migración incremental: vacante/versiones y requisitos referenciados a catálogo; resultado de comparación y dependencias; interpretación/consentimiento y traza sanitizada. Reutilizar catálogos, claims, recibos y auditoría existentes donde correspondan. No meter perfiles completos ni documentos en logs o recibos genéricos para evitar modelar permisos.

## Bloques secuenciales

### D3-0 — Contratos, mapa y fixtures esperados

Entregar CONTRATOS_D3.md y matriz `tests/fixtures/d3/expected.json` con entradas/resultados esperados definidos antes del algoritmo. Revisar faltantes reales de esquema, RLS y catálogo. Enumerar archivos exactos del siguiente bloque antes de editar. Resolver contradicciones entre contrato y código antes de UI o llamadas LLM.

### D3-1 — Datos y lectura de oportunidades

Módulo `apps/api/src/modules/opportunities/`: controller, service y module, helpers específicos solo si necesarios. Migración incremental, RLS y fixtures locales versionados. Lectura real de API/BD; no arrays duplicados en frontend. Pruebas de filtros/paginación, IDs inexistentes, datos demo explícitos y permisos. No perder tablas, registros, políticas o permisos D2.

### D3-2 — C01 y brechas con evidencia

Implementar cálculo puro y persistencia autorizada de resultado. Reutilizar claims existentes del perfil confirmado; si no hay claims utilizables, mostrar desconocido. Preparar perfiles sintéticos con claims revisados y fuentes en fixtures, sin hacerlos pasar por perfiles reales ni inferirlos de texto libre en C01.

Resultado por requisito: cumple/no_cumple/desconocido; esencial/deseable y de entrada/entrenable son ejes separados, declarados en la vacante. Mostrar satisfechos, evaluables y desconocidos. Cobertura = satisfechos/evaluables; si evaluables=0, porcentaje null, nunca 0% o 100% inventado. Desglosar esenciales/deseables; un esencial incumplido o desconocido no se oculta por cobertura alta.

Factibilidad: cualquier violación dura conocida → inviable; sin violación conocida y con datos esenciales desconocidos → pendiente; todas las restricciones esenciales comprobadas → viable. Brecha entrenable no equivale a habilidad adquirida ni empleo viable hoy. No crear niveles numéricos ni comparar cadenas como equivalencia canónica.

Salario/costos requieren moneda y periodo comparables. No conversiones de divisa ni mes→hora sin horas/frecuencia explícitas. Traslados requieren fuente, minutos por trayecto y frecuencia; no deducirlos del nombre de un barrio. Horarios requieren timezone y vigencia; desconocido mantiene pendiente. Todo supuesto consultado es visible y no modifica el perfil.

Invalidar resultados dependientes si cambian versiones de perfil, vacante, catálogo o supuestos. Probar lectura obsoleta. No consumir plazas ni hacer selección global en este cálculo individual. El solver de selección mencionado en CU03 queda como subcriterio pendiente hasta diseñar/probar capacidad de selección separada; no declarar CU03 íntegro cubierto por el comparador individual.

### D3-3 — Explorar, detalle y resultado útil sin LLM

Crear `apps/web/src/features/opportunities/` con hooks, vistas y tarjetas reutilizables. Conectar rutas reales y componentes compartidos, CSS Modules/tokens, Figma v2 y ambos temas. En móvil mantener navegación existente. No poner porcentajes de empleabilidad, recomendaciones falsas ni métricas inventadas.

Estados: cargando, vacío, fallo recuperable, sin perfil confirmado, cálculo en curso, viable/inviable/pendiente y resultado desactualizado. Bloquear doble envío y mostrar estado junto al botón. Recarga conserva resultado por ID. El detalle debe explicar motivos C01 aunque Vertex falle. No ofrecer reserva/postulación funcional antes de sus bloques; no botones que fingen éxito.

Pestaña Cursos identifica su recorrido como pendiente de D4; no simular catálogo operativo si aún no existe. Los casos límite de D3 no esperan la construcción de cursos.

### D3-4 — A03 autónomo por Vertex

Adaptador específico en `apps/api/src/modules/opportunities/agent-a03.service.ts`. Reutilizar autenticación Vertex y patrones comprobados de A02 sin duplicar el módulo completo. Mantener LLM fuera de transacciones. Validar realmente systemInstruction, esquema de herramientas, historial de llamadas y respuesta; no basta definirlos en variables.

A03 debe poder invocarse sin A02/A05. Decide qué aclarar y consulta C01; no es una explicación fija ni un formulario de preguntas siempre iguales. Máximo tres preguntas breves. Aclaraciones del usuario se validan como datos de esta comparación, no se guardan como hechos confirmados del perfil.

Salida conforme a agent-result/1: status, resumen, motivos, refs de perfil/vacante/cálculo, brechas, desconocidos y preguntas. Las cifras mostradas siempre provienen de C01; no renderizar otro porcentaje generado en prosa. Bloquear explicación con referencias/cifras incompatibles. Documentos son datos, nunca instrucciones.

Presupuesto inicial: hasta seis rondas, plazo total120s, thinking LOW, salida compacta y tope inicial8192; como máximo un reintento por truncamiento con16384 dentro del mismo plazo. Prohibido reintentar automáticamente acciones persistidas o cambiar proveedor. Consentimiento visible antes de enviar datos personales; nunca probar usando CVs personales. Ante fallo, conservar cálculo y permitir continuar explorando.

### D3-5 — Inicio, trazas y cierre

Inicio deriva una próxima acción real: terminar/confirmar perfil, explorar o consultar comparación reciente; nunca agente adicional de feed ni eventos fabricados. CU16 permite ver motivos, reglas, fuentes/versiones y herramientas con acceso por objeto, sin razonamiento interno ni documentos completos.

Ejecutar regresión D2 y E2E D3, registrar resultados medidos, actualizar bitácora y mapa de requisitos. Declarar limitaciones: datos demo, Cursos/D4, solver global si pendiente, falta de acreditación y despliegue remoto pendiente. No marcar D3 completo por tener pantallas.

## Pruebas mínimas y revisión eficiente

Preparar al menos 15 casos sintéticos: viable conocido; salario incompatible; moneda/periodo incomparables; traslado excesivo; traslado desconocido; horario incompatible; horario desconocido; esencial incumplido; esencial desconocido; deseable pendiente; entrenable no adquirido; ningún requisito evaluable; cambio de versión obsoleto; acceso ajeno; contrafactual nombre/género/residencia con logística constante. Añadir frontera exacta de límites, fallo Vertex y prompt injection en las pruebas del bloque pertinente. No afirmar que estos son los evals oficiales ya ejecutados; mantener el mapeo E05–E08/E17–E18, X13 e I03.

- Tras cambio coherente: typecheck + pruebas del módulo afectado. Un fallo real se corrige y se repite su prueba antes de continuar. No repetir toda la suite por un cambio de texto.
- Tras cada bloque: revisar diff y callers, permisos, desconocidos/unidades, estado/error visible, idempotencia y trazas. Corregir el hallazgo antes del siguiente bloque; registrar evidencia breve, no razonamiento interno.
- Antes del cierre: pruebas API afectadas y regresión D2; build; Playwright del registro/consulta y del recorrido Explorar→detalle→comparación→explicación. No correr dos fixtures destructivos a la vez. Mantener los guards de BD local.
- Evals de IA: medir cobertura de hechos sustentados, contradicciones con C01 y preguntas útiles con casos gold; éxito HTTP/JSON no mide calidad. Separar pruebas con proveedor interceptado de ejecución Vertex real. Hacer primero offline; después una prueba real sintética individual de A03 y declarar proveedor/modelo/resultado real, sin agotar cuota con repeticiones innecesarias.
- Usar comandos del package.json real. Añadir scripts solo si hacen falta. Informe por bloque: archivos, conducta, pruebas ejecutadas, resultado y pendientes. No volver a leer toda la documentación cada vez; referir secciones y cargar solo dependencias.

## Frontera de archivos y finalización

Ámbito previsto: docs/CONTRATOS_D3.md y bitácora; packages/contracts/src/index.ts; prisma/schema.prisma, nueva migración y políticas necesarias; módulos opportunities y wiring app/server; feature opportunities, HomePage, App y allowlist de lib/api.ts; fixtures D3, pruebas API/E2E y soporte de BD solo si el esquema nuevo lo exige. Antes de cada bloque fijar sus rutas exactas. No editar parsers A02, cuentas, estilos globales o D2 por conveniencia.

No commits, push, publicación, facturación ni despliegue Supabase en esta orden. Si surge una decisión funcional que cambia lo acordado, aislarla y continuar con lo independiente; no inventar aprobación humana. No sustituir simulaciones por ejecución real ni declarar que otra herramienta revisó trabajo que no leyó.
