# Revisión de navegación y progreso — propuesta visual

> **Lectura histórica — conciliación 2026-10-17:** se conservan el alcance, resultados y autoría de la ejecución original. Los pendientes de aquel momento no describen automáticamente la entrega actual. Consultar [estado vigente](ESTADO_ACTUAL.md), [D8 corregido](D8_ENTREGA.md) y [despliegue aplicado/verificado](CIERRE_MIGRACIONES_REPOSITORIO.md). Esta nota no repite pruebas ni cambia resultados anteriores.

Actualización: propuesta aceptada por el usuario e integrada en [rediseño Figma v2](ENTREGA_REDISENO_FIGMA_V2.md). Las frases de aprobación pendiente que siguen describen el antecedente.
Fecha: 2026-10-16. Usuario acepta la dirección visual y solicita mejorar el sidebar e incorporar progreso al registro y cursos. Cuenta Mainor verificada. Página nueva: **08 Navegación y progreso**. La v1 conserva sus nodos y sigue disponible; esta propuesta aún no significa aprobación para sustituir globalmente toda la navegación.

- Navegación superior contextual con cinco secciones para el joven y opciones personales agrupadas en «Mi cuenta». El contenido gana espacio. El menú de cuenta se explica visualmente, pero su desplegable y todas las rutas secundarias no están implementados en este prototipo.
- Registro enfocado en cuatro pantallas: Cuenta → Experiencia → Disponibilidad → Revisión. Sin menú principal durante el registro. Volver y continuar navegables; pasos anteriores accesibles. Confirmar perfil no comparte datos con empresas.
- Preparación del curso por el centro: Temario → Mapa → Edición → Publicación. Banco de preguntas independiente; pendiente no bloquea publicar una edición válida.
- Seguimiento del joven: Reserva → En curso → Finalización. Sesiones registradas son un dato del centro, no un porcentaje de competencia ni una acción de completar por clic. Certificado con estado separado.
- Componentes nuevos: Paso de proceso (Completado/Actual/Pendiente) y Enlace de cabecera (Normal/Activo/Foco), vinculados a los tokens existentes. Sin añadir colores, fuentes ni modelos.
- 14 vistas de escritorio y 4 muestras móviles de390px en claro y oscuro. El proceso de cuenta es una propuesta de onboarding; la autenticación futura mantiene Supabase Auth, sin ejecutarse aquí.

## Enlaces de revisión

- [Registro guiado](https://www.figma.com/design/cWPzNNsLPoUenKyfhf4Diu/Diseno-plataforma?node-id=36-2)
- [Paso de experiencia](https://www.figma.com/design/cWPzNNsLPoUenKyfhf4Diu/Diseno-plataforma?node-id=36-78)
- [Navegación superior / oscuro](https://www.figma.com/design/cWPzNNsLPoUenKyfhf4Diu/Diseno-plataforma?node-id=37-566)
- [Seguimiento de curso](https://www.figma.com/design/cWPzNNsLPoUenKyfhf4Diu/Diseno-plataforma?node-id=37-434)
- [Preparación por el centro](https://www.figma.com/design/cWPzNNsLPoUenKyfhf4Diu/Diseno-plataforma?node-id=37-501)
- [Curso móvil / oscuro](https://www.figma.com/design/cWPzNNsLPoUenKyfhf4Diu/Diseno-plataforma?node-id=37-2832)

## Validación y pendientes

18frames inspeccionados estructuralmente, sin desbordes geométricos, fuentes incorrectas ni destinos inválidos en las42conexiones del prototipo. Revisión visual de registro, inicio oscuro y seguimiento móvil oscuro. No se ejecutó registro, autenticación, asistencia, finalización, certificación ni agentes reales. No se modificó frontend/API/BD ni se hizo push. Antes de propagar a todas las vistas, revisar la propuesta con el usuario; esta selección de secciones todavía no reemplaza su aprobación.
