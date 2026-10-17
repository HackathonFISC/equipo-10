# Trayectoria asistida por etapas — 2026-10-17

Problema observado por el usuario: una lista larga mezcla extracción, preguntas, claves técnicas y decisiones de guardado. No queda claro qué responder primero ni cuándo se puede añadir experiencia manualmente.

## Recorrido implementado

1. **Lo que encontramos**: cantidades por categoría, explicación de privacidad y dos acciones: completar preguntas opcionales o revisar directamente.
2. **Completar detalles**: una pregunta a la vez, volver sin perder respuestas y «No lo recuerdo». No se muestran rutas técnicas de campos. Las respuestas se envían juntas una sola vez si el joven pulsa «Usar mis respuestas», con nuevo consentimiento y referencias a las fuentes originales. No se vuelve a pedir que copie sus respuestas en otra ventana. Se puede omitir la entrevista y seguir manualmente.
3. **Elegir tus datos**: un dato por pantalla, nombres de categorías en español, evidencia bajo un desplegable y corrección de nombre/entidad/tareas. «Sí, añadir», «No corresponde» o «Dejar pendiente». No hay aceptación automática. La entrevista ocurre antes de estas elecciones para no borrarlas al reemplazar un análisis; no se inicia otra entrevista una vez hechas elecciones en esa revisión.
4. **Revisar y guardar**: resumen de lo elegido y vuelta a las elecciones sin perderlas. Solo este paso guarda el lote; se conserva la clave idempotente al reintentar el mismo contenido. Después se abre el formulario manual, con mensaje y foco: se pueden añadir otras actividades, formación e intereses.

Durante la revisión se oculta el formulario manual para evitar mezclar dos tareas. Salir exige confirmar que se abandonan las elecciones aún no guardadas. Las fuentes y ejecuciones siguen en backend; el progreso local del asistente no se recupera tras recargar la página.

## Lógica y límites

- Se preservan cambios manuales antes de abrir otro análisis. El servidor valida las correcciones con los contratos de experiencia, formación e intereses; rechaza IDs ajenos al run y decisiones duplicadas sin escritura parcial.
- Al añadir registros manuales después de la importación se actualizan los elementos conservados por ID. Se mantienen sus vínculos de evidencia; solo se eliminan vínculos de los registros que el joven retira expresamente. Los elementos nuevos reciben UUID del servidor y se rechazan IDs que no pertenecen al borrador.
- A02 recibe el contenido del borrador, no solo cantidades, y tiene instrucciones de no repetir datos existentes, priorizar tareas/habilidades y no exigir meses exactos ni campos de formación inexistentes. Esto requiere evaluación continua: un prompt no garantiza ausencia de duplicados semánticos.
- **Habilidades:** la implementación anterior contaba propuestas de competencias como aceptadas sin persistirlas. Por ahora se muestran como pendientes y no se ofrece guardarlas como acreditadas. El backend rechaza la aceptación de secciones no soportadas. No se declara completo el circuito de catálogo/claims de habilidades.
- La revisión detectó también una carga tardía del borrador que podía reemplazar el texto de Cuenta: se conserva la entrada modificada por el usuario y la dependencia de carga usa el ID estable del perfil. El nombre es obligatorio en Cuenta y el servidor rechaza una confirmación sin nombre con un error explícito, antes de llegar a la restricción SQL.

## Diseño y accesibilidad

Se inspeccionó mediante Figma MCP el frame `36:78` de `cWPzNNsLPoUenKyfhf4Diu`: Source Sans 3, marfil/carbón/terracota/oliva, tarjetas de radio 12 y componentes de controles y progreso. El asistente nuevo extiende ese diseño en código; no se modificó el archivo Figma ni se afirma que sus pantallas nuevas ya estén dibujadas allí.

Se mantienen componentes compartidos, CSS Modules y tokens de ambos temas. Progreso visible, foco al cambiar de etapa, controles agrupados con leyenda, blancos táctiles de 44 px, diálogo etiquetado y navegación de teclado contenida. En móvil se muestra el paso actual y barra compacta para evitar partir palabras o llenar la pantalla con un segundo indicador extenso.

Fuentes de referencia: [GOV.UK: preguntas enfocadas](https://design-system.service.gov.uk/patterns/question-pages/), [W3C: formularios por pasos](https://www.w3.org/WAI/tutorials/forms/multi-page/). Son fundamentos de diseño; las pruebas automáticas no sustituyen una prueba de usabilidad con personas.

## Pruebas del cambio

La prueba de navegador del asistente usa respuestas de proveedor interceptadas explícitamente: espera visible y sin doble envío, dos preguntas (una omitida), análisis de respuestas con fuentes originales, tres categorías, corrección, volver manteniendo elecciones, resumen, fallo de guardado y reintento con misma clave, salida al formulario manual y muestras 320/390 px en ambos temas. La prueba API comprueba correcciones inválidas, elecciones repetidas y referencias ajenas sin mutar el borrador. Resultados finales y comandos en la bitácora.

Autoría de esta corrección: Codex sobre el trabajo de Gemini/Antigravity. Las ideas y la observación de usabilidad son del usuario. Sin migraciones remotas ni commit/push.

Verificación final: 43 pruebas API de los módulos afectados y 7 recorridos E2E aprobados; typecheck/build exit 0. La llamada real a Vertex con Gemini 3.8/global pasó con una fuente sintética. Antes de la corrección de Cuenta falló la confirmación en dos ejecuciones completas; después de corregir la entrada tardía y validar el nombre, las dos últimas suites E2E completas pasaron. Persisten advertencias previas de pg y tamaño del bundle; no son pruebas fallidas.

## Corrección de propuestas no guardables — 2026-10-17

El usuario reportó el aviso genérico INVALID_PROPOSAL con una revisión abierta. Se verificó que el servidor exige campos que el editor anterior no mostraba: tipo de experiencia y fechas válidas. No se atribuye el caso concreto a un campo sin ver su propuesta.

La revisión usa los mismos esquemas que el guardado. Si un dato aceptado es inválido, vuelve a esa tarjeta y muestra el campo concreto antes de enviar. El editor abre la corrección y permite elegir tipo (incluido Otra experiencia), cambiar tareas y fechas o dejarlas pendientes explícitamente. Rechazar o diferir permite continuar. Cambiar un campo elimina el aviso anterior; se conservan las elecciones de otras tarjetas.

La API mantiene validación y transacción atómica. INVALID_PROPOSAL ahora identifica la propuesta y devuelve field_errors legibles. El prompt de A02 documenta campos obligatorios, límites y formatos; una fecha parcial no se completa con un mes o día inventado. La UI también permite corregir propuestas generadas antes del cambio.

Verificado: 18 pruebas API y validación compartida PASS; dos E2E del asistente PASS, más repetición final del recorrido de corrección con tipo ausente, año parcial en experiencia y curso, fechas pendientes, guardado y reintento PASS. Typecheck/build exit0. E2E con proveedor interceptado; no se llamó a Vertex en esta corrección ni se inspeccionó el CV personal de nuevo. Sin DDL remoto ni commit/push.
