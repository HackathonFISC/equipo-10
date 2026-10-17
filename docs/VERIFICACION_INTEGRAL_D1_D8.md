# Verificación integral D1–D8 — 2026-10-17

**Dictamen: regresión existente aprobada; cierre D8 rechazado por fronteras no cubiertas por su suite original.** Este informe prevalece sobre una afirmación de cierre completo de D8. No se reparó código del producto durante esta revisión.

Resultados estructurados: [evals/verificacion_d1_d8.json](../evals/verificacion_d1_d8.json). HEAD de referencia `5e448e0`; se verificó el árbol de trabajo con cambios, no un commit final. La huella SHA256 del código, contratos, SQL, scripts y pruebas está en el JSON. Registros completos privados y pruebas adicionales generadas: `.local/verification-d1-d8/`, excluidos de Git.

## Ejecución y resultados

| Bloque | Resultado ejecutado ahora |
|---|---|
| Regresión API local D1–D8 | **267 PASS, 0 FAIL**, 24 conjuntos contando PDF offline |
| Esquema inicial PGlite | 30 PASS |
| Permisos/RLS iniciales PGlite | 15 PASS |
| Identidad en PGlite | 11 PASS |
| Navegador Edge, suite existente | **10 PASS**, 1.5 minutos |
| Typecheck | exit 0 |
| Build | exit 0; aviso de bundle aprox. 823 kB |
| Prisma validate | aprobado |
| D8: seis pruebas adicionales de frontera | **0 PASS, 6 FAIL**, aparte de la suite original de diez que sí pasa |
| Supabase: comprobación real de solo lectura | migración `202610170010_independent_orientation` pendiente |

Los conjuntos API se ejecutaron **secuencialmente**, sin limpiar bases en paralelo. Se comprobaron los contenedores y los fixtures que restringen su destino a localhost:55435/equipo10_d1_test y localhost:55445/aimpulsa_d7_test. Los scripts PGlite operan en memoria. La base remota no se reinició ni modificó.

El primer intento A03 offline agotó el timeout de preparación de 5 s. Con `--timeout 30000` pasan sus nueve pruebas; no se alteró código de A03. Access tenía una expectativa antigua: trataba 5 kB como mayor que el límite actual de 64 KiB. Se corrigió **solo el tamaño del fixture** y pasan las diez pruebas. Se hizo explícito traslado cero en el fixture live A05, coherente con la corrección previa que prohíbe asumirlo cuando falta. No se cambiaron las expectativas para ocultar fallos funcionales.

El navegador prueba registro/perfil, extracción asistida simulada, sesión, aislamiento, móvil/oscuro, recuperación, cursos/reserva/agenda y oportunidades/A03. Usa autenticación sintética. **No incluye una prueba propia de la UI D8, ni aceptación con cuentas reales Supabase, ni el recorrido completo reserva → finalización → certificado.** Las suites API D7 sí se reejecutaron con éxito. No sustituir estas distinciones por una declaración de E2E completo de todos los roles.

## Vertex real: resultados por modo

Se usaron entradas sintéticas, proveedor Vertex y configuración existente; no rotación de cuentas ni cambios de modelo/facturación.

| Agente/modo | Resultado |
|---|---|
| A01, mapa de temario | PASS, una propuesta; read_syllabus, read_competency_catalog, submit_syllabus_mapping |
| A02, perfil/fragmento de CV | PASS; escenario live 9, 7 aserciones, aprox. 8.65 s dentro del caso |
| A02, banco objetivo de curso | **TIMEOUT** a los 119627 ms; leyó mapa pero no terminó entrega; devolvió ASSESSMENT_GENERATION_FAILED recuperable, sin publicar banco |
| A03, explicación de comparación | PASS, 10 aserciones, 8.78 s de agente; read_comparison_trace, read_vacancy, evaluate_compatibility, submit_explanation |
| A05, explicación de ruta | PASS, 11 aserciones, 19.68 s de agente; leer_resultado, entregar_explicacion |
| A04 | No implementado; sigue aplazado por decisión de alcance D5/D6 |

Las pruebas individuales reales no son todavía una traza colaborativa de tres agentes de un mismo caso. El fallo del banco A02 tampoco significa que haya fallado el modo perfil: se verificaron por separado. No se repitió en bucle la generación fallida ni se fabricó una respuesta alternativa.

## Hallazgos reproducidos de D8

Se tomó la suite `tests/api/orientation-independent.test.ts` como fixture sintético y se añadieron seis pruebas locales sin alterar su código de producto. Las diez pruebas originales vuelven a pasar en ese mismo archivo generado. Los resultados negativos siguientes son independientes de la disponibilidad de Vertex.

### V01 — P1: revisión permite aprobación de logística PENDING

En `apps/api/src/modules/orientation/orientation.service.ts:710`, submitReview bloquea INVIABLE, pero no la logística desconocida. Con un plan PENDING, revisión APPROVED y versión correcta, la API responde **200**. Esperado por el plan D8: solicitar aclaración de condiciones esenciales antes de aprobarlas como verificadas. La aprobación humana no aporta automáticamente los datos faltantes ni cambia C01.

### V02 — P1: aprobar plan desactualizado y cambio de dependencia

En `orientation.service.ts:706` solo se compara el entero version del plan. Se reprodujeron **dos fallos separados**: marcar `LearningPlan.outdated=true` y aumentar la versión de la vacante objetivo después de solicitar acompañamiento. En ambos, submitReview devuelve **200 APPROVED**, en lugar de rechazar revisión obsoleta. Faltan comprobaciones de dependencias/versiones y estado actual, no solo que el cliente envíe expected_plan_version=1.

### V03 — P2: reintento duplica el dictamen

Enviar dos veces el mismo POST review con la misma Idempotency-Key produce **dos filas OrientationReview**. No basta que la solicitud inicial de acompañamiento sea idempotente: la revisión también es un efecto persistido. Revisar controller de review y `orientation.service.ts:715`; añadir unicidad/recibo y control transaccional sin duplicación.

### V04 — P1 para trazabilidad: revisión no registra evento de auditoría

Se midió AuditEvent antes y después de un dictamen válido: **cero eventos añadidos**. No se encontró escritura auditEvent en el servicio de orientación. Existen filas de revisión como historia funcional, pero no el evento correlacionado con actor, caso, objeto/versiones y efecto exigido por RGN12 y el plan de D8. La solicitud guarda recibo, lo que tampoco sustituye auditoría de todos los cambios.

### V05 — frontera de integración: origen de reserva ambiguo al omitir plan_id

Después de aprobar y revocar un acompañamiento, reservar esa edición **sin plan_id** devuelve **201**. La búsqueda de reserva en `reservations.service.ts:177–195` excluye REVOKED y REJECTED; con plan_id explícito, el código sí bloquea la revocación.

La prueba negativa esperó bloqueo y falló. Se debe distinguir una acción **originada en la ruta acompañada** de una **reserva independiente de catálogo**: esta última está permitida por el contrato D8. El resultado no autoriza bloquear todas las reservas independientes, ni demuestra intención maliciosa del usuario; demuestra que el origen de la acción no queda acreditado de forma consistente. Resolver ese contexto de servidor y cubrir ambos recorridos, preservando reservas ya confirmadas y replays legítimos.

Las seis pruebas fallidas son V01 (una), V02 (dos), V03 (una), V04 (una) y V05 (una). No se han probado exhaustivamente todas las carreras concurrentes de revocación/revisión; no se declara esa propiedad aprobada por inspeccionar RLS.

## Despliegue D8: no confundir salida de consola con verificación

`node scripts/deploy-d8.mjs --verify` devuelve exit 0 **sin ejecutar deploy**: el archivo exporta la función pero no tiene entrada CLI. Se reprodujo sin cargar configuración. Para consultar realmente Supabase se invocó la exportación deploy('--check') con configuración local, solo lectura: devolvió pendiente la migración010.

Además, el helper --verify comprueba pendientes del ledger, pero no contrasta sus checksums ni usa el resultado de tablas consultadas para exigir RLS/funciones/roles. No equivale al verificador runtime del lote D5–D7. Reparar el CLI y ampliar las comprobaciones antes de aplicar migración010 y afirmar que fue validada. En este turno **no se aplicó**.

## Paquete de entrega y alcance

- Texto y PDF con capa de texto siguen dentro; audio, fotos e imágenes quedan excluidos por instrucción humana. No se implementó OCR propio. Las pruebas negativas heredadas de formatos no admitidos no representan soporte de esos formatos.
- `evals/casos.csv` sigue con 20 casos diseñados y sin resultados consignados. El JSON de esta revisión registra **pruebas técnicas**, no se anuncia como el set de 15 evals semánticos. Falta gold, métricas y resultados de calidad, y evidencia correlacionada de tres agentes.
- README, metodología y diagramas requieren conciliar capacidades reales, A04 aplazado, ausencia de cálculo de tarifas/itinerarios de transporte y D8 condicionado. No repetir las cifras antiguas D1 para todo el esquema.
- Bitácora contiene aportes y pruebas de D8; añadir esta verificación y su rechazo de fronteras sin borrar la entrega histórica de Antigravity. No atribuir al humano correcciones hechas por IA.
- No se encontró PPT en el producto; el guion existe. No se produjo video, conforme a la decisión humana.
- No se observó final-24h ni se comprobó registro administrativo/ventana oficial. No se creó commit, push o tag.
- El inventario Git de archivos a incluir no mostró .env privados, ADC, node_modules, generated o .local. Esto es un control de rutas, **no una auditoría exhaustiva de secretos dentro de todos los contenidos**.
- No se realizó instalación limpia desde clon ni prueba multiinstancia de certificados privados locales.

## Qué reparar antes del cierre

1. Revisiones: vigencia real del plan/perfil/dependencias, aclaraciones de logística esencial y no eludir alertas.
2. Idempotencia, recibo/auditoría atómica de efectos de orientación; carreras revocación/revisión/reserva.
3. Contexto de reserva de ruta frente a reserva independiente, con pruebas de ambos caminos.
4. CLI y verificación de despliegue D8; solo después aplicar/verificar migración en el entorno que se vaya a demostrar.
5. A02 banco: reducir/aislar latencia y demostrar recuperación sin repetir escrituras ni prometer disponibilidad por un resultado anterior.
6. Ejecutar solo regresión afectada y fronteras fallidas tras corregir; no repetir toda D1–D8 sin cambios adicionales. Cerrar UI D8, autenticación real, evals y paquete documental según evidencia.

Estos hallazgos no invalidan los 267 PASS existentes; muestran por qué esos PASS no prueban los criterios que sus suites aún no incluyen.
