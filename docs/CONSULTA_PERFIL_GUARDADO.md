# Consultar y retomar el perfil guardado

Fecha: 2026-10-17. Reporte humano: al guardar el candidato regresaba a un Inicio sin contenido visible y a Cuenta como si empezara de nuevo.

## Causas verificadas

- Inicio deducía que existía un borrador por la presencia de un perfil sin versión confirmada. No leía el borrador ni mostraba los datos guardados.
- El GET del perfil pertenecía al controlador de identidad y devolvía una proyección mínima; el lector completo de ProfileService no estaba conectado a esa ruta.
- El enlace de consulta de un perfil confirmado llevaba al editor de revisión. useDraft, ante 404 después de confirmar, creaba un borrador vacío con base null.

## Cambios

GET `/api/v1/me/candidate-profile` delega en ProfileService cuando está disponible, conservando su controlador único y el fallback de identidad para aplicaciones que solo incluyen ese módulo. Devuelve borrador y `current_version` con contenido, exclusivamente del actor autenticado bajo RLS. `current_version` es una ampliación opcional y nullable del contrato existente; no cambia tablas.

La nueva ruta `/perfil` es de consulta: nombre, presentación, experiencias, estudios, intereses, horarios y preferencias. Distingue guardado de borrador y confirmación; si existen ambos, permite elegir cuál consultar. Leer no crea versiones ni borradores y no comparte datos.

Inicio ofrece «Ver mi perfil guardado», resumen de los datos y continuación según el contenido pendiente. La vista del borrador permite entrar a cada sección y conserva el recorrido para revisión/confirmación. Tras confirmar se actualiza el contexto de sesión. Entrar a editores sin borrador, teniendo versión confirmada, lleva a la vista guardada en lugar de crear uno vacío.

La edición de una versión confirmada mediante copia a una nueva versión no se implementó en esta corrección. Se eliminó el enlace engañoso que abría un formulario vacío; la versión confirmada se consulta sin modificarla. Los borradores anteriores no se borraron ni se repararon automáticamente sin verificar sus datos.

## Verificación

Pruebas API comprueban lectura de experiencia/formación importadas por A02, lectura de la versión confirmada, ausencia de nuevas revisiones por consultar y aislamiento entre cuentas. Se corrigió una aserción antigua que suponía orden de inserción al ordenar por UUID aleatorio: ahora identifica las entradas por su contenido.

El E2E del perfil incluye guardar una experiencia, verla desde Inicio antes de confirmar, recargar, retomar edición, confirmar y consultar tras recargar. Comprueba cero POST de creación de borrador al visitar un editor después de confirmar. Resultados y comandos efectivos en la bitácora. Base sintética local; sin inspección de datos reales del usuario, llamada Vertex, migración remota ni commit/push.
