# Revisión de pendientes para entregar AImpulsa

Fecha: 2026-10-17. Revisor: Codex. Commit revisado: 509a2b69fa4839e1a805efe794b6505f1942e425.
Resultado: **pendiente completar evidencias y paquete de entrega**; no se declara rechazo funcional de D8 ni aprobación final de todos los requisitos.

## Alcance y fuentes

Se contrastaron el enunciado RETO_OFICIAL.md aportado por el equipo (§§2, 5, 6 y 7), [requisitos](REQUISITOS.md), [entregables](ENTREGABLES.md), catálogo/especificaciones CU, documentos de agentes/autonomía, guion, bitácora y resultados disponibles. Se inspeccionaron los enlaces locales de los 69 Markdown versionados. No se ejecutaron pruebas de aplicación, llamadas Vertex, cambios de BD, commits ni push en esta revisión.

Se consultó GitHub mediante git ls-remote: main remoto apunta a 509a2b6. No devolvió refs/tags/final-24h. La copia D7 permanece como respaldo; el desarrollo integrado está en main.

## Lo que ya existe

- Software integrado D1–D8 dentro de los límites declarados: joven, empresa reducida, centro y orientador independiente.
- Reglas determinísticas, consentimientos, efectos persistentes, recibos y pruebas técnicas documentadas.
- README, diagrama, metodología, bitácora, CU y especificaciones.
- Código de producto subido a main en GitHub.
- Migración D8 aplicada y verificada en Supabase según [cierre ejecutado](CIERRE_MIGRACIONES_REPOSITORIO.md); no volver a tratarla como pendiente.
- Casos de prueba técnicos y algunos resultados reales Vertex separados. Estos antecedentes no equivalen automáticamente a aceptación del commit final ni a colaboración correlacionada.

## Comprobación adicional live

A02 perfil agotó 120 segundos en el intento final; 0 PASS / 1 FAIL, etapa no atribuida. [Resultado](../evals/vertex-a02.json). No se transforma en PASS ni se oculta por cumplir el mínimo numérico del set offline. Sigue pendiente comprobar estabilidad live para la demo.

## Actualización de evals finales

Set final ejecutado: [37/37 casos PASS y 94 pruebas sin fallos](../evals/README.md). El CSV vigente contiene F01–F37; E01–E20 se conserva como diseño inicial. Las observaciones siguientes que describían el CSV sin resultados corresponden a la revisión anterior. La evidencia de tres agentes y los otros pendientes no se consideran cerrados por este set.

## Prioridades de cierre

| Prioridad | Pendiente | Por qué importa | Evidencia para cerrarlo |
|---|---|---|---|
| P0 | Flujo de mínimo tres agentes colaborando en un mismo caso | Requisito obligatorio §2.1 y diseño agéntico 25% | IDs/versiones, qué resultado produjo cada agente, qué consumió el siguiente, herramientas observadas, confirmaciones y efecto final. No juntar ejecuciones inconexas ni contar asistentes de desarrollo. |
| Completado | Publicar al menos 15 evals propios ejecutados | Requisito obligatorio §2.6, entregable §6 y robustez 15% | Entradas/fixtures, esperado, métrica, resultado observado, fecha, versión y comando. El CSV actual conserva 20 DISEÑADO_NO_EJECUTADO; resultado_real y evidencia vacíos. |
| P1 | Ensayar demo de punta a punta con cuentas reales de los cuatro roles | Funcionamiento en vivo 20% | Joven confirma perfil; empresa publica y consulta candidatura consentida; centro publica formación; joven reserva; orientador revisa acceso autorizado. Mostrar recarga/recibo y un intento bloqueado. Puede ser un recorrido acotado; no hace falta enseñar todos los CU. |
| P1 | Probar instalación desde clon y provisionar acceso de demo | README/ejecución exigidos §6 | Pasos suficientes y probados, variables de ejemplo, BD con permisos y usuarios/membresías habilitados. No publicar claves de infraestructura. Entregar acceso al jurado por canal acordado; fixtures Auth sintéticos no son cuentas reales Supabase. |
| Resuelto documentalmente | Conciliar documentación de cierre | Presentación/bitácora 10% y reproducibilidad | Estados, referencias y notas históricas conciliados; ver ESTADO_ACTUAL.md. No cierra pruebas, evals ni aceptación funcional. |
| P1 | Preparar PPT, ensayo y cierre administrativo | Presentación, entrega y congelamiento §6 | Archivo PPT real, guion ensayado, registro del repositorio y ventana oficial confirmados; tag final-24h sobre el SHA válido cuando corresponda, sin retrofechar. |

### Evals: evitar trabajo innecesario

El enunciado exige **15 casos con métricas y resultados**; no exige que sean 15 llamadas reales al modelo ni prescribe una herramienta de eval concreta. Se pueden combinar casos de reglas, permisos, concurrencia, guardrails y calidad de extracción/explicación. Reutilizar suites existentes cuando prueben exactamente el caso, ejecutarlas en entorno aislado y mapear resultado a requisito. No renombrar 15 pruebas al azar como si cubrieran todo.

Incluir datos incompletos, sin CV, extracción texto/PDF, fuente maliciosa o fuera de alcance, discriminación, contrafactuales, salario/horario/traslado, cupo, consentimiento, idempotencia y trazabilidad. Definir esperado antes de evaluar salidas del modelo. Distinguir el comportamiento con respuestas simuladas de la ejecución real Vertex.

E15 combina formatos históricos y E16/E20 contienen funciones excluidas o aplazadas: no marcarlos PASS. Conservar el registro histórico, señalar no aplicable al alcance y definir casos vigentes suficientes para alcanzar el mínimo. No reabrir audio, fotografías ni OCR propio por esta revisión.

El archivo [verificacion_d1_d8.json](../evals/verificacion_d1_d8.json) conserva un snapshot anterior con verdict REJECT_D8_CLOSURE y HEAD 5e448e0. Mantenerlo como histórico; añadir un resumen posterior enlazado al cierre de D8 y al SHA entregado, sin modificar retrospectivamente los resultados.

### Tres agentes: evidencia de colaboración

Una historia viable a preparar es A02 perfil confirmado → A01 vacante confirmada → A03 comparación/explicación, seguida de acción consentida y recibo. A05 puede añadirse si usa los mismos objetos. El intercambio actual es mediante servicios y artefactos versionados: demostrar las referencias y herramientas reales, sin afirmar mensajes directos ni un bus inexistente.

No basta escribir los nombres en el PPT. Si la ejecución revela que no existe dependencia/comunicación comprobable suficiente para el requisito, corregir la coordinación mínima o consultar el criterio organizador; no simularla en un informe.

### Demo y fiabilidad del modelo

La revisión integral anterior registró timeout de A02 en generación de banco. La existencia de reintentos seguros no prueba generación exitosa. Si ese paso se mostrará en vivo, comprobarlo antes con contenido sintético breve o utilizar un banco ya revisado, declarando que se preparó antes. Un fallback de código debe identificarse como tal.

La aprobación del helper de BD no demuestra por sí sola login/roles, notificaciones, toda la interfaz ni interacción entre perfiles en Supabase.

## Hallazgos documentales iniciales — atendidos en la conciliación posterior

- [CASOS_DE_USO.md](CASOS_DE_USO.md) mantiene CU12/CU14 con el fallo de reserva independiente y verificación remota pendientes; hay que actualizar también las notas equivalentes de especificaciones.
- [COLABORACION_AGENTES.md](COLABORACION_AGENTES.md), [GUIA_PRESENTACION_Y_EVIDENCIAS.md](GUIA_PRESENTACION_Y_EVIDENCIAS.md) y [DEMO_PPT_DISENO.md](DEMO_PPT_DISENO.md) todavía mencionan la observación D8 como pendiente.
- [REQUISITOS.md](REQUISITOS.md) conserva todos los O01–O08 en Pendiente y decisiones técnicas ya tomadas como abiertas. No usar esa tabla literalmente para concluir que nada se implementó; actualizar con evidencia por obligación.
- El chequeo de 386 referencias locales en 69 Markdown detectó **36 apariciones de enlaces cuyos destinos no están versionados**, incluidos archivos internos excluidos y documentos históricos ausentes. Ejemplos: ENTREGA_FIGMA_V1.md, PLAN_FIGMA_DISENO_PLATAFORMA.md, ANALISIS_IDEAS.md y guías internas ignoradas. Resolver por documento público equivalente o referencia histórica sin enlace engañoso; no subir MAGI o secretos para arreglar un enlace. El detalle de trabajo se conserva localmente fuera de la entrega.

Las referencias anteriores describen los hallazgos de la revisión inicial. La conciliación documental posterior los atendió: ver [ESTADO_ACTUAL.md](ESTADO_ACTUAL.md). Se conservan aquí como historial del diagnóstico; no son defectos de ejecución ni pendientes actuales por sí solos.

## Límites funcionales que afectan la defensa, sin ampliar ahora el alcance

- La comparación candidato/vacante no acredita un solver global de asignación con capacidades entre todas las personas y puestos; el enunciado lo incluye entre funciones sugeridas. Explicar el alcance implementado y la diferencia con el cupo formativo transaccional.
- La logística usa datos/estimaciones declarados; no hay integración automática de rutas/tarifas MiBus/Metro ni validación general del salario mínimo legal.
- Catálogo acotado y datos DEMO; las fuentes investigadas no son integraciones nacionales ni evidencia de impacto medido con usuarios reales.
- A04, CV/carta adaptados, entrevista simulada, agenda laboral bilateral y tendencias están aplazados. La lista de siete funciones del §5.4 es sugerida; el mínimo obligatorio común de agentes es tres. No presentar esas funciones como terminadas ni abrirlas para sustituir el cierre pendiente.
- Despliegue público en Netlify no es requisito identificado; una demo local operativa puede cubrir el funcionamiento. No añadir ese riesgo si no lo necesita el equipo.

El video aparece en el enunciado original, pero el equipo lo descartó explícitamente y eligió demo/PPT. No producir video dentro de este plan; confirmar administrativamente la aceptación de esa sustitución sin afirmar que ya se concedió.

## Orden recomendado

1. Preparar cuentas y un caso sintético único; demostrar tres agentes, aprobación y acción real.
2. Ejecutar y registrar el set de 15 o más evals reutilizando evidencia válida de suites existentes.
3. Conciliación de estados y enlaces realizada; mantenerla al incorporar resultados nuevos y asociarlos a su versión.
4. Ensayar demo, comprobar instalación/acceso y terminar PPT.
5. Confirmar registro/ventana, actualizar paquete en GitHub y congelar el commit correcto cuando corresponda.

Priorizar impacto (30%), diseño agéntico (25%), funcionamiento (20%), robustez (15%) y transparencia (10%). Tener más pantallas no reemplaza estas evidencias.
