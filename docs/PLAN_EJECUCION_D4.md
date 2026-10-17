# D4 — Cursos, mi ruta y reserva

Fecha: 2026-10-17. Estado: orden definida para Gemini/Antigravity; implementación y pruebas D4 pendientes. Producto: AImpulsa.

## Alcance y experiencia

El joven consulta Cursos en Explorar, elige una meta o una brecha D3, compara rutas formativas y guarda su plan. Confirma por separado una edición de curso y consulta la reserva en Mi ruta/Formación y Agenda. Puede cancelarla sin perder historial. Son reservas internas: no pagos ni matrícula externa.

Flujo: Explorar/Cursos → detalle y ediciones → calcular ruta → revisar explicación A05 → confirmar plan → revisar condiciones de una edición → confirmar reserva → consultar recibo/agenda. El joven también puede consultar/reservar una edición sin tener que ejecutar A03/A05; siempre pasan los mismos controles determinísticos.

No construir gestión de centros (D7), orientador (D8), postulaciones/práctica (D5), OCR/audio ni emisión de certificados. El recorrido sin acompañamiento está habilitado; si aparece una acción sujeta a revisión de orientador aún no disponible, bloquearla claramente, nunca fingir aprobación. Finalización/asistencia/certificado no pueden ser marcados por IA ni por el candidato para acreditar habilidades.

## Contexto mínimo

Leer una vez AGENTS.md; PLAN_DESARROLLO_ETAPAS.md D4; ESPECIFICACION_CASOS_USO.md CU04/CU12/CU15 completos y RGN01–RGN14; GUIA_IMPLEMENTACION_Y_REVISION.md; REGLAS_COMPONENTES_CAPAS.md; CATALOGOS_CURSOS_PUESTOS_HABILIDADES.md y modelo lógico en secciones de cursos/planes/reservas. Consultar esquema real y servicios D3 antes de diseñar equivalentes. Reutilizar catálogo, perfil confirmado, autenticación, withActor, recibos/auditoría, cliente HTTP, Brand y estilos existentes.

Figma: `cWPzNNsLPoUenKyfhf4Diu`, entrega v2 y vistas de Cursos/Mi ruta/Agenda. Identificar nodos reales de esas vistas; no recorrer todo Figma. Marca AImpulsa, AI terracota y cohete; claro/oscuro, radio12 y navegación existentes. Si no se pudo consultar una vista, declarar esa limitación sin inventar fidelidad.

Gemini es quien desarrolla en Antigravity; A05 es agente del producto, con Vertex directo, ADC/global/gemini-3.8-flash. No sustituir proveedor silenciosamente ni contar agentes de desarrollo como agentes del reto.

## Contratos y decisiones iniciales (D4-0 breve)

Crear `docs/CONTRATOS_D4.md` antes del primer bloque: entidades/estados, DTOs Zod, rutas, firmas de C01 y herramientas A05, permisos, idempotencia, fuentes/versiones, 15 casos de aceptación. Revisar callers y asignar archivos exactos por bloque. No copiar toda la documentación.

Modelo mínimo normalizado a concretar: curso y versión de contenido confirmada; resultados esperados/prerrequisitos referenciados al catálogo; edición publicada ligada a versión y sesiones concretas; plan/versiones/pasos ligados a candidato/meta y resultado de cálculo; reserva candidato-edición con historial. Reutilizar OperationReceipt/AuditEvent; no guardar relaciones de reservas ni permisos solo en JSON. No añadir entidades de otros roles por previsión.

Separar tres dimensiones: ciclo de plan (propuesto/confirmado/sustituido/cancelado); factibilidad (viable/condicional/pendiente/inviable); revisión humana acompañada (si corresponde). Guardar plan no reserva ni acredita. Reserva: confirmada/cancelada; completada solo desde una acción futura autorizada del centro. No reserva provisional ni expiración automática.

Rutas objetivo, ajustadas una sola vez en contrato si hay conflicto real:

| Ruta | Propósito |
|---|---|
| GET /api/v1/courses y /courses/:id | Listar/filtrar contenido y ediciones demo publicadas |
| POST /api/v1/me/learning-plans/preview | Cálculo C01 versionado desde meta o comparación D3 autorizada |
| POST /api/v1/me/learning-plans/:id/explanations | A05 con consentimiento explícito; devuelve explicación referida al cálculo |
| POST /api/v1/me/learning-plans/:id/confirmations | Confirmar versión exacta; sin reservar |
| GET /api/v1/me/learning-plans y /:id | Consulta persistida, propiedad y desactualización |
| POST /api/v1/me/course-reservations | Confirmar edición/versión/perfil/plan si aplica; cupo, recibo y reserva atómicos |
| GET /api/v1/me/course-reservations y /:id | Consultar reservas propias |
| POST /api/v1/me/course-reservations/:id/cancellations | Cancelación idempotente con confirmación humana |
| GET /api/v1/me/agenda | Vista derivada de sesiones reservadas; sin otra agenda editable duplicada |
| GET /api/v1/me/course-reservation-operations/:key | Recuperar resultado por clave/actor tras timeout antes de repetir |

Todas las mutaciones exigen Idempotency-Key y payload hash; confirmar/cancelar además versión exacta. Códigos legibles para datos pendientes, obsoleto, sin cupo, conflicto horario, prerrequisito y fallo de proveedor. 404 por objeto ajeno, 409 por conflicto y 412 por versión según contratos del proyecto. Cliente no envía dueño, costo calculado ni disponibilidad como hechos confiables.

## Entrega A — Catálogo y cursos de punta a punta

Módulo API `courses` (controller/service/module), feature web `courses`, contratos compartidos, migración incremental/RLS y fixture sintético versionado. Curso separado de edición; mostrar contenido, resultados esperados, prerrequisitos, centro ficticio, precio, moneda/periodo, cupo y sesiones con fechas/timezone. Catálogo curado pequeño y marcado DEMO, sin afirmar ESCO oficial ni extracción A01 ejecutada.

Listar/filtrar → detalle → ediciones desde API/BD real. Ninguna dependencia de planes o Vertex para abrir Cursos. Datos desconocidos visibles, sin cero inventado. Probar lectura real bajo rol runtime, joins y acceso a privados. No arrays duplicados en frontend ni borrado de datos D2/D3.

## Entrega B — Planificador C01 y A05

Propuesta de límites demo a fijar en contrato: horizonte30días desde fecha explícita; hasta12ediciones y rutas de hasta3ediciones. Enumerar combinaciones dentro de esos límites, filtrar inviables, maximizar cobertura de meta, minimizar costo comparable, luego duración y desempate estable. Si se prueban todas las combinaciones se puede afirmar mejor resultado dentro del conjunto acotado; nunca óptimo global. Si el catálogo excede el límite, pedir filtros, no truncarlo silenciosamente. Exponer brecha residual y alternativas; no imponer un plan si falta información esencial.

C01 debe considerar: perfil confirmado actual, requisitos objetivo de vacante/meta, resultados esperados de versión confirmada del curso, prerrequisitos presentes vs futuros, sesiones concretas, agenda ya reservada, vigencia y timezone, disponibilidad y traslados con fuente/dirección/frecuencia, costo de curso + transporte y presupuestos explícitos. Comparar dinero con precisión decimal/unidades; no inventar tarifas, distancias ni conversión de divisas/periodos. Costos esenciales desconocidos → pendiente. Sesiones contiguas solo compatibles si permiten el traslado declarado; online no elimina el tiempo de clase.

Ningún curso concede automáticamente competencias. Aprendizaje futuro permite ruta condicional con precedencias visibles, pero no habilita reservar una edición cuyo prerrequisito actual sea desconocido o no demostrado. Una habilidad ausente sigue desconocida; no convertirla en incumplida por existir otras. Reutilizar reglas correctas de D3 sin acoplar el planner a su motor de vacantes.

Guardar vista previa y versiones; confirmar una propuesta concreta persiste plan sin reservar. Si cambian perfil, edición, mapa, catálogo, agenda o supuestos relevantes, marcar cálculo desactualizado y revalidar. Leer un plan nunca crea uno vacío ni pierde datos al recargar.

A05 acepta meta/brecha directamente sin requerir A03. Herramientas reales declaradas y despachadas: leer_meta_perfil, buscar_ediciones, calcular_rutas(C01), leer_resultado, entregar_explicacion. Respuestas de aclaración se incorporan como datos validados sin sobrescribir perfil. A05 elige aclaraciones, compara rutas calculadas y explica costo/brecha/prerrequisitos; nunca calcula cifras ni reserva desde el modelo. Salida agent-result/1 validada con refs; no presentar estado o cifras contradictorias con C01.

Reutilizar conexión Vertex comprobada: instrucciones realmente enviadas, plazo total120s, máximo6rondas, thinking LOW, salida8192 y un único reintento acotado por MAX_TOKENS con16384 dentro del plazo. No fallback silencioso. Fallo Vertex mantiene resultado C01 y permite navegación manual. Generación fuera de transacción; explicación/auditoría/recibo se persisten juntos. Consentimiento explícito de los datos enviados y sin datos sensibles innecesarios.

## Entrega C — Reserva y cancelación seguras

Una sola fuente de capacidad: cupo total menos reservas activas; sin segundo contador modificable en frontend. Unicidad parcial de reserva activa candidato-edición más clave idempotente. Definir si tras cancelación se puede reservar de nuevo y exigir una nueva operación explícita, sin reactivar por repetir una clave antigua.

En una transacción corta: serializar operaciones de agenda del mismo candidato y bloquear edición; usar siempre el mismo orden de locks. Releer perfil/versiones, estado publicado, prerrequisitos actuales, restricciones, revisión acompañada cuando aplique, disponibilidad y reservas vigentes. Solo entonces registrar reserva, recibo y auditoría. Serialización por candidato evita dos reservas simultáneas en ediciones distintas que se solapen. No consultas LLM ni cálculo combinatorio largo bajo locks.

La agenda deriva sesiones de reserva confirmada; no insertar copias que puedan quedar huérfanas. Si se necesita otra representación, documentar cómo se asegura consistencia transaccional. Cancelar cambia una vez el estado y deja de ocupar una plaza exactamente una vez. Mantener historial. Calcular alternativa sucede después: si falla, no revertir cancelación válida. Alternativa necesita nueva confirmación y revalidación.

Ante timeout: consultar recibo por clave/actor. Mantener estado «Por verificar» y bloquear acción incompatible mientras el resultado sea incierto. Reintento misma clave/mismo cuerpo devuelve mismo recibo; distinto cuerpo409. Resolver carreras de unicidad con relectura de recibo, no 503 genérico ni descuento duplicado. No afirmar que rollback impide toda incertidumbre de red.

## Entrega D — Mi ruta, Agenda y activación

Mi ruta muestra Plan/Formación y mantiene Postulaciones/Práctica como destinos pendientes de D5, sin simular funciones. Reserva visible después de guardarla, al volver a Inicio y tras recargar. Agenda muestra sesiones reales propias y acciones de cancelación. Progreso indica reserva/fechas programadas/estado disponible, no asistencia ni porcentaje aprendido ficticio. Inicio agrega siguiente sesión o acción real con reglas existentes, sin otro agente de feed.

Interfaz con carga/error/vacío, estado junto al botón, bloqueo de doble clic y recuperación de recibos. Mantener AImpulsa y ambos temas; componentes reciclables, no pantalla monolítica ni nuevas dependencias por comodidad.

Preparar actualizador D4 --check/--apply/--verify reutilizando validación de destino/TLS, checksum/registro de migración y patrón corregido de deploy-d3.mjs. No usar scripts D1 con recuentos fijos ni reset/migrate dev/db push sobre Supabase. Fixture idempotente sin cuentas reales ni membresías nuevas. En esta orden probar migración/seed/permisos solo en BD local55435; no desplegar remoto. Entregar instrucciones/artefacto listo para la activación final autorizada. Distinguir «implementado localmente» de «disponible en la API habitual»: no repetir el error de cierre de D3 antes de aplicar su migración.

## Verificación eficiente y evidencia

No ejecutar todas las suites de D1–D3 al empezar. Tras cada cambio coherente ejecutar typecheck y prueba afectada; si pasa, avanzar. Por entrega una revisión de diff/callers/permisos y sus pruebas dirigidas; no repetir por archivo. No ejecutar fixtures que reinician la misma BD a la vez. No esperar una hora en reintentos: máximo un reintento técnico justificado, después diagnosticar; no aumentar timeouts para ocultar bloqueos ni rerun ilimitado de Vertex.

Casos mínimos D4 (15): ruta viable; ruta parcial; moneda/periodo incomparables; presupuesto insuficiente; costo/traslado desconocido; conflicto horario con traslado; prerrequisito desconocido; prerrequisito futuro condicional sin reserva; perfil/edición obsoletos; dos candidatos última plaza; dos reservas simultáneas incompatibles del mismo candidato; reintento exacto mismo recibo; misma clave distinto cuerpo; cancelación repetida libera una sola plaza; acceso ajeno denegado. Añadir prueba de rollback fallo intermedio y consulta por clave tras respuesta perdida.

Primero pruebas offline con resultado esperado independiente; no cambiar gold para aceptar una regla incorrecta. Una prueba E2E principal: Cursos→detalle→ruta→confirmar plan→confirmar reserva→recibo→recargar→Agenda→cancelar. Prueba de fallo Vertex conserva C01 y no reserva. Solo después, una llamada sintética real A05 observando herramientas; no ejecutar A02/A03 live para acreditar A05 ni enviar CV personal. Registrar costo/latencia si el proveedor los devuelve, no inventarlos.

Al cierre una regresión conjunta pertinente D2/D3/D4, build/typecheck y E2E de continuidad. Registrar comandos/resultados, capturas representativas y pendientes en bitácora. Herramientas testRunner/mocks deben identificarse; no fabricar trazas de herramientas o acreditación. Mapear E02–E05/E09/E10/E19, X05/X14/X15 e I05/I06 sin declarar cubierto todo el reto por15tests.

## Reparto de archivos y reporte

Antes de cada entrega listar rutas exactas: módulos courses/planning/reservations solo los que exija el dominio; planner/agent-a05 como helpers de aplicación; packages/contracts; nueva migración/políticas; features courses/learning-route/agenda; wiring app/server/cliente; fixtures/tests; actualizador y docs. Prohibido editar D2 o rehacer D3 salvo dependencia demostrada y prueba de regresión. No nuevos frameworks, stores globales, clientes HTTP ni permisos amplios.

Reporte breve por entrega: completado, archivos, pruebas ejecutadas, resultado y bloqueo concreto. No detenerse por decisiones técnicas rutinarias; aislar decisiones humanas pendientes y avanzar con lo independiente. Al final: tabla implementado/verificado localmente/Vertex real/despliegue pendiente. No commit/push, facturación o cambios remotos. No declarar D4 completo si falta reserva transaccional, comprobación de última plaza, consulta de lo guardado o A05 real.
