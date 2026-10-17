# Revisión por bloques de D2 — 2026-10-17

Revisor: Codex, modelo no registrado. Alcance acotado a integración, permisos, A02, formatos y evidencia; no auditoría exhaustiva archivo por archivo. Sin cambios en la implementación ni pruebas contra Supabase remoto. Los archivos podían seguir siendo editados por Antigravity durante la revisión.

## Veredicto

No cerrar D2 todavía. Hay implementación manual sustancial, pero D2-B y D2-C contienen simulaciones en la ruta de producto y falla la validación E2E actual.

## Evidencia ejecutada

- `bun run typecheck`: exit 0.
- `bun run test:api`: 71 PASS, 329 expectativas, exit 0; PostgreSQL Docker aislado y autenticación de prueba. Esto no demuestra invocación real de Vertex ni OCR/transcripción.
- `bun run test:e2e`: 4 PASS / 2 FAIL, exit 1. Fallan access.spec.ts:36 (texto previo de Inicio) y profile-flow.spec.ts:15 (no aparece pantalla Cuenta).
- No se repitió build ni se verificó fidelidad visual contra Figma en esta revisión.

## Hallazgos que corregir

1. **P1 — Sustitución silenciosa de Vertex y datos inventados.** `apps/api/src/modules/profile/agent-a02.service.ts:37–67`: exige GOOGLE_APPLICATION_CREDENTIALS pero no lo usa para obtener un token; envía VERTEX_BEARER_TOKEN o cadena vacía. Con location global construye global-aiplatform.googleapis.com en vez del endpoint global aiplatform.googleapis.com. Ausencia/error de proveedor termina en extractor sintético exitoso. El extractor fija fechas 2024-01/2024-06 sin evidencia. Usar ADC real, endpoint correcto, tiempo límite y fallo recuperable; fixture solo por inyección explícita de pruebas. Demostrar ejecución real y mantener alternativa manual.

2. **P1 — Imagen/audio no se interpretan; PDF no tiene parser fiable.** `multimodal-parser.service.ts:91,144–153,201–204`: imagen devuelve descripción fija y audio texto fijo con duración de 15 segundos. PDF intenta regex sobre bytes, no procesa streams comprimidos y puede sustituir extracción por frase genérica. Un encabezado válido no demuestra archivo válido ni extracción. Implementar parsers/OCR/transcripción reales con fixtures gold o mantener cada formato deshabilitado con error recuperable; nunca marcar texto inventado como extracción.

3. **P1 — Consentimiento no protege todo el ciclo de interpretación.** `profile.service.ts:2170–2220,2337–2344`: valida revisión del grant, pero toma source_refs de la solicitud sin compararlos con el conjunto/versiones autorizados; no vuelve a comprobar estado retirado al recoger fragmentos. Tras la llamada no revalida revocación ni revisión antes de persistir éxito; al aplicar sugerencias solo comprueba revisión del borrador. Caso concreto: autorizar fuente A y pedir B propia con el mismo grant, o revocar después del run y aceptar sus propuestas, no queda bloqueado por esos controles. Validar conjunto/versiones/estado al enviar, al guardar y al incorporar; conservar vínculo run–grant–fuentes y probar revocación tardía.

4. **P1 — El E2E de D2 no tiene backend de perfil conectado.** `tests/support/e2e-server.ts:17–23` crea createApp sin profileService, mientras `apps/api/src/app.ts:115–116` monta sus rutas solo cuando se proporciona. El recorrido nuevo falla antes de Cuenta. Conectar ProfileService real al fixture; actualizar la expectativa histórica de Inicio sin debilitar la comprobación funcional; repetir los seis recorridos.

5. **P2 — Original de archivo no persistido.** `profile.service.ts:1675–1686` fabrica storageKey y crea fuente READY, pero la ruta de ingestión no guarda el buffer en almacenamiento privado. Tras reiniciar no se puede recuperar el original indicado por esa referencia. Persistir el original privado con autorización de descarga y política de conservación, o no declarar ingestión completa.

## Orden de corrección

Primero quitar éxitos sintéticos de producto y cerrar controles de consentimiento. Luego conectar E2E y verificar recorrido manual completo. Habilitar cada formato solo con extracción real comprobada, conservación privada y pruebas de error. Actualizar el estado de PLAN_EJECUCION_D2 y bitácora según ejecución real; no contar pruebas con fixtures como evals de agente real. Revisar de nuevo la versión final que entregue Antigravity.
