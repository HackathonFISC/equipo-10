# D7 — Centro: entrega paralela para integrar

> Actualización posterior: consultar `D7_NUCLEO_VERIFICADO.md`. Certificados privados y banco objetivo con diagnóstico ya se implementaron y verificaron localmente; los pendientes de esas funciones que siguen abajo describen el primer corte histórico.

Fecha: 2026-10-17. Estado: A y finalización de B implementados y verificados localmente; **D7 completo pendiente**.

Ubicación: `../equipo-10-d7`, rama `codex/d7-centros`. La carpeta habitual `../equipo-10` sigue siendo la de Gemini. No se modificó esa carpeta, no hubo despliegue Supabase ni commit/push. La copia inicial incluye cambios anteriores sin commit de D3/D4/D5/D6: NO integrar toda la rama ni copiarla completa.

## Recorrido implementado

Cuenta invitada TRAINING_MANAGER o ADMIN de TRAINING_CENTER activo: Mi centro → crear borrador privado → escribir temario → consentir envío a Vertex → A01 consulta fuente y catálogo → responder aclaraciones → revisar habilidades y citas → guardar avance → preparar edición y sesiones → confirmar publicación inicial. Usa las tablas y el catálogo de D4. El joven encuentra el curso en Cursos.

Guardar avance persiste temario, aclaraciones, propuestas y selección en `TrainingCourseWorkspace`; se recuperan al reabrir. Fechas, precio y horario se guardan al publicar, indicado en pantalla. Reintentos llevan clave idempotente; edición concurrente del borrador exige recarga ante 409. La publicación registra fuente/citas, versión, mapa revisado y recibo atómicos. Vertex se ejecuta fuera de transacciones de BD y no existe fallback que simule IA.

Centro → Participantes propios → registrar completado/no completado, fecha, motivo y confirmación. Reserva cancelada o ajena no permite finalización. Resultado, recibo y auditoría son atómicos e inmutables. El joven consulta sus resultados en Cursos. Esto no acredita habilidades ni cambia cupos o historial de reservas.

## Evidencia ejecutada

- `bun test tests/api/training-center.test.ts --timeout 10000`: **8 PASS, 0 FAIL**, 40 aserciones. Incluye permisos, borrador privado, reintento, persistencia/reapertura del avance, citas, catálogo, fecha inválida, solape, versión obsoleta y publicación concurrente visible por D4.
- `bun test tests/api/training-participants.test.ts --timeout 10000`: **9 PASS, 0 FAIL**, 36 aserciones. Incluye aislamiento, resultado propio, cancelación/fechas, replay concurrente, revocación y rollback por fallo de auditoría inducido. El error de BD impreso por este último caso es esperado.
- `bun --env-file=../equipo-10/.env scripts/verify-d7-vertex.ts`: **PASS real** con Gemini 3.8 Flash por Vertex. Herramientas observadas: read_syllabus, read_competency_catalog, submit_syllabus_mapping. Una propuesta respaldada por fuente sintética. No se envió CV ni dato personal real ni se copiaron credenciales.
- Playwright CLI, `tests/support/d7-browser-check.js`: **PASS** crear → analizar → guardar → reabrir propuestas → publicar → consultar catálogo. API/BD reales locales; análisis inyectado y sintético en esta prueba. Captura `output/playwright/d7-cursos.png` inspeccionada. Se corrigió después el formato UTC de la fecha del catálogo, que mostraba un día anterior, y una descripción que afirmaba certificación no comprobada.
- `bun run build`: PASS. Aviso de bundle de aproximadamente 564 kB; no impide compilación.
- `bun run typecheck`: falla por siete errores de la copia inicial de recruitment; ningún diagnóstico en D7. Revisar los cambios más recientes de Gemini antes de integrar. Los errores son getConfig inexistente, authorUserId, claimLinks, tres comparaciones de EvidenceKind y competency_kind faltante.
- Algunos matchers `.rejects` de Bun se bloquearon en pruebas con Prisma. Se sustituyeron por captura explícita de excepción y las mismas aserciones; ambas suites completas pasaron. No se cambió el servicio para ocultar el fallo. Concurrencia de creación de borrador no queda certificada por la suite final; sí la publicación y finalización.

BD exclusiva de pruebas: contenedor `aimpulsa-d7-isolated`, puerto local55445, base `aimpulsa_d7_test`. No se usó/resetó la BD55435 de Gemini. Las suites reinicializan el esquema SOLO en esa base; ejecutarlas una por vez. Preview sintético usa API55447/Auth55448/web5177. Las credenciales fijas de estos fixtures son únicamente locales y sintéticas.

## Integración selectiva

Copiar como archivos nuevos propios de D7:

- `apps/api/src/modules/training-center/*`, `training-participants/*`.
- `apps/web/src/features/training-center/*`.
- `packages/contracts/src/training-center.ts`, `training-participants.ts`.
- Migraciones004 training_center_access,005 training_completion y006 training_workspace. Comprobar colisión de nombres/orden con las de Gemini antes de aplicar.
- Tests API homónimos, fixture `tests/support/training-center-database-fixture.ts` y scripts de preview/verificación solo si se desean conservar como herramientas de desarrollo.

Integrar manualmente estas modificaciones pequeñas sobre la versión MÁS RECIENTE de Gemini:

1. `packages/contracts/src/index.ts`: dos exports de los contratos nuevos.
2. `apps/api/src/app.ts`: dependencias opcionales trainingCenterService/trainingParticipantsService y montaje de sus módulos dentro del router autenticado.
3. `apps/api/src/server.ts`: instanciar ambos servicios con db.
4. `apps/web/src/app/App.tsx`: ruta `/centro`, import y enlace Mi centro condicionado a membresía válida. El servidor vuelve a comprobar permisos.
5. `apps/web/src/features/courses/CoursesPage.tsx`: panel de resultados propios, fechas UTC y descripción sin acreditaciones ficticias.
6. `tests/support/auth-fixture.ts`: parámetro opcional extraOrigins, solo para preview5177. No es configuración de producción.

No copiar `.env`, `generated`, `node_modules`, `node_modules-shared`, dist, capturas/logs completos ni cambios de recruitment. No regenerar Prisma desde este esquema antiguo:005/006 usan SQL parametrizado intencionalmente para no modificar el cliente compartido durante trabajo paralelo. Al reconciliar schema.prisma, añadir las dos tablas conforme a migraciones y regenerar solo después de incorporar el esquema final de Gemini.

Antes de activar en Supabase: preparar despliegue incremental check/apply/verify sobre la BD existente, verificar las tres migraciones y consultas con rol runtime real, y asignar membresías demo controladas. No basta con copiar UI para evitar P2021. Ese despliegue **no se ejecutó**.

## Pendientes explícitos

- Certificados PDF existentes en almacenamiento privado, autorización de descarga y adjunto opcional. La interfaz informa que aún no hay adjunto; no crea certificados.
- A02: banco de preguntas/rúbricas desde mapa confirmado, revisión del centro, intento consentido del joven, corrección C01 y evidencia limitada al ejercicio.
- Nuevas versiones/ediciones de cursos ya publicados y correcciones de finalización con historial. Esta entrega conserva lo publicado y no lo sobrescribe.
- E2E conjunto joven reserva → centro finaliza → joven consulta resultado. Los servicios de participantes y consulta sí están cubiertos por pruebas de BD, pero no se recorrió esa secuencia completa en navegador.
- Integración con la entrega final de D5/D6 y typecheck global limpio; activación Supabase y prueba con autenticación real.

Autoría: decisiones de producto/dirección visual aprobadas por humanos en la conversación; implementación y revisión cruzada D7 por Codex y subagentes Codex. Gemini participó en la prueba real del agente A01 del producto por Vertex; no atribuirle la escritura de este código D7. No se confirmaron ediciones humanas manuales de estos archivos.
