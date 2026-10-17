# API de registro/perfil y contrato A02 — v1

Especificación, no endpoints ejecutados. Alcance D1–D2/CU01/CU16; [diccionario, permisos y ciclo](CONTRATO_REGISTRO_PERFIL.md) son normativos para este contrato. IDs, nombres y rutas son decisiones de diseño implementables independientes del framework. [Aceptación y tareas](ACEPTACION_REGISTRO_PERFIL.md).

## 1. Identidad y convenciones

Prefijo `/api/v1`. Login, alta de credencial, verificación, recuperación y logout corresponden a Supabase Auth; no duplicarlos en API de dominio. API recibe sesión verificable, valida sujeto/expiración/emisor/audiencia según configuración D1 y usuario activo; nunca basta decodificar JWT. `/me` siempre deriva identidad del servidor. Cuenta candidata sin perfil recibe vista inicial, no 500 ni acceso de otro usuario.

JSON UTF-8; identificadores UUID opacos, tiempos UTC; errores y paths técnicos estables, mensajes humanos en español. Rechazar claves desconocidas en DTO de mutación, campos reservados, referencias ajenas y tamaños fuera de límite. No interpretar strings HTML ni instrucciones incrustadas. No retornar JWT, secretos, prompts completos o contenido crudo en errores/logs.

Respuesta de lectura individual: `{ "data": {...}, "request_id": "..." }`. Recursos mutables devuelven ETag opaco de servidor basado en revisión; **toda mutación sobre borrador exige If-Match**, no un número confiado al navegador. Crear borrador es excepción con idempotencia y unicidad de borrador activo. Revisión usada por una interpretación también se verifica al incorporar salida.

Toda operación POST con efecto o trabajo costoso exige `Idempotency-Key` string aleatorio 16–128 caracteres. Persistir asociación actor/operación/clave/hash del payload/recibo. Para D2, conservar deduplicación tanto como el objeto/recibo referenciado; no expirar la clave antes del efecto. PUT/PATCH con If-Match no generan duplicados; si se necesita recuperar su resultado tras timeout, reconsultar borrador y comparar revisión/contenido antes de reenviar. No reintentar escrituras a ciegas.

Recibo emitido solo por servidor: `{receipt_id, operation, resource_ref, revision_or_version, effect_status:"confirmed", recorded_at}`. `request_id` por HTTP, `case_id` y `run_id` correlacionan proceso; ninguno autoriza. Un 202 acepta trabajo de interpretación, no confirma su resultado ni una versión de perfil.

## 2. Rutas y resultados

| Método/ruta | Entrada | Resultado y controles |
|---|---|---|
| GET /me | Sesión | 200 usuario/contexto permitido; sin perfil devuelve profile=null. Preferencias propias; sin lista global |
| PUT /me/candidate-profile | `{}` | 201 crear perfil vacío o 200 devolver el existente. Unicidad owner. No crea borrador confirmado ni membresía |
| GET /me/candidate-profile | — | 200 perfil, versión actual proyectada al dueño, borrador/resume_step, pendientes; 404 si aún no existe |
| POST /me/candidate-profile/drafts | `{base_version_id:null|id}` + clave | 201 borrador desde versión actual o vacío si no hay versión. Repetición devuelve mismo; borrador ya activo compatible →200, base distinta →409. No copiar desde perfil ajeno ni versión obsoleta sin resolver conflicto |
| GET /me/candidate-profile/draft | — | 200 borrador y ETag; 404 si no hay activo |
| PATCH /me/candidate-profile/draft | `{section, values}` + If-Match | 200 borrador/revisión/ETag nuevos; sección explícita y campos allowlist. Campos omitidos se conservan; null solo donde permitido. Arrays presentes reemplazan la colección completa de esa sección, siempre atómica y bajo ETag; IDs existentes deben pertenecer al borrador |
| POST /me/candidate-profile/draft/section-reviews | `{section,decision:"reviewed"|"deferred"}` + If-Match + clave | 200 revisión registrada con recibo y nuevo ETag. Revisar no confirma perfil. Revisión de sección se invalida al editar sus datos; editar dato derivado en otra sección invalida también su revisión |
| POST /me/profile-sources | Multipart: kind + archivo, o JSON `{kind:"manual_text",text}` + clave | 201 fuente privada validada/recibida según formato; sin IA automática. Límite/correspondencia de contenido. Ref y estado, nunca ruta local o URL externa arbitraria |
| GET /me/profile-sources/{source_id} | — | 200 metadatos/extracción permitida. Endpoint /content con autorización para descargar original propio, sin URL pública permanente; contenido con tipo seguro y descarga, no ejecutar HTML |
| POST /me/profile-sources/{source_id}/withdrawals | `{reason?}` + clave | 200 retirado para futuros procesamientos y cancelación de pendientes; conservar versión histórica mínima según política. No prometer purga física inmediata ni retirar competencias de versión confirmada silenciosamente; ofrecer crear corrección |
| POST /me/profile-interpretation-grants | `{source_refs:[{id,version}],draft_revision,purpose:"profile_interpretation",provider:"vertex"}` + clave | 201 autorización propia exacta, aún sin ejecución. Frontend explica envío opcional al proveedor. Rechazar fuentes ajenas/no listas |
| POST /me/profile-interpretation-grants/{id}/revocations | `{}` + clave | 200 revocado, cancelar pendiente y bloquear incorporación tardía. Comprobar idempotencia. No recupera datos ya enviados |
| POST /me/profile-interpretations | `{draft_id,source_refs,grant_id,goal:"build_profile"|"clarify_profile"}` + If-Match + clave | 202 run con status queued y ref consultable, ligado a revisión exacta; no contacto arbitrario con proveedor ni payload de prompt elegido por cliente |
| GET /me/profile-interpretations/{run_id} | — | 200 estado/resultado A02 sanitizado, refs y sugerencias; queued/running/succeeded/failed/cancelled/stale. status técnico de ejecución distinto de agent-result/1.status |
| POST /me/candidate-profile/draft/suggestion-decisions | `{run_id:null|id,decisions:[{suggestion_id? ,claim_id?,decision:"accept"|"reject"|"defer",replacement_value?}]}` + If-Match + clave | 200 aplicar decisiones en lote atómico y recibo/ETag. replacement_value solo al aceptar corrección validada. Cada decisión identifica exactamente suggestion_id o claim_id: run_id obligatorio para sugerencia IA y null para claim manual. Comprobar fuente/revisión y grant cuando intervino IA; aceptar no demuestra competencia. No aceptar arbitrarias rutas de parche del LLM |
| POST /me/candidate-profile/draft/review-previews | `{}` + If-Match + clave | 201 preview_ref/digest/expires_at y snapshot revisable, propuestas excluidas y faltantes. No modifica contenido ni concede autorización; vence a los 15 min o con cambio de revisión/versión de fuente pertinente |
| POST /me/candidate-profile/confirmations | `{draft_id,preview_ref,acknowledge_partial:boolean}` + If-Match + clave | 201 nueva versión/recibo; confirmar contenido exacto validado y secciones revisadas/diferidas. Si partial, acknowledge_partial=true obligatorio; false no transforma datos ausentes en conocidos. Repetición idéntica →200 mismo recibo incluso si ya no hay borrador activo |
| GET /me/candidate-profile/versions/{version_id} | — | 200 snapshot propio inmutable y pendientes históricos; 404 si ajeno/inexistente |
| POST /me/candidate-profile/draft/discards | `{}` + If-Match + clave | 200 cerrar borrador activo, cancelar trabajo pendiente sobre él; no elimina versión confirmada ni finge borrado de fuentes |
| GET /me/profile-operations/{receipt_id} | — | 200 efecto propio consultable tras timeout; 404 sin revelar existencia ajena |
| GET /me/candidate-profile/activity?cursor=&limit= | Cursor opaco, limit 1–50, defecto20 | 200 eventos minimizados propios y next_cursor; orden estable timestamp/id. Nunca documentos crudos/razonamiento interno |

Catálogo consultable en D2: GET /catalogs/occupations y /catalogs/competencies, con sesión, q ≤100, limit1–50 y cursor; devolver ID/nombre/tipo/versión/alias contextual, sin datos personales. Leer catálogo no crea alias ni equivalencia global. Coincidencias ambiguas se muestran para aclaración.

`section` en PATCH: identity, experience, training, interests, competencies, availability, constraints. Cada values tiene allowlist del diccionario. `identity` solo display_name/headline, no credenciales. Arrays con IDs nuevos usan id ausente y el servidor los asigna; cliente no puede imponer UUID de otro objeto. Modificar competencies manualmente crea evidencia de declaración y deja vínculo pendiente de aceptación explícita, nunca verified_exercise. Los claims manuales propuestos se aceptan/rechazan/difieren mediante suggestion-decisions con claim_id, sin run/grant IA; se registra la revisión base. PATCH no acepta flags accepted/confirmed ni evidencia de verificación autodeclarada. training.status se deriva de fuentes válidas, no de una bandera enviada por cliente. Hacer PATCH no sustituye la acción final de confirmar.

El cliente puede reintentar la confirmación con misma clave aun después de cerrarse el borrador: servidor busca operación deduplicada autorizada **antes** de exigir existencia de borrador activo o ETag actual. Si no hay registro previo, exige ETag/preview vigentes. No devolver recibos cacheados sin revalidar identidad/propiedad.

## 3. Errores y recuperación

```json
{"error":{"code":"DRAFT_REVISION_CONFLICT","message":"El perfil cambió en otra pestaña. Revisa la versión guardada antes de continuar.","field_errors":[],"retryable":false},"request_id":"req-demo"}
```

| HTTP / código | Situación | Comportamiento |
|---|---|---|
| 400 INVALID_REQUEST | JSON/clave/tipo desconocido o intento de campo reservado | No guardar parcial; paths de error sin datos privados |
| 401 AUTH_REQUIRED | Ausencia/sesión inválida/caducada | Reautenticar; no confirmar en segundo plano ni volcar borrador a almacenamiento público |
| 403 OPERATION_NOT_ALLOWED | Usuario deshabilitado o acción no permitida sobre recurso propio | Explicar sin filtrar objetos ajenos |
| 404 RESOURCE_NOT_FOUND | Objeto ausente o ajeno | Misma forma de error, sin revelar propietario |
| 409 IDEMPOTENCY_KEY_REUSED | Misma clave, payload distinto | No ejecutar nuevo efecto |
| 409 STALE_SOURCE / STALE_INTERPRETATION / BASE_VERSION_CONFLICT | Versión ya no aplicable | Recargar/revisar; no aplicar propuesta a otra revisión |
| 412 DRAFT_REVISION_CONFLICT | If-Match no coincide | Conservar contenido actual; mostrar diferencias locales para reintroducción consciente |
| 428 PRECONDITION_REQUIRED | Falta If-Match | No mutar |
| 413 SOURCE_TOO_LARGE | Supera límite | Conservar borrador, ofrecer fuente menor/manual |
| 415 UNSUPPORTED_SOURCE | Formato no habilitado o firma incorrecta | No anunciar extracción |
| 422 VALIDATION_FAILED / REVIEW_REQUIRED / PROCESSING_GRANT_REQUIRED | Campo inválido, falta revisar/diferir o permiso IA | Retornar paths/requisitos pendientes; perfil parcial válido no se rechaza por desconocidos |
| 429 RATE_LIMITED | Límite por actor/operación | Retry-After; sin bucle automático ni rotación |
| 503 PROCESSING_UNAVAILABLE | Intérprete no disponible antes de aceptación de tarea | Manual disponible; generación no confirmada |

Fallo después de 202 se observa en run con código de error y recuperación; no convertirlo en 200 con habilidades inventadas. Si timeout de confirmación, UI muestra «verificando guardado», consulta recibo conocido o reenvía misma clave/cuerpo para recuperar resultado; jamás una clave nueva para el mismo intento incierto. Payload y traza no contienen claves del proveedor.

## 4. Contrato de servicios por capa

Firmas lógicas, no código generado:

- `IdentityService.requireActiveActor(session) -> ActorContext`: sujeto validado, AppUser y facultades calculadas en servidor.
- `CandidateService.getOwnProfile(actor) -> ProfileView`; `ensureOwnProfile(actor, key) -> Receipt`.
- `CandidateService.startDraft(actor, baseVersion, key) -> DraftWithETag`; `updateDraft(actor, etag, section, values) -> DraftWithETag`.
- `CandidateService.reviewSection(actor, etag, decision, key) -> Receipt`; `createPreview(actor, etag, key) -> Preview`.
- `CandidateService.decideSuggestions(actor, etag, decisions, key) -> Receipt`; `confirmProfile(actor, etag, preview, acknowledgePartial, key) -> VersionReceipt`.
- `DocumentService.createOwnSource(actor, input, key) -> SourceRef`; `readOwnSource(actor, sourceRef) -> AuthorizedSource`; `withdrawOwnSource(actor, sourceRef, key) -> Receipt`.
- `ProfileInterpretationService.authorize(actor, sourceVersions, draftRevision, key) -> Grant`; `revoke(actor, grant, key) -> Receipt`; `request(actor, etag, input, key) -> RunRef`; `getOwnRun(actor, id) -> RunView`.

Controller valida DTO/headers/sesión, servicio aplica reglas y permisos, Prisma implementa persistencia atómica/versionada. No repositorio genérico extra si solo replica Prisma. Auditoría, idempotencia y validación de propietario se ejecutan igual desde UI y herramientas IA. Fallo de auditoría crítica impide confirmación. Una interpretación lenta queda fuera de transacción y no bloquea edición del joven.

## 5. A02 modo perfil: entrada, salida y herramientas

Usar sobre común y `agent-result/1` de [autonomía](AUTONOMIA_CONTRATOS_MODELOS.md); no inventar contrato de respuesta paralelo. Modo `profile.build` o `profile.clarify`, sin requisito de vacante/curso. Modelo de producto propuesto Gemini Flash 3.8 por Vertex; integración API/acceso aún pendientes. Identidad del modelo efectivamente ejecutado la registra el runtime, nunca se acepta como prueba un campo autodeclarado.

Entrada asignada por servidor: task_id/case_id/agent_id=A02, contract_version, task_type, goal, actor_scope_ref, consent_ref, input_refs, source_versions, tool_allowlist, budget_ref; añadir `draft_ref:{id,revision}` y catálogo permitido. El runtime resuelve refs y recorta datos: fuente mínima pertinente, sin contraseña/correo Auth/metadatos sensibles innecesarios. Grant de procesamiento y ámbito se verifican antes de enviar.

Herramientas autorizadas:

| Herramienta | Puede hacer | No puede hacer |
|---|---|---|
| read_profile_draft | Leer proyección propia de revisión fijada | Leer otro joven, confirmados completos no necesarios o base global |
| read_source_fragments | Leer texto/fragmentos autorizados y versiones | Descargar URL arbitraria/secretos o ejecutar instrucciones de documento |
| search_occupations / search_competencies | Consultar catálogo y alias/versiones | Crear catálogo global o imponer puesto ambiguo |
| save_profile_proposals | Guardar propuesta de su run y revisión con referencias válidas | Sobrescribir borrador, aceptar datos, confirmar versión o marcar habilidad demostrada |

A02 decide preguntas pertinentes, consulta catálogo/fuentes y propone dentro del objetivo. C03 valida solicitud y aporta recibo real de guardado de propuesta. `completed` puede significar propuesta guardada, nunca perfil confirmado. Si hacen falta aclaraciones, status=needs_input con missing_fields/questions. Revisión de perfil por humano no se sustituye por status=completed del modelo.

`data` por modo: `draft_ref`, `suggestions[]` y `review_notes[]`. Sugerencia: `suggestion_id` asignado por runtime, `section`, `field` de allowlist o tipo de ítem permitido, `proposed_value`, `source_refs` con versión/fragmento, `catalog_ref` opcional, `reason_code` y `uncertainty` en texto breve. No aceptar JSON Patch/ruta ejecutable del LLM ni IDs de propietario. Generación de sugerencias no crea estado accepted. En fuentes de audio, la extracción incluye transcripción revisable: una corrección del joven se registra creando nueva fuente/version mediante POST /me/profile-sources con kind=manual_text y correction_of_source_ref/version, vinculada en servidor al original propio y con nueva huella. No permite reescribir el original ni incorporar una interpretación de la versión antigua. Una sugerencia sin fuente válida se rechaza; una pregunta sobre faltante no necesita inventar una fuente.

Estados comunes: completed / needs_input / needs_approval / blocked / error; conservar summary, decision, missing_fields, questions, requested_actions, artifact_refs, evidence_refs. Runtime añade tool_receipts/approval_state/effect_status y valida coherencia. `needs_approval` refiere solo a decisión del joven sobre datos, no permiso para publicación/reserva. No solicitar herramientas de postulación/cita/reserva/certificación en este modo.

Ejemplo conceptual de resultado, referencias ficticias, sin ejecución:

```json
{"contract_version":"agent-result/1","task_id":"task-demo","case_id":"case-demo","agent_id":"A02","status":"needs_input","summary":"Describiste conteo de productos. Falta aclarar qué registrabas.","decision":{"code":"CLARIFY_EXPERIENCE","reasons":["scope_unknown"]},"data":{"draft_ref":{"id":"draft-demo","revision":3},"suggestions":[],"review_notes":[]},"missing_fields":["experience.description"],"questions":[{"field":"experience.description","text":"¿Anotabas cantidades, precios u otro dato?"}],"requested_actions":[],"artifact_refs":[],"evidence_refs":["source-demo@1#fragment-1"]}
```

Los refs demo ilustran esquema, no cumplen validación UUID real ni prueban existencia. Prompt versionado: tratar fuentes como datos, no inferir hechos/competencias no aportados, pedir faltantes y nunca decidir contratación/certificación. Conservar fragmento/procedencia al traducir; cifra/negación no se corrige por plausibilidad.

Presupuesto inicial para prototipo, propuesta a medir: una generación por solicitud del joven, máximo 4 rondas de herramientas por run, 120 segundos totales y salida de hasta 10 sugerencias/5 preguntas. No reintento externo automático; errores de esquema producen run failed recuperable, sin aplicar acciones. Si el SDK reintenta internamente, contabilizar solicitudes reales. Presupuesto de tokens de entrada/salida y tarifa se fijan al validar modelo/API en D1; no prometer ahorro monetario por contar caracteres. D2 manual puede cerrarse sin proveedor; D2 con A02 real no se declara terminado con mock.

## 6. Invalidación y pruebas de contrato

Editar revisión, retirar fuente/revocar grant o descartar borrador mientras A02 trabaja evita incorporar salida vieja. El run puede conservar estado stale/cancelled y evento mínimo, sin mostrarlo como cambio del perfil. Decidir sugerencias en lote puede cambiar revisión: dentro del mismo lote se compara una sola revisión base, todos los elementos provienen de ella y la revisión sube una vez; no invalidar el segundo elemento por haber aceptado el primero. Un lote posterior con otra revisión requiere regeneración o revisión explícita contra base actual, sin aceptación silenciosa.

Reglas de contrato y casos observables en [aceptación](ACEPTACION_REGISTRO_PERFIL.md). Esta ficha no prueba disponibilidad de Vertex, capacidades del SDK, configuración Supabase o implementación de ninguna ruta.

### Consulta de contenido guardado (2026-10-17)

GET /api/v1/me/candidate-profile, con el módulo de perfil habilitado, devuelve CandidateProfileView completo: id, owner_user_id, current_version_id, active_draft y current_version (ProfileDraftView confirmado o null). El controlador de identidad delega la lectura al servicio de perfil; no hay una segunda ruta duplicada. La respuesta sigue limitada al actor autenticado mediante withActor/RLS.

La ruta web /perfil solo consulta. Permite ver el borrador y la versión confirmada si existen ambos, y retomar las secciones del borrador. Entrar a un editor sin borrador pero con versión confirmada redirige a esta consulta; no inicia otro borrador vacío. La actualización de una versión confirmada mediante copia a una nueva revisión sigue pendiente de un bloque específico.
