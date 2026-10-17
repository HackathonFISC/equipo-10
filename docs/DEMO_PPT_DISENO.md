# Demo por perfiles, PPT y dirección visual

Fecha: 2026-10-16. Cambio humano confirmado: descartar video del plan, presentar demo en vivo alternando perfiles y PPT que explique los módulos; diseñar la experiencia antes de implementar. Propuesta de recorrido y criterios visuales organizada por IA, pendiente de revisión de estilo/duración. Sin desarrollo, archivo PPT ni diseños Figma creados en esta etapa.

Referencias: [plan](REVISION_INTEGRAL_PLAN.md), [CU](ESPECIFICACION_CASOS_USO.md), [agentes](AGENTES.md), [módulos/datos](MODELO_DATOS_MODULOS_PROPUESTA.md), [entregables](ENTREGABLES.md), [evals diseñados](../evals/casos.csv). El enunciado original conserva su mención a video, sin reescribirlo ni afirmar que la organización modificó sus reglas. La decisión de trabajo actual es del usuario: demo + PPT. La duración de la demo en vivo no se deduce del límite del video descartado.

## Una historia, cuatro perfiles, el mismo caso

Propuesta: joven con experiencia informal, vacante concreta y edición de curso con cupo limitado; datos ficticios identificados y consistentes. Mostrar cambios de estado reales persistidos, no pantallas precargadas que simulen acciones. Identificadores del caso unen perfil, vacante, curso, plan, acción y traza. Evals y resultados visibles cuando existan; no inventarlos para la presentación.

| Escena | Perfil | Objetivo mostrado | CU y agentes | Evidencia visible |
|---|---|---|---|---|
| Preparar oportunidad | Reclutador | Interpretar título/requisitos, confirmar puesto/etiquetas y publicar oferta | CU07, A01; C02/C03 | Texto original y normalización, fuente, aclaración y confirmación; bloqueo si alerta abierta |
| Preparar formación | Centro | Subir temario, confirmar conocimientos esperados y banco de preguntas, publicar edición | CU11, A01/A02; C01–C03 | Temario→unidad→etiqueta→pregunta, versión y revisión del centro; fechas/cupo/precio |
| Conocer al joven | Candidato | Construir perfil sin CV o con experiencia informal; consultar oportunidades y brechas | CU01/CU03, A02/A03 | Confirmación de habilidades y restricciones; resultado de código, razones y desconocidos |
| Acompañar | Orientador | Revisar plan del joven que autorizó acompañamiento y sugerir corrección | CU04/CU14, A03/A05 | Acceso limitado, explicación de ruta, joven confirma corrección y revisión versionada |
| Actuar | Candidato | Confirmar postulación y/o reserva de edición viable | CU05/CU12, A04/A05 y herramientas | Consentimiento concreto, registro real, cupo cambia una vez y agenda consultable |
| Dar seguimiento | Reclutador / centro | Ver solo candidatura autorizada y reserva/participante propio; acordar entrevista | CU09/CU10, A03/A04 | Permisos efectivos, ambas aceptaciones, selección distinta de contratación |
| Probar robustez | Perfil dueño de evento | Cancelar/cambiar y consultar alternativas; o intentar último cupo agotado | CU15/CU16, A03/A04/A05 según objeto | Cupo devuelto una vez, aprobación antigua invalidada y nueva acción requiere confirmación |

Microevaluación CU02 se muestra sobre curso previo o ya completado dentro del caso; no demostrar habilidad solo por reservar. Para no alargar, preparar estado anterior con datos de demo identificados y explicar qué pertenece a preparación y qué se ejecuta en vivo. CU13 adjunta certificado existente de demo, sin generar uno mediante IA. CU06 práctica privada y CU17 tendencias pueden quedar como escenas opcionales según tiempo, no afirmar ejecución en escena si no se muestran.

No llamar a los cinco agentes por cada click para llenar la demo. Mostrar decisiones donde aportan valor: qué interpretó/preguntó, qué herramienta consultó, qué faltó y qué confirmó el humano. Panel breve de actividad por caso; detalle técnico/trazas en vista desplegable sanitizada.

## Cambio de perfiles sin romper autorización

- Preferir cuentas distintas y sesiones de navegador aisladas para candidato, reclutador, centro y orientador, preparadas para el ensayo. Abrir varias pestañas con una misma sesión no garantiza identidades separadas.
- Mostrar nombre/rol/organización activos en encabezado. Si se implementa acceso de demo por perfil, será exclusivo del entorno de demo y debe autenticar la cuenta real en el servidor, no cambiar únicamente un rol de frontend.
- Cambiar sesión limpia caché/datos privados de la anterior; una cuenta no hereda consultas ni permisos de otra. Mostrar al menos un intento denegado o estado vacío que demuestre esa frontera.
- Consentimiento de empresa y acompañamiento son distintos; acceso del centro al banco de su curso no abre CV/respuestas privadas. No mostrar contraseñas, claves, documentos personales reales o trazas completas con datos sensibles.

## PPT: explicar módulos desde los objetivos del usuario

Propuesta de bloque principal: problema y actores; historia de demo; mapa de módulos/vistas; arquitectura de cinco agentes y C01–C03; acción humana/código/persistencia; pruebas reales y límites. Añadir fichas de cada módulo como respaldo si el tiempo no permite presentarlas todas.

Ficha por módulo: necesidad que resuelve, actor, CU, vista/acción principal, datos que controla, agente/herramienta, regla/permiso clave y evidencia de aceptación. Usar nombres funcionales en diapositivas; controlador/servicio/Prisma en arquitectura técnica cuando ayude a explicar. No crear una diapositiva con listas genéricas de tecnologías como sustituto de funcionamiento.

Módulos cubiertos: IdentidadOrganizaciones, Candidatos, CatalogosPuestosCompetencias, VacantesSeleccion, Formacion, EvaluacionPractica, PlanificacionAcompanamiento, Agenda, Agentes y SeguridadTrazas. No atribuir desarrollo o propiedad individual a Mainor/Giovanny sin acordarlo. Archivo PPT y plantilla visual se crearán después de cerrar el guion y estilo; no presentarlos como existentes.

## Diseño con intención propia

Objetivo humano «que no parezca IA»: evitar apariencia genérica de plantilla y dar prioridad a tareas reales. No significa ocultar uso de IA: bitácora y explicación de agentes permanecen transparentes.

Dirección propuesta: herramienta de trabajo clara y cercana, con contraste legible, superficies sobrias, una familia tipográfica coherente y un acento de color. Identidad/paleta/nombre por elegir; no afirmar que esta propuesta ya fue aceptada. Evitar gradientes decorativos, tarjetas repetidas para todo, efectos brillantes y textos vagos sobre innovación. Cada elemento debe ayudar a interpretar o actuar.

- Candidato: oportunidades, brechas explicadas y próximo paso; experiencia informal y perfil incompleto tratados con claridad, sin culpar al joven.
- Reclutador: tabla/lista útil de vacantes y candidaturas consentidas, requisitos comparables y agenda.
- Centro: contenido, mapa de conocimientos, banco revisable, ediciones y cupos; no reutilizar pantalla de reclutador con otro título.
- Orientador: cartera autorizada, explicación del caso y comparación de alternativas, sin una bandeja empresarial.
- Sistema común: navegación consistente, formularios/detalles/tablas/etiquetas, tipografía/espaciado/colores/estados. Mostrar vacío, carga, por aclarar, error, bloqueo, pendiente humano y éxito; evitar que todo sea chat.

Primero diseñar el recorrido candidato y las vistas de vacante/curso que lo alimentan; luego revisión del orientador, agenda y cambios. Empezar con esquemas simples y decidir jerarquía antes de pulir colores. Validar legibilidad, navegación por teclado, foco, etiquetas de campos, contraste y estados además de estética.

## Skills propuestas y orden de uso

Las skills están disponibles en el catálogo; su mención no significa que ya se hayan ejecutado ni que haya conexión verificada a Figma.

1. Para diseñar en Figma: `figma-generate-design` para vistas completas y `figma-generate-library` para componentes/tokens, con `figma-use` cuando se efectúen operaciones en el archivo. Crear archivo Figma solo cuando se solicite y con su skill correspondiente. No hay necesidad de instalar plugins ni activar conexiones en esta discusión.
2. Para trasladar un diseño Figma aprobado a React: `figma-design-to-code` / `figma-implement-design` según operación; verificar contexto y estados, no generar frontend antes de autorización de desarrollo.
3. Para crear y revisar el PPT: `presentations:Presentations`, cuando se solicite el archivo; misma identidad visual que producto y diagramas coherentes.
4. Imágenes generadas solo si una necesidad visual concreta lo justifica; no hacen falta ilustraciones decorativas para que las pantallas tengan identidad.

## Salidas antes de implementar

Guion por escenas y duración acordada; datos/cuentas de demo y resultados esperados; mapa de vistas→CU→actor→módulo; bocetos y componentes/estados; dirección visual aprobada; guion de PPT con evidencia pendiente identificada. Mantener ≥15evals reales más integración/E2E y comprobaciones de agentes individuales/cooperativos. No grabación de video en el plan actual.

[Dos flujos: Figma y desarrollo; propuesta de paleta y componentes](FLUJOS_FIGMA_DESARROLLO.md). Restricción humana: evitar azul típico, interfaz rectangular con personalidad. Terracota/marfil/carbón y alternativa oliva son propuestas pendientes; aún no archivo Figma ni código de aplicación.

[Plan de Figma para «Diseño plataforma»](PLAN_FIGMA_DISENO_PLATAFORMA.md): bloquesF0–F7, biblioteca/temas,17CU y entrega a programación. Terracota claro/oscuro confirmada; MCP local responde con página vacía0:1, herramientas de lectura sin escritura expuesta. Nombre/URL de archivo aún no comprobados; lienzo no modificado.
