# Dos flujos de trabajo: Figma y desarrollo

> **Diseño/plan de su etapa — conciliación 2026-10-17:** los pasos futuros y alternativas siguientes conservan su contexto original; no son una lista de todo lo que falta hoy. Implementación y pendientes vigentes en [ESTADO_ACTUAL.md](ESTADO_ACTUAL.md) y [cobertura CU](CASOS_DE_USO.md#cobertura-actual-por-caso). Los casos diseñados no se presentan como ejecutados.

Fecha: 2026-10-16. Estado: planificación; no archivo Figma, frontend ni PPT creados. Usuario solicita diseñar primero y programar después; evitar azul típico y proponer interfaz rectangular con personalidad. Dirección terracota con marfil/carbón/oliva y modos claro/oscuro confirmada después por el usuario; valores específicos son candidatos de diseño. Referencias: [demo](DEMO_PPT_DISENO.md), [CU](ESPECIFICACION_CASOS_USO.md), [plan](REVISION_INTEGRAL_PLAN.md) y [mapeo](MAPEO_CASOS_AGENTES.md).

## Dirección visual propuesta

Estética de herramienta de trabajo cercana: superficies marfil, texto carbón, acento terracota y estados oliva. Estructura rectangular, separadores claros, composición con buen espacio y tipografía jerarquizada; evitar saturación de tarjetas, sombras y chat. La diferenciación surge del contenido y de las tareas de cada perfil, no de cuatro temas de color distintos.

| Token propuesto para tema claro | Color | Uso |
|---|---|---|
| Fondo | #F6F3EB | Lienzo marfil |
| Superficie | #FFFDF8 | Formularios y paneles |
| Texto principal | #252A25 | Títulos y contenido |
| Texto secundario | #61665D | Ayuda y metadatos |
| Borde estructural | #D8D3C7 | Separación decorativa; no única señal de límite/foco de campo |
| Borde de control | #777B70 | Campos/controles que necesitan límite visible |
| Acción principal | #A3452D | Botón con texto blanco y foco visible |
| Confirmación | #485632 sobre #E9EDDF | Resultado positivo con icono/texto |
| Advertencia | #76500E sobre #FFF1CE | Falta información o requiere revisión, con texto |
| Error/bloqueo | #9B3028 sobre #FBEAE6 | Estado de error identificado por texto, no solo color |

No colorear todos los módulos o agentes con tonos distintos. Terracota distingue acción, oliva confirmación; labels e iconos distinguen candidato/reclutador/centro/orientador. Tema oscuro incluido por confirmación posterior del usuario, mediante modos de variables y componentes compartidos.

Formas: radios4px etiquetas/celdas y6–8px campos/botones/paneles; nada de píldoras gigantes. Bordes1px, sombras solo en capas flotantes. Espaciado base4/8px, separaciones16/24/32px. Propuesta tipográfica: Source Sans3 como familia única si disponible en Figma/web, con fallback de sistema; verificar disponibilidad antes de fijarla. Cuerpo16px, metadatos14px, títulos24–32px; no reducir textos importantes para encajar tablas. Iconos lineales consistentes, números tabulares en cupos/costos. Movimiento breve para feedback, sin animaciones decorativas ni dependencia de hover.

Alternativa para comparar: oliva como acción principal y terracota solo acento puntual; cambia también jerarquía hacia bloques de comparación y siguiente paso. No desarrollar ambos temas: elegir uno después de comparar una vista representativa. La muestra de conversación es ilustrativa, no pantalla de producto implementada ni diseño Figma final.

## Flujo A — Diseñar en Figma

| Paso | Trabajo | Salida y comprobación |
|---|---|---|
| F1 Alcance | Mapear cada escena de demo a actor/CU/vista/acción; definir contenido y permisos | Inventario de vistas y estados, sin pantallas genéricas para todos los actores |
| F2 Estructura | Bocetos simples de navegación, listas, formularios y detalle; definir acción principal y siguiente paso | Recorrido entendible sin color; campos obligatorios/desconocidos y aprobación visibles |
| F3 Dirección visual | Comparar las dos muestras y elegir paleta, tipografía, radios y densidad | Una dirección elegida por equipo; tokens semánticos nombrados |
| F4 Biblioteca mínima | Variables, estilos y componentes reutilizables: navegación, botones, campos, tablas/listas, etiquetas, alertas, panel de actividad y confirmación | Estados normal/hover/foco/deshabilitado/error/carga; instancias editables y variantes, no pantallas pegadas como imagen |
| F5 Vistas completas | Montar por componentes el recorrido candidato y fuentes vacante/curso; después orientador, postulación/agenda y cambios | Pantallas diferenciadas por tarea, texto y datos de demo consistentes; fuente/evidencia desplegables |
| F6 Prototipo | Conectar escenas y confirmaciones con estados vacío/carga/pendiente/bloqueado/error/éxito | Ensayar los cuatro perfiles; prototipo explica interacción sin fingir persistencia o agentes reales |
| F7 Entrega a desarrollo | Relacionar frame/nodo y versión con CU, componentes/tokens, campos, acción/API, permiso y aceptación | Inspección visual y estructural; contraste/foco/legibilidad revisados; inventario de pendientes y enlaces verificables |

Organización propuesta del archivo: Fundamentos, Componentes, Candidato, Reclutador, Centro, Orientador y Recorrido demo. Escritorio como composición principal para presentación; comprobar al menos adaptación de navegación/formularios a móvil sin diseñar duplicados innecesarios. Ancho objetivo y breakpoints se fijan al crear los bocetos.

Skills: figma-generate-design para pantallas; figma-generate-library para tokens/componentes; figma-use para operaciones y figma-create-new-file si se solicita crear archivo. Antes de escribir, inspeccionar archivo/bibliotecas existentes y reutilizar componentes compatibles; no asumir conexión o archivo ya disponibles. Entregar texto/capas/componentes editables. No importar una captura completa como pantalla final.

**Salida de Figma:** recorrido clave revisado, componentes y estados suficientes para implementarlo, sin decisiones visuales esenciales pendientes. Cerrar por bloques completos; no hace falta pulir toda función secundaria antes de programar el primer bloque autorizado.

## Flujo B — Programar desde el diseño revisado

La instrucción actual de no desarrollar sigue vigente. Este flujo se ejecuta después de autorización de inicio y del cierre de decisiones técnicas/datos del plan, no por crear este documento.

| Paso | Trabajo | Salida y comprobación |
|---|---|---|
| D1 Contrato del bloque | Tomar CU, frame revisado, campos/datos, permisos, estados, endpoints y herramientas de agente | Contrato técnico y aceptación claros; ninguna escritura real solo por coincidir con maqueta |
| D2 Base compartida | Aplicar tokens a React, componentes accesibles, navegación y contexto de identidad; preparar entorno de pruebas aislado | Mismos nombres/valores que Figma, una fuente de estilos, sin colores sueltos por pantalla |
| D3 Recorrido funcional completo | API controlador→servicio→Prisma, reglas/transacción, agente/herramienta y vista juntos | Acción persistida y autorizada con recibo; datos y cálculos reales, no frontend vacío |
| D4 Pruebas del bloque | Unitarias determinísticas, integración permisos/capacidad/idempotencia y E2E; evals IA/aislados cuando aplica | Evidencias reproducibles, fallos corregidos; aprobación documental no equivale PASS del producto |
| D5 Comparación visual | Contrastar aplicación con frame y estados revisados en anchos elegidos | Corregir jerarquía, espaciado, tipos, foco, vacío/error/carga y comportamiento; no solo capturar pantalla feliz |
| D6 Ensayo e integración | Seguir historia entre cuentas/sesiones aisladas y verificar cambios visibles en contraparte | Sin fugas de identidad/caché; agentes y efectos correlacionados; reacomodo con nueva aprobación |
| D7 Cierre | Actualizar evidencia, bitácora, límites y diseño si cambio funcional aceptado | CU/diseño/API/BD/demo/PPT coherentes; no publicar MAGI ni credenciales |

Orden de bloques propuesto: (1) identidad/contextos/catálogos; (2) perfil + vacante + compatibilidad; (3) temario/banco + formación/reserva; (4) orientador + postulación/entrevista/agenda/reacomodo; (5) escenarios adversarios, ≥15evals reales y ensayo final. Agentes se integran desde el bloque que los necesita; no conectarlos todos al final. Diseño y código mantienen el mismo límite de dominio y permisos.

Skills al implementar: figma-design-to-code/figma-implement-design según operación y diseño real disponible. Pruebas E2E con Playwright y revisión visual del producto. PPT mediante skill de presentaciones cuando se solicite el archivo, reutilizando tokens y diagramas verificables. No es necesario crear imágenes decorativas para dar personalidad.

## Acuerdo entre ambos flujos

Matriz común por vista: actor → CU → módulo → frame/versión → componente/tokens → campos/validaciones → acción/contrato API → agente/herramienta → autorización → estados → criterio de aceptación → evidencia. Cambios funcionales vuelven a contrato/CU y diseño; cambios solo visuales se reflejan en biblioteca y React. No aceptar captura bonita como prueba de reglas, ni tests correctos como prueba de fidelidad visual.

## Siguiente decisión

Terracota elegida por usuario en claro/oscuro; conservar marfil/carbón/oliva y acento terracota sin grandes fondos. Validar valores exactos y geometría propuesta. Después cerrar inventario de vistas y empezar bocetos Figma cuando se solicite crear/editar archivo. Identidad/nombre del producto, duración de demo y detalles pendientes del catálogo siguen por resolver; no asumir aceptación por ver la muestra.

Plan de Figma para «Diseño plataforma» (`PLAN_FIGMA_DISENO_PLATAFORMA.md`, referencia histórica no incluida): bloquesF0–F7, biblioteca/temas,17CU y entrega a programación. Terracota claro/oscuro confirmada; MCP local responde con página vacía0:1, herramientas de lectura sin escritura expuesta. Nombre/URL de archivo aún no comprobados; lienzo no modificado.
