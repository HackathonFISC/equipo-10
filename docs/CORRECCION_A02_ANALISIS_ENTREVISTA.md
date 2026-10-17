# Corrección A02: análisis visible y entrevista — 2026-10-17

Solicitud: resolver panel vacío, mostrar procesamiento y evitar solicitudes repetidas; completar la interacción de preguntas del agente de perfil. Autor de esta corrección: Codex, modelo no registrado, sobre la implementación de Antigravity. No se atribuye esta corrección a Gemini desarrollador.

## Causa y cambios

- El bucle de herramientas devolvía `succeeded` con listas vacías al agotarse. Ahora exige un resultado con propuestas o preguntas; ausencia de resultado, agotamiento y referencias no autorizadas producen error recuperable, sin inventar análisis ni completar referencias automáticamente.
- La llamada usa herramientas explícitas, lee fuentes/borrador antes de entregar, dispone de seis rondas y un presupuesto total de 120 segundos. El esquema de `proposed_value` declara sus campos; la respuesta final se valida con el contrato compartido.
- La configuración predeterminada vuelve a `gemini-3.8-flash`, proyecto resuelto `magi-511816`, región `global`; se corrige el host global. Las variables explícitas de configuración siguen teniendo prioridad. El frontend ya no afirma un modelo distinto al realmente configurable.
- Diálogo con etapas visibles, indicador animado con alternativa de movimiento reducido, `aria-busy`, aviso de espera y bloqueo inmediato por referencia de la solicitud. Durante el procesamiento se deshabilitan envío, pestañas y cierre.
- El visor distingue análisis sin propuestas, preguntas de entrevista y datos faltantes. Permite responder las preguntas y solicitar `clarify_profile`: crea una nueva fuente de respuestas y un nuevo permiso sobre las referencias originales y nuevas, conservando sus versiones. No incorpora nada automáticamente.
- Las decisiones empiezan diferidas; desaparece el porcentaje de confianza presentado como medida objetiva. El botón no permite aplicar listas vacías. PDF digital y texto son los formatos anunciados; no se ofrece OCR/audio aún no disponibles.

## Verificación ejecutada

- `bun test tests/api --test-name-pattern "^(?!.*Escenario 9)"`: 84 PASS, 377 expectativas, 1 prueba externa filtrada; PostgreSQL aislado y proveedor simulado donde corresponde.
- `bun test tests/api/d2-pdf-a02-verification.test.ts --test-name-pattern "Escenario 9"`: 1 PASS con Vertex real, después de restablecer 3.8/global; siete expectativas, incluidas propuestas o preguntas no vacías. Fuente sintética, no el CV personal del usuario.
- Configuración de aplicación comprobada sin imprimir credenciales: `gemini-3.8-flash`, `global`, `magi-511816`, ADC disponible.
- `bun run test:e2e`: 7 PASS en Edge; prueba nueva mantiene una respuesta pendiente, verifica bloqueos y una sola solicitud, responde entrevista y comprueba que el segundo análisis conserva ambas referencias. El proveedor está interceptado en esta prueba de navegador; se distingue de la prueba real anterior.
- `bun run typecheck` y `bun run build`: exit 0. Persiste aviso no bloqueante de tamaño del bundle y advertencia previa de pg sobre consultas concurrentes.

## Alcance y límites

No se alteraron datos personales, esquema o permisos remotos; sin commit/push. No se declara terminada toda la aceptación de D2 ni evaluada la calidad de todos los CV. Un resultado vacío guardado antes de esta corrección no se convierte en análisis retroactivamente: volver a solicitarlo desde la aplicación. Los resultados no persisten en la vista tras recargar (comportamiento previo); las fuentes y ejecuciones se mantienen en backend.
