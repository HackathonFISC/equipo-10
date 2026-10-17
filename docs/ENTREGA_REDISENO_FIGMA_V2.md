# Entrega de rediseño Figma v2

Fecha: 2026-10-16. Cuenta verificada: **Mainor**. Usuario aprobó la navegación adaptada y el inicio tipo feed; queda aplicada en el archivo existente. [Plan de rediseño](PLAN_REDISENO_FIGMA_V2.md).

## Resultado por bloque

| Bloque | Estado y evidencia |
|---|---|
| R0 Inventario | Cuenta Mainor, páginas/IDs y biblioteca comprobados. Estados guardados fuera del repo |
| R1 Biblioteca | Reutilización y ampliación: 77componentes principales,66variables,12variantes de navegación inferior con selección y foco separados; Source Sans3 y tokens existentes |
| R2 Estructura | Actualizadas90vistas/estados existentes:50en perfiles,16del recorrido demo,6muestras adaptables y18de registro/progreso. IDs de vistas anteriores conservados |
| R3 Inicio | Feed del joven: decisión principal, oportunidades explicadas, formación y agenda. Resúmenes de trabajo de empresa, centro y orientador. Primer ingreso sin actividad inventada |
| R4 Continuidad | Registro por pasos, seguimiento de curso, catálogo del joven y subnavegación de Mi ruta con Postulaciones visible. Menús de cuenta y contextos móviles |
| R5 Prototipo | Índice demo actualizado a nuevos inicios; viewport móvil de844px, contenido desplazable y barra inferior fuera del área que desplaza. Revisión estructural y visual representativa |
| R6 Entrega | Documentación, mapa CU y bitácora actualizados. Revisión humana de uso y pruebas de producto pendientes |

Las166vistas/estados registradas incluyen referencias, overlays de cuenta, variantes móviles y copias del recorrido; no representan166funcionalidades nuevas. La biblioteca se amplió con iconos Lucide desde su fuente oficial, entradas de feed, acción prioritaria y radio12 para tarjetas. Menos paneles anidados y más separación por espacio y líneas. No se añadieron fuentes ni modelos de IA.

## Abrir el resultado

- [Índice demo v2](https://www.figma.com/design/cWPzNNsLPoUenKyfhf4Diu/Diseno-plataforma?node-id=29-652)
- [Joven: inicio escritorio](https://www.figma.com/design/cWPzNNsLPoUenKyfhf4Diu/Diseno-plataforma?node-id=43-690)
- [Joven: inicio móvil oscuro](https://www.figma.com/design/cWPzNNsLPoUenKyfhf4Diu/Diseno-plataforma?node-id=43-1038)
- [Joven: primer ingreso](https://www.figma.com/design/cWPzNNsLPoUenKyfhf4Diu/Diseno-plataforma?node-id=43-925)
- [Reclutador: resumen de trabajo](https://www.figma.com/design/cWPzNNsLPoUenKyfhf4Diu/Diseno-plataforma?node-id=43-3126)
- [Centro: resumen](https://www.figma.com/design/cWPzNNsLPoUenKyfhf4Diu/Diseno-plataforma?node-id=43-3368)
- [Orientador: acompañamiento](https://www.figma.com/design/cWPzNNsLPoUenKyfhf4Diu/Diseno-plataforma?node-id=43-3610)
- [Componentes y estados en ambos temas](https://www.figma.com/design/cWPzNNsLPoUenKyfhf4Diu/Diseno-plataforma?node-id=55-5362)

## Navegación y cobertura funcional

Joven: Inicio, Explorar, Mi ruta, Agenda; Mi cuenta abre perfil, evidencias, práctica y actividad. Mi ruta mantiene Plan, Formación, Postulaciones y Práctica como destinos visibles. Explorar separa Empleos y Cursos. Gestión usa sidebar compacto por rol, manteniendo Equipo en empresa, Cursos/Ediciones/Participantes/Certificados en centro y Jóvenes/Planes/Agenda en orientador. Tendencias se consulta dentro de Vacantes.

CU01–CU17 conservan las vistas y enlaces de nodos documentados en [entrega v1](ENTREGA_FIGMA_V1.md); sus referencias siguen resolviendo aunque la estructura visual y el punto inicial cambien. [Mapa de información y fundamento investigado](PROPUESTA_NAVEGACION_FEED.md). La navegación interna de las páginas de perfiles quedó conectada sin destinos faltantes entre los enlaces registrados.

La demo integrada de07 usa Claro y nuevos inicios para los cuatro perfiles. Sus variantes oscuras de referencia y algunas salidas de08 abren otra vista de diseño mediante URL, porque Figma no permite NAVIGATE entre páginas. Son enlaces de referencia, no la interacción prevista para la aplicación. Las variantes Claro/Oscuro principales permanecen en las páginas de perfiles. No afirmar que todo botón o condición del producto esté implementado en Presentar.

## Comprobaciones y límites

Se auditaron siete páginas afectadas: sin desbordes geométricos no intencionales, fuentes incorrectas, imágenes de interfaz aplanadas ni destinos NODE que apunten fuera de su página o a un nodo inexistente. El contenido que excede un contenedor con desplazamiento vertical es intencional. La muestra de componentes fue revisada después de corregir las propiedades de etiqueta de las variantes de foco.

Se verificaron por captura composiciones de feed claro/oscuro, móvil390/320, resúmenes de gestión, continuidad del perfil, registro por pasos, índice de demo y biblioteca en ambos temas. La revisión es representativa, no una prueba manual individual de todos los botones. Se conservaron los colores previamente comprobados en16pares con contraste >=4.5:1; la ampliación añade geometría e iconos, sin modificar la paleta semántica.

El estado y resumen verificables están fuera del repo en `magi/contexto/FIGMA_REDISENO_V2_ESTADO.json` y `FIGMA_REDISENO_V2_RESUMEN.json`. No publicar esos registros con MAGI ni credenciales.

No se ejecutaron agentes de producto, autenticación, postulaciones, reservas, certificados, notificaciones, E2E ni evals. No se modificó Supabase, Prisma, API o frontend; no hubo commit/push. La usabilidad debe revisarse con personas: encontrar una postulación, retomar registro, localizar curso/certificado y operar los roles correctos. El menú de cuatro destinos puede revisarse si Postulaciones resulta difícil de encontrar.

## Autoría

Dirección y aprobación del rediseño: Mainor Villarreal y Giovanny Arpaia como equipo humano; decisión explícita del usuario en este chat. Investigación previa y ejecución del rediseño: Codex con skills figma-use, figma-generate-design y figma-generate-library. La referencia BALTHASAR/Gemini Vertex corresponde a la biblioteca propuesta previamente; no hubo una nueva llamada Gemini en este rediseño.
