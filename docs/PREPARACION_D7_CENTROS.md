# D7 — Preparación paralela de centros de formación

Fecha: 2026-10-17. Autoría Codex. Estado: preparación de integración; sin código de producto ni pruebas D7. Gemini trabaja D5/D6 simultáneamente. No afirmar que la gestión de centros está implementada por existir Cursos de D4.

## Reutilización y frontera paralela

D4 ya tiene Course, CourseVersion, CourseLearningOutcome, CoursePrerequisite, CourseEdition, CourseSession y CourseReservation. CoursesService/CoursesController solo ofrecen consulta al candidato. La gestión debe extender esas mismas entidades, sin otro catálogo o contador de cupos.

Mientras Gemini edita D5/D6, no modificar packages/contracts, schema.prisma, migraciones, app/server, sesión/navegación, catálogos ni un adaptador A01 compartido. Este documento es el aporte paralelo independiente. Al integrar, inspeccionar el estado final de Gemini y acordar rutas concretas; no fusionar a ciegas ni asumir que sus cambios ya terminaron.

Referencias: CU11/CU13/CU02 completos y RGN transversales de ESPECIFICACION_CASOS_USO.md; PLAN_DESARROLLO_ETAPAS.md D7; CATALOGOS_CURSOS_PUESTOS_HABILIDADES.md; reglas de capas; entrega Figma v2 para centro. Marca AImpulsa y componentes/tokens vigentes. Reutilizar autorización por membresía que entregue D5/D6, adaptándola al rol real TRAINING_MANAGER de TRAINING_CENTER, nunca concediendo permisos mediante selector visual.

## Qué interpreta cada agente

**A01, modo temario:** texto original → unidades con fragmentos → resultados esperados → habilidades/conocimientos del catálogo y prerrequisitos. Puede traducir lenguaje educativo a etiquetas canónicas; traducción de idiomas solo si la fuente lo necesita. No son equivalencias automáticas ni certificación. El centro acepta/corrige cada propuesta y confirma versión. Conservar original, IDs de fragmento, catálogo y versión; sin fuente, no aceptar etiqueta. Alias ambiguo exige aclaración.

Reutilizar transporte Vertex y herramientas de catálogo de A01 de empresa cuando esté terminado, con prompt/esquema/herramientas específicos de temario. No reutilizar la salida de vacante como si fuera un curso ni crear otro agente independiente ficticio. Las herramientas de publicación permanecen fuera de la decisión LLM.

**A02, modo banco:** solo desde mapa confirmado, proponer preguntas y rúbricas ligadas a resultados/fragmentos. Centro revisa y confirma banco antes de usarlo. Soluciones y rúbricas internas no se entregan al candidato por el mismo DTO que las preguntas. Reservar/publicar curso no exige banco listo. D7 completo incluye esta parte y su recorrido CU02; si se pospone, marcar D7 parcial expresamente.

Finalización y certificado son acciones humanas del centro: no necesitan generación LLM ni equivalen a acreditar todo el temario.

## Tres entregas para evitar repetir trabajo

### A — Centro crea curso y edición real

Vista de gestión del centro según Figma: lista propia → editor → texto de temario → propuestas A01 con preguntas respondibles → revisión del mapa → configuración de edición/sesiones → confirmar/publicar → aparece en Explorar/Cursos existente.

Contrato a cerrar: CRUD de borrador propio, análisis de temario con consentimiento y fuentes, decisiones de mapeo, confirmación/publicación de versión exacta, edición y sesiones. Usar rutas `/organizations/:organizationId/courses/...` compatibles con el cliente existente y las de empresa, sin duplicar endpoints públicos de D4. No editar catálogo global desde IA.

Prerrequisitos y resultados esperados son relaciones distintas. No inferir que enseñar una habilidad la exige al entrar. Contenido cambia por nueva versión: conservar planes, reservas e intentos históricos. No usar active=true como sustituto ambiguo de borrador/publicado si expone contenido pendiente; auditar lecturas/RLS D4 antes de permitir escritura del centro.

Publicación: salario no aplica al curso; precio/moneda/periodo, modalidad, ubicación, fechas y sesiones/cupo sí. No publicar si faltan datos esenciales. Una edición reservada no admite reducción de capacidad por debajo de ocupación ni cambio material silencioso de sesiones. Reutilizar la única fuente de cupos de reservas y sus bloqueos.

### B — Participantes, finalización y adjunto

Centro consulta solo participantes de ediciones propias, con datos mínimos para su gestión, sin CV ni candidaturas de empresa. Registrar completado/no completado con fecha/motivo y confirmación; no completar una reserva cancelada sin participación acreditada. Reintento no duplica y corrección conserva historia.

Adjuntar certificado PDF ya emitido es opcional. Validar contenido/tamaño, emisor, propietario, acceso y almacenamiento privado. No generar certificados con IA ni hacer enlaces públicos. Joven consulta su resultado/certificado desde Formación. Sin adjunto debe decir «Sin certificado adjunto». Nada concede automáticamente habilidades demostradas.

### C — Banco revisado y diagnóstico

A02 genera propuestas desde mapa confirmado; centro confirma preguntas/rúbrica/versiones. Banco no revisado o pregunta sin fuente no permite diagnóstico acreditado del curso. C01 corrige objetivas, A02 ofrece retroalimentación orientativa de abiertas; evidencia limitada al ejercicio, asociación al perfil confirmada por joven. No devolver respuestas correctas antes de entregar intento ni recalificar intentos antiguos al editar temario/banco.

No bloquear A/B esperando C. Si el plazo exige separar C, declarar A/B entregados y C pendiente, sin afirmar D7 completo ni falsear evals.

## Verificación acotada

Por entrega: typecheck, pruebas dirigidas y revisión de diff/callers; no regresión global por archivo. Base local aislada55435, fixtures no concurrentes. Primero offline, después una prueba real sintética A01 modo curso y una A02 modo banco solo cuando corresponda; no llamadas live de todos los agentes para cada entrega.

Casos críticos: centro ajeno denegado; sin membresía denegado; etiquetas sin fuente rechazadas; preguntas ambiguas respondidas y usadas; mapa no confirmado no publicado; curso publicado visible al joven; publicar sin banco posible; misma reserva visible como participante solo del centro dueño; reducción de cupo ocupada bloqueada; curso aprendido no acredita competencia; intento pasado conserva versión; respuestas privadas no filtradas; finalización idempotente sin certificado permitida; certificado ajeno no descargable.

E2E A/B: centro crea y publica → joven consulta/reserva por D4 → centro ve participante → registra finalización/adjunto si disponible → joven consulta. E2E C cuando se implemente: centro confirma banco → joven consiente intento → resultado/evidencia revisable sin exponer soluciones.

Preparar migración incremental/check/apply/verify y fixture marcado DEMO; diferenciar desarrollo local de activación Supabase. Actualizador debe probar sus campos obligatorios y lecturas con rol API real: evitar repetición de P2021 y seed NOTNULL de D3/D4. Sin reset, cambios de facturación, commit ni push.

## Siguiente paso de integración

Cuando Gemini entregue D5/D6: confirmar qué servicios de organización/A01 quedaron listos; fijar contratos y migración D7 mínima; asignar módulos/vistas disjuntos para código paralelo. Codex puede encargarse del centro y Gemini de los últimos ajustes de empresa solo con esa frontera explícita; app/server/contratos/migración compartidos se integran por un único responsable.
