# Revisión previa al desarrollo

> **Lectura histórica — conciliación 2026-10-17:** se conservan el alcance, resultados y autoría de la ejecución original. Los pendientes de aquel momento no describen automáticamente la entrega actual. Consultar [estado vigente](ESTADO_ACTUAL.md), [D8 corregido](D8_ENTREGA.md) y [despliegue aplicado/verificado](CIERRE_MIGRACIONES_REPOSITORIO.md). Esta nota no repite pruebas ni cambia resultados anteriores.

Fecha: 2026-10-16. Acceso real al checkout local equipo-10; se inspeccionaron inventario, estado Git, documentación funcional/técnica y configuración pertinente de MAGI sin consultar secretos. Solo había README, docs y evals, además de Git; no había aplicación, API, package.json ni schema Prisma. Git ya contenía cambios documentales previos; se conservaron.

## Alcance de revisión

Inventario y lectura local automatizada de todos los MD/CSV/JSON documentales; revisión de reglas, contratos y secciones funcionales vigentes para organizar el plan. Los documentos históricos se consultaron por índice/secciones/referencias y no se presenta esto como auditoría manual de cada línea. No hubo una nueva investigación web, una llamada a Gemini, lectura completa por Gemini ni evaluación de producto. El enunciado original y las ideas humanas se preservaron.

La tabla identifica contenido documental al revisar (bytes y prefijo SHA256), no un sello inmutable de entrega: README y bitácora seguirán evolucionando. Los archivos de esta nueva entrega no se incluyen en este inventario de antecedentes. Evals/casos.csv se parseó aparte: 20 casos, todos diseñados sin resultados reales.

## Hallazgos y resolución para el plan

| Hallazgo | Consecuencia |
|---|---|
| Producto sin código; prototipo Figma v2 construido | Empezar desarrollo por base mínima y joven; no volver a diseñar un sidebar v1 ni presentar dibujo como persistencia |
| Índice mezclaba estados actuales con lienzo vacío/MCP solo lectura | Reescribir índice vigente; conservar antecedentes accesibles e identificados como historia |
| React/TSX/Bun/Prisma son dirección solicitada; NestJS/versiones pendientes | D0 define comprobación de compatibilidad antes de fijar framework/runtime; no inventar aprobación o versiones |
| Modelo lógico amplio, sin diccionario físico/contratos por modo cerrados | Especificar D1-D2 primero; esquema incremental cuando se autorice implementar, sin crear todas las tablas por anticipado |
| Escala, puesto principal y dos ejes de requisito siguen opciones abiertas | Recomendar opciones concretas y mantenerlas pendientes, sin cambiar fuentes humanas |
| Joven depende de vacantes/cursos antes de gestión profesional | Fixtures sintéticos versionados y aislados; después integrar publicación real por empresa/centro |
| Reserva depende de revisión si el plan fue acompañado | D8 se adelanta para ese recorrido; no inventar aprobaciones para poder terminar D4 |
| Estados antiguos del análisis mezclan solicitado/aprobado del curso | Prevalecen RGN09/10/14 y reserva inmediata: sin solicitud pendiente individual del centro ni certificado automático |
| Herramientas de documentos de MAGI ya existen | Reutilizar magi-pdf/documentos/traduccion; no atribuir soporte de ingesta del producto por tenerlas instaladas |
| BALTHASAR usa google-vertex/gemini-3.8-flash en configuración | Preparar encargos acotados y revisión; no deducir cuota actual ni acceso de API de producto de esa configuración |
| Pruebas previas de MAGI y revisión visual no son evals del producto | E01-E20 y X/I siguen pendientes; separar unitarias/integración/E2E/calidad IA y evidencia real |
| Flujo histórico de veinte horas y fechas del enunciado no fijan plazo actual | Plan por dependencias/salidas; confirmar ventana antes de entrega/tag, sin retrofechar |

## Inventario documental consultado

| Archivo | Bytes | SHA256 prefijo | Tratamiento |
|---|---:|---|---|
| [ACOMPANAMIENTO_JOVEN.md](ACOMPANAMIENTO_JOVEN.md) | 4694 | c652382403bd | Indice, secciones y referencias revisadas; antecedente/complemento |
| AGENTES.md (`AGENTES.md`, referencia interna no distribuida) | 5492 | 340854af1534 | Reglas/contratos y secciones funcionales revisadas |
| ANALISIS_IDEAS.md (`ANALISIS_IDEAS.md`, referencia histórica no incluida) | 10000 | 5cf1892aff0c | Indice, secciones y referencias revisadas; antecedente/complemento |
| [ARQUITECTURA_AGENTES.md](ARQUITECTURA_AGENTES.md) | 15309 | b045474876c2 | Reglas/contratos y secciones funcionales revisadas |
| [AUTONOMIA_CONTRATOS_MODELOS.md](AUTONOMIA_CONTRATOS_MODELOS.md) | 14858 | 3081429467ba | Reglas/contratos y secciones funcionales revisadas |
| [BITACORA_IA.csv](BITACORA_IA.csv) | 22098 | 854d16bcbf6b | CSV parseado: 40 filas |
| [CASOS_DE_USO.md](CASOS_DE_USO.md) | 31590 | 183a84d8a7a1 | Indice, secciones y referencias revisadas; antecedente/complemento |
| [CATALOGOS_CURSOS_PUESTOS_HABILIDADES.md](CATALOGOS_CURSOS_PUESTOS_HABILIDADES.md) | 10948 | 2d84ee24f0ec | Reglas/contratos y secciones funcionales revisadas |
| DEFINICION_FUNCIONAL_PROPUESTA.md (`DEFINICION_FUNCIONAL_PROPUESTA.md`, referencia histórica no incluida) | 2201 | 81f22e72924c | Indice, secciones y referencias revisadas; antecedente/complemento |
| [DEMO_PPT_DISENO.md](DEMO_PPT_DISENO.md) | 9782 | 7bd7b6b36ce6 | Indice, secciones y referencias revisadas; antecedente/complemento |
| ENTREGA_FIGMA_V1.md (`ENTREGA_FIGMA_V1.md`, referencia histórica no incluida) | 11560 | 311098d7ea6c | Indice, secciones y referencias revisadas; antecedente/complemento |
| [ENTREGA_REDISENO_FIGMA_V2.md](ENTREGA_REDISENO_FIGMA_V2.md) | 6134 | d6a3e84e8ef9 | Reglas/contratos y secciones funcionales revisadas |
| [ENTREGABLES.md](ENTREGABLES.md) | 3766 | 906a111926b8 | Reglas/contratos y secciones funcionales revisadas |
| [ESPECIFICACION_CASOS_USO.md](ESPECIFICACION_CASOS_USO.md) | 45102 | d3fa0c49761e | Reglas/contratos y secciones funcionales revisadas |
| [FIGMA_COMPONENTES_BALTHASAR.md](FIGMA_COMPONENTES_BALTHASAR.md) | 8026 | 5bc2a1642703 | Indice, secciones y referencias revisadas; antecedente/complemento |
| FIGMA_PRIMER_BLOQUE.md (`FIGMA_PRIMER_BLOQUE.md`, referencia histórica no incluida) | 7688 | 231eff47382a | Indice, secciones y referencias revisadas; antecedente/complemento |
| FLUJO_TRABAJO.md (`FLUJO_TRABAJO.md`, referencia histórica no incluida) | 8207 | 52594a054e40 | Reglas/contratos y secciones funcionales revisadas |
| [FLUJOS_FIGMA_DESARROLLO.md](FLUJOS_FIGMA_DESARROLLO.md) | 9628 | 7719a4d29cfc | Indice, secciones y referencias revisadas; antecedente/complemento |
| [FUENTES.csv](FUENTES.csv) | 6081 | 67df2e54a7e1 | CSV parseado: 18 filas |
| [IDEAS_EQUIPO.md](IDEAS_EQUIPO.md) | 2182 | 63e896c8b965 | Indice, secciones y referencias revisadas; antecedente/complemento |
| investigacion/DOMINIO_REFERENTES.md (`investigacion/DOMINIO_REFERENTES.md`, referencia histórica no incluida) | 11689 | 5531cc11f285 | Indice, secciones y referencias revisadas; antecedente/complemento |
| investigacion/ESTADO.md (`investigacion/ESTADO.md`, referencia histórica no incluida) | 1479 | 3f9ee524d36c | Indice, secciones y referencias revisadas; antecedente/complemento |
| investigacion/EVIDENCIA_COORDINADOR.json (`investigacion/EVIDENCIA_COORDINADOR.json`, referencia histórica no incluida) | 3790 | 33940c4ded98 | JSON parseado; evidencia historica |
| investigacion/HABILIDADES_FORMACION.md (`investigacion/HABILIDADES_FORMACION.md`, referencia histórica no incluida) | 5593 | b8a36b82140c | Indice, secciones y referencias revisadas; antecedente/complemento |
| investigacion/MOVILIDAD_DATOS_RIESGOS.md (`investigacion/MOVILIDAD_DATOS_RIESGOS.md`, referencia histórica no incluida) | 6164 | 3169b5e4a9a7 | Indice, secciones y referencias revisadas; antecedente/complemento |
| investigacion/SINTESIS_ETAPA_1.md (`investigacion/SINTESIS_ETAPA_1.md`, referencia histórica no incluida) | 7257 | 7593f4c4f395 | Indice, secciones y referencias revisadas; antecedente/complemento |
| INVESTIGACION.md (`INVESTIGACION.md`, referencia histórica no incluida) | 3191 | 96d634373b58 | Indice, secciones y referencias revisadas; antecedente/complemento |
| [MAPEO_CASOS_AGENTES.md](MAPEO_CASOS_AGENTES.md) | 8191 | dc4dbd089eb3 | Reglas/contratos y secciones funcionales revisadas |
| [MODELO_DATOS_MODULOS_PROPUESTA.md](MODELO_DATOS_MODULOS_PROPUESTA.md) | 18600 | d4962cfa7050 | Reglas/contratos y secciones funcionales revisadas |
| OPINION_VERTEX_ARQUITECTURA_MAPEO.md (`OPINION_VERTEX_ARQUITECTURA_MAPEO.md`, referencia histórica no incluida) | 5240 | f7ecb8e8793d | Indice, secciones y referencias revisadas; antecedente/complemento |
| PLAN_FIGMA_DISENO_PLATAFORMA.md (`PLAN_FIGMA_DISENO_PLATAFORMA.md`, referencia histórica no incluida) | 11849 | 0185ccfb3d91 | Indice, secciones y referencias revisadas; antecedente/complemento |
| [PLAN_REDISENO_FIGMA_V2.md](PLAN_REDISENO_FIGMA_V2.md) | 4923 | 41923a7b5fc8 | Reglas/contratos y secciones funcionales revisadas |
| [PROPUESTA_NAVEGACION_FEED.md](PROPUESTA_NAVEGACION_FEED.md) | 9436 | aa2b06bec879 | Indice, secciones y referencias revisadas; antecedente/complemento |
| [README.md](../README.md) | 3971 | 0c09ac075681 | Indice, secciones y referencias revisadas; antecedente/complemento |
| [REGISTROS.md](REGISTROS.md) | 9599 | 4acd707823ad | Indice, secciones y referencias revisadas; antecedente/complemento |
| [REQUISITOS.md](REQUISITOS.md) | 8246 | 20717a235eac | Reglas/contratos y secciones funcionales revisadas |
| REVISION_BALTHASAR_CU_AGEN_DATOS.md (`REVISION_BALTHASAR_CU_AGEN_DATOS.md`, referencia histórica no incluida) | 5620 | 0e0a7fd71549 | Indice, secciones y referencias revisadas; antecedente/complemento |
| [REVISION_FIGMA_NAVEGACION_PROGRESO.md](REVISION_FIGMA_NAVEGACION_PROGRESO.md) | 3160 | 6fe33fd21562 | Indice, secciones y referencias revisadas; antecedente/complemento |
| [REVISION_INTEGRAL_PLAN.md](REVISION_INTEGRAL_PLAN.md) | 15078 | fa39ea7b03c2 | Reglas/contratos y secciones funcionales revisadas |
| [SUGERENCIA_DEFINICION_EQUIPO.md](SUGERENCIA_DEFINICION_EQUIPO.md) | 1638 | 3935cad39bcf | Indice, secciones y referencias revisadas; antecedente/complemento |
| [VALIDACION_REQUISITOS_CASOS_USO.md](VALIDACION_REQUISITOS_CASOS_USO.md) | 19190 | fe6bd1544a52 | Indice, secciones y referencias revisadas; antecedente/complemento |

## Verificación de esta entrega

- Dos skills creadas, con entradas locales tanto para Codex como para OpenCode: cuatro archivos SKILL.md. Las cuatro pasaron quick_validate.py; no se ejecutó un modelo para demostrar carga automática.
- Plan D0-D9 y referencias locales comprobados; CU01-CU17 cubiertos en bloques. CSV de bitácora y evals parseables, IDs de eval únicos y resultados sin ejecución conservados.
- Revisión de espacios con Git; comprobación adicional de nuevos documentos porque diff --check no cubre archivos sin seguimiento.
- Sin código de aplicación, instalación de stack, schema/migraciones, cambios Supabase, E2E/evals de producto, commit o push. La validación documental no demuestra funcionamiento del sistema.
