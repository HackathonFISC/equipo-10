# Navegación adaptada e inicio con contenido relevante

> **Diseño/plan de su etapa — conciliación 2026-10-17:** los pasos futuros y alternativas siguientes conservan su contexto original; no son una lista de todo lo que falta hoy. Implementación y pendientes vigentes en [ESTADO_ACTUAL.md](ESTADO_ACTUAL.md) y [cobertura CU](CASOS_DE_USO.md#cobertura-actual-por-caso). Los casos diseñados no se presentan como ejecutados.

Actualización: propuesta aceptada por el usuario e integrada en [rediseño Figma v2](ENTREGA_REDISENO_FIGMA_V2.md). Las frases de aprobación pendiente que siguen describen el antecedente.
Fecha: 2026-10-16. Estado: recomendación razonada y muestra visual de conversación, pendiente de revisión humana. No cambia todavía los frames de Figma ni introduce un feed social, nuevos agentes o funcionalidad de producto.

## Diagnóstico del diseño actual

La sensación rígida procede de usar el mismo tratamiento para casi todo: paneles con borde, tarjetas dentro de tarjetas, títulos del mismo peso, filas de campos y columnas repetidas. Cambiar únicamente el radio no resuelve la jerarquía. La navegación y la composición del contenido son decisiones separadas.

## Recomendación por perfil y tamaño

| Contexto | Navegación principal propuesta | Composición de inicio |
|---|---|---|
| Joven, escritorio | Cabecera con Inicio, Explorar, Mi ruta, Agenda; cuenta personal a la derecha | Un próximo paso destacado, novedades/oportunidades relevantes y agenda contextual |
| Joven, móvil | Barra inferior con los mismos cuatro destinos, icono y etiqueta; cabecera breve con cuenta | Una columna; acciones prioritarias antes del resto del contenido |
| Reclutador, escritorio | Sidebar compacto con etiquetas: Resumen, Vacantes, Candidaturas, Entrevistas, Equipo | Cola de trabajo y acceso a listas/tablas para decisiones de su empresa |
| Centro, escritorio | Sidebar compacto: Resumen, Cursos, Ediciones, Participantes, Certificados | Tareas de publicación, sesiones/finalizaciones y documentos pendientes propios |
| Orientador, escritorio | Sidebar corto: Resumen, Jóvenes acompañados, Planes, Agenda | Cartera autorizada y revisiones pendientes; no administración empresarial |
| Profesionales, móvil | Tres a cinco destinos priorizados por rol; herramientas menos frecuentes en menú contextual | Listas legibles; ficha y acciones en pantalla propia, sin comprimir una tabla completa |
| Registro y confirmaciones | Cabecera mínima, Volver y paso actual; sin competir con navegación global | Tarea enfocada y estado de guardado; los permisos se confirman en su contexto |

En móvil y escritorio mantener la misma arquitectura de información del joven; adaptar la ubicación de los destinos. En tamaño intermedio decidir según ancho real del contenido: rail con etiqueta o menú desplegable, evitando etiquetas ambiguas y filas que desborden. No superponer barra inferior y sidebar como dos navegaciones principales simultáneas. Es una recomendación para esta web; las guías Android se usan como referencia de interacción, no como obligación de usar su implementación.

## Mapa de destinos y casos de uso

| Perfil | Destino | Contenido / CU |
|---|---|---|
| Joven | Inicio | Resumen de tareas y novedades; accesos a los objetos autorizados, no copia de formularios |
| Joven | Explorar | Pestañas Empleos y Cursos; CU03 y entrada a CU12. La pestaña Cursos no acredita recomendaciones personalizadas sin información suficiente |
| Joven | Mi ruta | Formación/plan CU04, curso y reservas CU12–13; pestaña visible Postulaciones CU05 con acceso directo desde Inicio; no esconder su estado en el menú de cuenta |
| Joven | Agenda | Citas y cambios CU10/CU15; la práctica privada CU06 es una acción contextual separada de la entrevista laboral |
| Joven | Mi cuenta | Perfil CU01, evidencias/ejercicios CU02, permisos de compartir/acompañamiento y actividad CU16. Práctica privada accesible desde la postulación y la cuenta |
| Reclutador | Vacantes | Crear/normalizar/corregir CU07; tendencias CU17 como subvista de inteligencia de ofertas |
| Reclutador | Candidaturas / Entrevistas / Equipo | CU09 / CU10–15 / CU08; actividad CU16 de cada objeto propio |
| Centro | Cursos / Ediciones | Temario, mapa y banco / sesiones, sede, precio y cupos, CU11–12 |
| Centro | Participantes / Certificados | Registro de finalización y adjuntos CU13; acceso solo a su organización |
| Orientador | Jóvenes / Planes / Agenda | Acompañamiento autorizado CU14 y cambios CU15. Tendencias públicas/autorizadas CU17 como contexto, trazas CU16 dentro del caso |

El agrupamiento de Postulaciones dentro de Mi ruta es una hipótesis a probar: si cuesta encontrarlo, usar cinco destinos y hacer Postulaciones principal. No cerrar esta etiqueta sin probar las tareas de consulta de estado.

## Inicio tipo feed, acotado a las tareas existentes

Contenido: próxima acción que requiere confirmación; oportunidades con condiciones y explicación; curso/reserva y próxima sesión; cambios de estado de postulaciones; mensaje o propuesta del orientador cuando el producto lo contemple dentro del caso autorizado. No incorporar publicaciones públicas, seguidores, comentarios, likes ni chat general como requisitos nuevos.

Orden inicial por reglas, no por un nuevo agente: acciones que requieren decisión y vencimientos confirmados; próximo evento; continuidad del trabajo propio; oportunidades explicadas; novedades informativas. Sin contador artificial, probabilidad de contratación ni actividad inventada. Limitar la lista inicial y ofrecer Ver anteriores en vez de diseñar un scroll infinito para aumentar permanencia.

Cada elemento debe mostrar tipo, fuente, estado, motivo de relevancia y una acción concreta. Consultar una recomendación no implica compartir datos. Resolver o cambiar una versión actualiza el elemento; evitar duplicados por objeto/tipo/versión. Ocultar una sugerencia no elimina una obligación o alerta del objeto original. Comprobar autorización antes de incluir información en el feed y de nuevo al abrirla.

El feed reúne datos de los módulos existentes. La selección/prioridad puede resolverse por código y reutilizar explicaciones ya generadas por los agentes del dominio. Este diseño no demuestra que exista un endpoint agregado o eventos implementados.

## Progreso sin mezclar conceptos

- Registro: pasos para una tarea enfocada. Volver, guardar y retomar; campos opcionales y experiencia informal no deben convertirse en requisitos para usar todo el servicio.
- Preparación por el centro: lista de tareas con estados para partes independientes y pasos cuando exista dependencia real. Temario antes de interpretar su mapa; condiciones de edición pueden completarse por separado. Banco pendiente no bloquea publicación válida.
- Curso del joven: estado de reserva, sesiones registradas, finalización y certificado con procedencia. No inferir dominio por asistencia, tiempo o una barra llena.
- Postulación: estado del proceso, no porcentaje de posibilidad de contratación ni una secuencia que garantice selección o empleo.

## Dirección visual

Conservar marfil, carbón, terracota y oliva en claro/oscuro. Menos cajas y más separación por espacio: encabezados editoriales, filas con separadores para actividad, una tarjeta destacada para la decisión principal y tarjetas de oportunidad/curso solo cuando agrupen información útil. Evitar tarjetas anidadas como patrón universal. Mantener tablas donde comparar datos sea la tarea.

Probar radio12 en tarjetas,6 en controles y círculos en avatares/marcadores. La propuesta cambia composición y jerarquía, no solo esquinas. Ilustraciones/fotografías solo si aportan contenido y se cuenta con assets apropiados; no son requisito para que la interfaz tenga personalidad. Iconos consistentes con etiquetas visibles; movimiento breve para transiciones y compatible con reducción de movimiento.

## Referencias revisadas y aplicación

- [Android: layouts y navegación, actualizado 2026-09-22](https://developer.android.com/design/ui/mobile/guides/layout-and-content/layout-and-nav-patterns): tres a cinco destinos del mismo nivel; adaptar navegación al tamaño, sin barra inferior en pantallas grandes. El uso de cabecera para el joven web y sidebar para gestión es nuestra inferencia de producto.
- [Material 3: app bars](https://m3.material.io/components/app-bars/): contexto de página y pocas acciones esenciales; distinguir acciones de destinos principales.
- [NN/g: Cards, UI-component definition](https://www.nngroup.com/articles/cards-component/): tarjetas para agrupar contenido relacionado y heterogéneo. No se atribuye a esta fuente un radio específico o una receta obligatoria de feed.
- [GOV.UK: task list](https://design-system.service.gov.uk/components/task-list/): lista de tareas para servicios retomables y tareas con orden flexible; no usarla para imponer una secuencia fija. Ayuda a separar lista de preparación del centro, registro y estados de curso.

## Validar antes de propagar a Figma

Probar con los dos integrantes del equipo: encontrar una vacante y explicar por qué aparece; localizar una postulación; retomar el registro sin CV; encontrar fecha del curso y diferenciar certificado; revisar una candidatura como empresa y un plan como orientador. Observar primer destino elegido, errores de navegación, tarea completada y confusiones de estado. No se han ejecutado estas pruebas con usuarios ni medido mejora de usabilidad.

La muestra de conversación compara joven escritorio, joven móvil y gestión de reclutador con contenido ficticio explícito. No modifica el lienzo aprobado hasta integrar la decisión del equipo.
