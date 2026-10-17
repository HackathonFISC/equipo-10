# Plan de rediseño Figma v2

Fecha: 2026-10-16. Aprobación: usuario acepta la propuesta de navegación adaptada y feed y solicita implementarla en Figma. Cuenta: Mainor. Archivo existente: cWPzNNsLPoUenKyfhf4Diu. Alcance: diseño editable y prototipo, sin programación de producto ni BD.

## Dirección aceptada

Joven: cabecera ligera en escritorio y barra inferior en móvil; Inicio, Explorar, Mi ruta y Agenda, con perfil/permisos en cuenta. Postulaciones debe quedar visible como subdestino de Mi ruta y acceso desde Inicio. Gestión: sidebar compacto con texto por rol en escritorio; navegación breve y contextual en móvil. Registro enfocado por pasos. Inicio con acción prioritaria, novedades relevantes y agenda. Composición con más espacio, menos paneles anidados y radio12 en tarjetas,6 en controles. Mantener Source Sans3 y paleta terracota/marfil/carbón/oliva en ambos modos.

## Bloques y aceptación

| Bloque | Trabajo | Criterio de salida |
|---|---|---|
| R0 Inventario | Verificar Mainor, páginas, IDs y componentes existentes; guardar estado externo | No duplicar ni perder contenido funcional; referencias anteriores identificadas |
| R1 Biblioteca | Reutilizar tokens/controles/pasos; añadir navegación inferior, filas de contenido y acción prioritaria; token radius12 | Componentes con propiedades y aliases, estados de foco/selección y etiquetas legibles |
| R2 Estructura global | Aplicar cabecera del joven, sidebar compacto de gestión y navegación inferior en muestras móviles; adaptar vistas existentes | Actor/organización y permisos siguen claros; sin navegación duplicada ni enlaces al frame equivocado |
| R3 Inicio por rol | Construir feed del joven en escritorio/móvil y resumen de trabajo de reclutador, centro y orientador | Información ficticia identificada, fuentes/estados/acciones visibles; no exponer datos ajenos ni inventar efectos |
| R4 Continuidad y progreso | Integrar registro por pasos, curso y publicación, acciones pendientes y Postulaciones en Mi ruta | Diferenciar estado, avance de sesiones, revisión y certificado; banco pendiente no bloquea edición válida |
| R5 Prototipo y revisión | Conectar destinos por rol/tema, actualizar inicio demo y verificar geometría/tipografía/enlaces; capturas representativas | Claro/oscuro y muestras móviles revisados, CU01–CU17 accesibles, sin interfaz aplanada |
| R6 Entrega | Registrar nodos, cambios, evidencia, pendientes y bitácora; actualizar índices | Diseño y plan consultables; no afirmar tests funcionales ni usabilidad medida |

## Inventario de aplicación

Actualizar las50vistas/estados de escritorio de las páginas03–06 y las16vistas del recorrido demo, las6muestras adaptables y las18vistas de registro/progreso. Conservar IDs de vistas donde sea posible para no romper referencias. Integrar inicios v2 en las páginas03–06 y el recorrido de07, con variantes de joven/gestión y muestras móviles; los componentes principales permanecen en02Componentes. Las propuestas previas conservan su contexto documental aunque se actualicen sus estructuras al patrón aprobado.

## Reglas del feed y límites

Prioridad: decisión requerida y vencimientos confirmados → próximo evento → continuidad propia → oportunidades explicadas → novedades. Cada entrada muestra fuente, estado/motivo y acción. No añadir red social, nuevos agentes ni un endpoint pretendidamente ejecutado. El feed agrega datos de módulos existentes; reglas determinísticas de prioridad y explicaciones ya producidas por agentes al implementar el producto. Datos de demo siempre señalados.

Una recomendación no comparte el perfil. Permiso empresarial específico por vacante; práctica privada separada de entrevista; orientador independiente con autorización del joven; centro solo sobre su catálogo y participantes. Cupo se descuenta de manera indivisible en producto, sin aprobación individual posterior del centro. Banco y mapa independientes; finalización y certificado separados.

## Fuentes y estado de validación

Fundamento y mapa CU: [propuesta investigada](PROPUESTA_NAVEGACION_FEED.md). Sus fuentes abiertas son Android/Material3, NN/g y GOV.UK. La aprobación visual del usuario no demuestra usabilidad con participantes externos. Pruebas propuestas: encontrar oportunidad, estado de postulación y curso; retomar registro; revisar candidatura y plan con los roles correctos. No se han ejecutado como pruebas de producto.

Los resultados reales por bloque se registrarán al terminar en la entrega v2 y en el estado local fuera del repositorio. No subir MAGI, claves ni registros de credenciales.

## Cierre de ejecución

R0–R6 ejecutados para diseño v2. Ver [resultado, nodos, comprobaciones y límites](ENTREGA_REDISENO_FIGMA_V2.md). Revisión humana de uso y programación siguen pendientes; esta entrega no acredita producto funcional.
