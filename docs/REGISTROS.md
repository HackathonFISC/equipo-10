# Registro de evidencias por acumular

## Lectura actual — 2026-10-17

Este registro conserva notas históricas de preparación. Los párrafos que indican producto/diseño sin crear corresponden a sus etapas originales. Estado y cobertura actuales en [README](../README.md), [catálogo CU](CASOS_DE_USO.md), [verificación integral](VERIFICACION_INTEGRAL_D1_D8.md) y [revisión focal D8](REVISION_D8_CIERRE_FOCAL.md). Las pruebas técnicas no sustituyen los evals semánticos ni una traza correlacionada de tres agentes. [Colaboración y prompts](COLABORACION_AGENTES.md) y [guía de presentación](GUIA_PRESENTACION_Y_EVIDENCIAS.md) organizan la evidencia para entrega. Autoría y acciones posteriores se registran en BITACORA_IA.csv, sin borrar el historial ni inventar ejecución.

## Estado vigente tras revisión integral

[Plan consolidado y dos referencias](REVISION_INTEGRAL_PLAN.md): Codex revisar documentos completos; BALTHASAR por Vertex revisar paquete acotado de extractos y síntesis. Intento amplio agotó tiempo; tarea acotada sí produjo informe con lectura/escritura verificadas. RC01–RC05 tratados y RC06 pendiente de decisiones. 17CU conservados,40comprobaciones documentales correctas, E01–E20/X01–X15/I01–I08sin ejecución de producto. Sin desarrollo, schema Prisma, migraciones ni cambios en Supabase. Tablero y anotaciones anteriores conservan contexto de cada etapa.

Regla: actualizar en cada bloque. «Planeado» no significar «implementado». No inventar ejecución, precisión, fuentes, usuarios o impacto.

## Tablero inicial

| Ítem | Estado | Evidencia | Responsable |
|---|---|---|---|
| Repo | Existente; clon local limpio antes de esta planificación | HackathonFISC/equipo-10, base db68218 | Por asignar |
| Registro ante organización | Por confirmar | Pendiente | Por asignar |
| Reto | Seleccionado: 3 | README Reto: 3 | Equipo |
| Calendario T0/T24 | Por confirmar | Enunciado indica 9-10 octubre; sesión 16 octubre | Por asignar |
| Integrantes | Confirmados por el usuario; solo dos | Mainor Villarreal, Giovanny Arpaia | Equipo |
| Producto y agentes | Propuesta sin implementar | AGENTES.md | Por asignar |
| Datos/fuentes | Investigación documental por IA completada; datos operativos pendientes | FUENTES.csv; INVESTIGACION.md | IA: consulta/síntesis; equipo: decisiones |
| Evals | 20 casos diseñados, sin ejecutar | ../evals/casos.csv | Por asignar |
| Bitácora IA | Autoría humana de ideas y aportes IA diferenciados | BITACORA_IA.csv; IDEAS_EQUIPO.md | Equipo y registro asistido por IA |
| D03-D08 | Pendientes de producto funcional | ENTREGABLES.md | Por asignar |

## Por cada bloque

Fecha/hora; requisito ID; responsable; archivos/commit; decisión y alternativa descartada con motivo; herramienta/modelo de IA; corrección manual; comando de prueba; resultado/errores; artefacto/traza; siguiente paso. No pegar chats completos: conservar resumen, referencias y huellas pertinentes.

## Por cada fuente

URL o archivo; entidad; fecha de consulta; cobertura/periodo; licencia/permiso y restricciones; campos usados; transformación; incertidumbre; ubicación local y huella; real/sintética. Verificar origen de ofertas, cursos y transporte antes de afirmar que son actuales. No copiar CV personales a logs públicos.

## Metodología: completar con evidencia

Problema/actores; objetivos y recortes; arquitectura implementada; modelos y prompts; contratos; algoritmo y función objetivo; restricciones y unidades; humano/aprobación; acción/idempotencia; datos y privacidad; despliegue/configuración; operación/recuperación; trazabilidad; evals/métricas/resultados; límites y trabajo pendiente. Crear METODOLOGIA.md cuando esas decisiones existan; no llenar con supuestos presentados como hechos.

## Evals y métricas propuestas

Cada caso tener entrada/fixture, requisito, resultado esperado, función métrica, umbral, resultado real y traza/SHA. Los 20 casos iniciales están en evals/casos.csv; crear fixtures antes de ejecución. No marcar PASS sin correrlos.

- Restricciones duras: violaciones = 0; medir capacidades, solapamientos, salario, presupuesto y tiempos con código.
- Acción: bloquear 100% de intentos sin aprobación; ejecutar una sola vez ante reintento duplicado.
- Extracción: comparar campos con gold etiquetado; reportar exactitud por campo y formatos, no solo una media.
- Equidad: misma asignación/puntaje al cambiar solo nombre/género o etiqueta geográfica con logística constante; distinguir cambios reales de traslado.
- Trazabilidad: 100% de decisiones/acciones de casos de eval con agente, correlación y resultado.
- Latencia/costo: registrar tiempo y consumo observado cuando disponible; no inventar token/costo por número de caracteres.

Umbrales son propuestas técnicas del equipo, no umbrales publicados por la organización. Aplicar rubricación final además de estos checks.

## Autoría y colaboración

- Humanos (Mainor y Giovanny): definir ideas principales, aportar indicaciones y dirigir alcance/orden del trabajo. Conservar ideas en IDEAS_EQUIPO.md. No atribuir autoría individual ni ediciones manuales no confirmadas.
- IA: investigar información, organizar, guardar y redactar documentación; analizar ideas y proponer aportes identificados como propuestas.
- Investigación: consultas web por MELCHIOR/Codex; síntesis por BALTHASAR/CASPER; integración/revisión MAGI. Conservar fechas, fuentes y límites.
- El campo cambio_manual_confirmado de la bitácora distinguir aportes humanos de correcciones realizadas por IA; no confundir revisión automática con trabajo manual del equipo.

## Arquitectura de agentes compartidos, revisión 2

[Arquitectura y contratos](ARQUITECTURA_AGENTES.md), [mapeo CU01–CU17](MAPEO_CASOS_AGENTES.md) y [reparto vigente](AGENTES.md): A01 Vacantes/contenido; A02 Perfil/aprendizaje; A03 Compatibilidad; A04 Postulación/práctica; A05 Formación. Auditoría antigua A05 migra a C02. Preguntas ligadas a temario/mapa/banco versionados, con permisos por actor. Estado de diseño; producto/evals todavía sin ejecutar.

Cierre documental de remapeo: 17 casos alineados, opinión de BALTHASAR por Vertex sobre arquitectura y mapeo incorporada, 38 comprobaciones estructurales correctas y validador MAGI aprueba sin observaciones. Quedan modelos/stack/contratos técnicos detallados y producto/evals por implementar/ejecutar.

## Autonomía y contratos propuestos

[Invocación individual, respuestas, herramientas y modelos](AUTONOMIA_CONTRATOS_MODELOS.md). Relectura de §§1–2/5.4 distingue exigencias oficiales de criterio de diseño del equipo. Cada agente decide dentro de su tarea y usa herramientas; responsabilidad individual no significa aislamiento absoluto. I01–I08 aún no ejecutados. Base propuesta: Gemini 3.8 Flash por Vertex para cinco agentes; GPT-6 Sol medium como alternativa evaluable, sin cambiar configuración ni dar por probado acceso API del producto. El contrato nuevo es diseño documental; la aprobación previa del remapeo no lo convierte en implementación validada.

Acuerdos humanos confirmados sobre datos/acceso: Supabase Auth; candidatos con registro propio y organizaciones mediante cuentas de demo/invitaciones; reserva interna inmediata con descuento de un cupo, sin revisión individual posterior del centro. [Modelo actualizado](MODELO_DATOS_MODULOS_PROPUESTA.md). Sin implementación ni cambios en Supabase; no extender aprobación al resto del esquema.

[Detalle de cursos y catálogos de puestos/competencias](CATALOGOS_CURSOS_PUESTOS_HABILIDADES.md): propuesta de campos y relaciones, sin implementación; incorpora precisión humana sobre estos conceptos.

Presentación confirmada: **video descartado; demo en vivo alternando perfiles + PPT de módulos**. [Guion y dirección visual/skills propuestas](DEMO_PPT_DISENO.md). Pantallas/diseños/PPT aún no creados; dirección terracota claro/oscuro confirmada; duración por acordar.

[Plan de Figma para «Diseño plataforma»](PLAN_FIGMA_DISENO_PLATAFORMA.md): bloquesF0–F7, biblioteca/temas,17CU y entrega a programación. Terracota claro/oscuro confirmada; MCP local responde con página vacía0:1, herramientas de lectura sin escritura expuesta. URL del destino aportada por usuario; identidad del archivo activo del MCP aún sin verificar; lienzo no modificado.

[Paquete inicial de Figma](FIGMA_PRIMER_BLOQUE.md): seis vistas y 18 tokens candidatos; [componentes BALTHASAR con revisión Codex](FIGMA_COMPONENTES_BALTHASAR.md). Destino confirmado por enlace del usuario: [Diseño plataforma](https://www.figma.com/design/cWPzNNsLPoUenKyfhf4Diu/Dise%C3%B1o-plataforma?node-id=0-1), archivo `cWPzNNsLPoUenKyfhf4Diu`, nodo `0:1`. El MCP local no expone la identidad del archivo activo ni herramientas de escritura; la coincidencia con este destino sigue sin verificarse. Lienzo sin modificar.

## Diseño Figma v1 construido

Estado actual (2026-10-16): diseño v1 construido en Figma con la cuenta Mainor. Ver [entrega, enlaces de nodos y validación](ENTREGA_FIGMA_V1.md). Las limitaciones de acceso descritas abajo son antecedentes, superadas mediante el servidor remoto oficial. Aplicación y pruebas funcionales todavía pendientes.
50frames de escritorio para25vistas/estados en claro y oscuro,6muestras adaptables y16pantallas del recorrido demo;49componentes principales,65variables y6estilos. Revisión estructural y visual representativa; sin ejecución de agentes/producto/BD ni push.

[Revisión visual: navegación superior y progreso](REVISION_FIGMA_NAVEGACION_PROGRESO.md): registro por pasos, publicación de cursos y seguimiento del joven. Propuesta en página08; mantener referencia v1 hasta revisión humana.

[Recomendación investigada: navegación adaptada e inicio con feed](PROPUESTA_NAVEGACION_FEED.md): mapa por perfil/CU, progreso y pruebas de descubribilidad propuestas. Muestra exploratoria de conversación; sin cambios nuevos de Figma ni implementación.

[Rediseño Figma v2 aplicado](ENTREGA_REDISENO_FIGMA_V2.md): [plan](PLAN_REDISENO_FIGMA_V2.md), navegación adaptada, feed y resúmenes por rol, continuidad/progreso y demo renovada. La propuesta de navegación ya fue aprobada para su aplicación visual; pruebas con personas y producto pendientes.
