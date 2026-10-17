# Registro y perfil del joven — contrato funcional y de datos v1

> **Diseño/plan de su etapa — conciliación 2026-10-17:** los pasos futuros y alternativas siguientes conservan su contexto original; no son una lista de todo lo que falta hoy. Implementación y pendientes vigentes en [ESTADO_ACTUAL.md](ESTADO_ACTUAL.md) y [cobertura CU](CASOS_DE_USO.md#cobertura-actual-por-caso). Los casos diseñados no se presentan como ejecutados.

Fecha: 2026-10-16. Bloque D0-01, preparación de D1–D2. Especificación técnica definida para implementar; sin aplicación, esquema físico, migraciones ni pruebas funcionales ejecutadas. Las elecciones de este documento son concreciones de diseño, no declaraciones de nuevas aprobaciones humanas.

Fuentes: [CU01 y RGN01–RGN14](ESPECIFICACION_CASOS_USO.md), [modelo lógico](MODELO_DATOS_MODULOS_PROPUESTA.md), [catálogos](CATALOGOS_CURSOS_PUESTOS_HABILIDADES.md), [autonomía A02](AUTONOMIA_CONTRATOS_MODELOS.md), [plan D0–D2](PLAN_DESARROLLO_ETAPAS.md) y [Figma v2](ENTREGA_REDISENO_FIGMA_V2.md). Complementos implementables: [API y A02](API_REGISTRO_PERFIL.md) y [aceptación/orden de trabajo](ACEPTACION_REGISTRO_PERFIL.md).

## 1. Alcance y decisiones de este bloque

Recorrido: Cuenta → Experiencia → Disponibilidad → Revisión → Inicio. Permitir entrada manual sin IA y sin CV; después interpretación de texto, PDF, foto y audio de manera incremental. Datos privados por defecto. Este bloque no publica perfil, solicita empleo, reserva curso ni concede acceso al orientador.

Decisiones de diseño v1:

- Una cuenta de aplicación por identidad Supabase Auth; un perfil candidato por cuenta. Crear perfil no concede membresía empresarial ni rol de orientador.
- Un único borrador activo por perfil, con contador de revisión para evitar sobrescrituras concurrentes; N versiones confirmadas inmutables. La edición de un perfil confirmado crea/reutiliza un borrador, nunca modifica la versión anterior.
- Borradores pueden estar incompletos. Confirmar exige nombre visible y declaración explícita sobre las secciones revisadas; **no exige CV, experiencia previa, competencias, salario ni transporte conocidos**.
- No usar escala numérica de habilidad en registro. Guardar competencia, criterio y evidencia concreta; el diseño posterior podrá añadir escala versionada sin reinterpretar evidencia pasada. Esta elección acota CU01; no cierra los requisitos de vacantes.
- No pedir edad, fecha de nacimiento, género, cédula, foto personal o domicilio exacto para registrarse. No derivar elegibilidad para programas concretos de pertenecer al producto. Política de población destinataria queda fuera de esta ficha y debe definirse antes de captar datos reales si corresponde.
- Identificadores de dominio UUID generados por servidor; fechas de auditoría UTC ISO8601; fechas declaradas de experiencia en precisión mes/año; horario local con zona explícita. IDs de Auth solo vinculan identidad, no sustituyen los del dominio.

## 2. Cuenta frente a perfil

| Objeto/campo | Tipo, obligatoriedad y origen | Regla |
|---|---|---|
| Credencial/sesión | Gestionada exclusivamente por Supabase Auth | Frontend nunca manda contraseña a nuestra API; no duplicar contraseña, refresh token ni sesión en tablas de dominio |
| Correo de cuenta | Identidad gestionada por Auth | Mostrarlo solo al dueño; modificarlo mediante flujo Auth, no mediante edición de perfil. No compartir como contacto laboral automáticamente |
| AppUser.id | UUID, servidor, requerido | Identificador interno estable |
| AppUser.auth_subject | ID único del sujeto validado, servidor | No aceptar ID de usuario elegido por cliente. Vinculación única; jamás fusionar cuentas por similitud de correo/nombre |
| AppUser.status | active / disabled, servidor | Deshabilitada no puede leer/escribir perfil aunque conserve JWT con fecha vigente |
| AppUser.created_at / updated_at | Instantes UTC, servidor | Auditoría, no editables |
| AppUser.locale | es por defecto, elección del dueño | No implica nacionalidad |
| AppUser.theme | system / light / dark, elección del dueño | Preferencia visual; no cambia versión de perfil ni invalida recomendaciones |

Método inicial propuesto: correo/contraseña con verificación de correo antes de crear datos de perfil en servidor; recuperación y cierre de sesión mediante Auth. Si registro no devuelve sesión válida, mostrar «revisar correo», sin simular cuenta autenticada. Política concreta de contraseña, URLs de retorno y verificación JWT/renovación se cerrará con documentación oficial y configuración real en D1; este documento no presume que ya están configuradas. Cerrar sesión no borra perfil ni equivale a revocar accesos ya concedidos a terceros en otros CU.

## 3. Entidades, cardinalidades y unicidad

| Objeto | Cardinalidad/propiedad | Campos estructurales y garantías |
|---|---|---|
| CandidateProfile | AppUser 0..1 perfil; un solo propietario | id, owner_user_id único, current_version_id nullable, created_at. Nunca owner en payload editable |
| ProfileDraft | Perfil 0..1 borrador activo | id, profile_id, base_version_id nullable, revision entero ≥1, updated_at; revision cambia con toda mutación de contenido/revisión/sugerencias incorporadas |
| ProfileVersion | Perfil 0..N versiones | id, profile_id, version_number único por perfil, snapshot_digest, confirmed_by, confirmed_at; datos y relaciones congelados al confirmar |
| Experience / TrainingDeclaration / JobInterest | Borrador o versión 1:N | Objetos propios de esa revisión; no compartir filas mutables entre versión confirmada y borrador |
| AvailabilityWindow / Exception | Borrador o versión 1:N | Ventanas recurrentes y excepciones concretas separadas; zona horaria y vigencia |
| Evidence / CompetencyClaim | Perfil 1:N; vínculos fijados en versión | Evidencia → fuente; claim → competencia/evidencia/criterio/decisión. Adjuntar archivo no demuestra habilidad |
| Source / SourceFragment | Perfil 1:N fuentes, fuente 1:N fragmentos | Propietario, versión, huella, origen y acceso. Storage privado para binarios; texto sin enlace público |
| InterpretationRun / Suggestion | Perfil 1:N ejecuciones, ejecución 0..N sugerencias | Fuente y revisión base; decisiones del joven y estado de incorporación, sin modificar confirmados |
| ProcessingGrant | Perfil 1:N autorizaciones de procesamiento | Fuente/revisión, propósito profile_interpretation, proveedor previsto, otorgado/revocado/consumido; no compartir ni acompañar |
| ProfileConfirmation / AuditEvent | Una confirmación por nueva versión; N eventos | Actor confiable, revisión base, digest, versión, clave idempotente, recibo y correlación. Sin documentos completos ni tokens |

No es un schema Prisma. Campos relacionales de propiedad, versiones, vínculos y confirmación deben ser comprobables en BD; JSON puede contener payload de IA y snapshots auxiliares, no reemplazar integridad de esas relaciones. Copiar a borrador no crea acceso de terceros ni hace mutables las evidencias históricas.

## 4. Diccionario del contenido de perfil

Convenciones: O = requerido para confirmar perfil; P = puede desconocerse; C = requerido si se declara el objeto. Todo campo enviado debe ser válido aunque sea opcional. Texto recortado, Unicode, sin HTML ejecutable; no eliminar acentos de nombres o etiquetas. Límite por campo validado igual en UI/API.

### Identificación y secciones

| Campo | Tipo/límite | Obligación y significado |
|---|---|---|
| display_name | string 1–100 | O. Nombre elegido para la interfaz, no verificación de identidad legal |
| headline | string nullable, ≤160 | P. Resumen declarado; A02 solo propone |
| experience_status | unknown / none / provided | O tras revisión. none significa «sin experiencia declarada», no incapacidad |
| training_status | unknown / none / provided | O tras revisión. No exigir curso previo |
| interests_status | unknown / none / provided | O tras revisión. Un interés nunca prueba aptitud |
| reviewed_sections | Cuenta/Experiencia/Disponibilidad/Revisión, cada una con timestamp/actor/revisión | Derivado por servidor de acciones explícitas. No confiar en un array del cliente que afirme revisión final |
| section_decisions | por sección: reviewed / deferred | O antes de confirmar. Permitir «completar después» para experiencia, formación, intereses y restricciones; Revisión requiere confirmación expresa |
| missing_fields | paths y motivo | Derivado por código, no porcentaje LLM. No usar etiqueta «perfil completo» si faltan datos; separar desconocidos de errores |

Array vacío y estado provided son incompatibles. none obliga array vacío; unknown permite continuar sin sugerir que se confirmó ausencia. Puede confirmar perfil parcial con section_decisions=deferred y estados unknown. No hacer desaparecer faltantes para completar una barra de progreso.

### Experiencia y formación declarada

| Campo | Tipo/límite | Regla |
|---|---|---|
| experience.id | UUID servidor | C; estable dentro del borrador y mapeado a versión al confirmar |
| experience.kind | formal / informal / volunteer / personal_project / other | C si hay experiencia; no convertir informal en empleo formal |
| experience.title | string 1–120 | C; tarea/actividad, no exigir cargo contractual |
| experience.organization_name | nullable string ≤160 | P; permitir negocio familiar o actividad independiente sin nombre |
| experience.description | string 1–3000 | C; tareas y ejemplos aportados. Máximo 30 experiencias por borrador |
| experience.start_month / end_month | YYYY-MM nullable | P; si ambas conocidas, fin ≥inicio. ongoing boolean; ongoing=true exige end_month=null |
| experience.source_refs | lista ≤20 de fragmentos autorizados | Procedencia de propuesta/importación; datos manuales también tienen fuente de declaración del joven |
| training.name | string 1–160 | C; máximo 30 registros |
| training.provider_name | nullable string ≤160 | P; no inventar centro ni vincular por nombre sin confirmación |
| training.completed_on | fecha YYYY-MM-DD nullable | P; no admitir fecha futura como finalización ya realizada |
| training.status | declared / documented | Estado de procedencia del registro; no equivale finalización confirmada por centro |
| training.source_refs | lista de fuentes/fragmentos propios | Documento puede ser certificado existente; vínculo a curso/edición interno solo si se verifica pertenencia. Microevaluación se especifica en CU02, fuera de esta entrega |

No convertir una transcripción no revisada en experiencia confirmada. Fechas desconocidas permanecen null; no completar enero/día 1 arbitrariamente.

### Puestos de interés, competencias y evidencia

| Campo | Tipo/límite | Regla |
|---|---|---|
| interest.original_text | string 1–160 | C; máximo 20 intereses |
| interest.occupation_id / catalog_version | UUID/ref nullable; versión si hay ID | P. Confirmar referencia activa/permitida; alias ambiguo admite texto pendiente de aclaración, sin ID inventado |
| claim.competency_id / catalog_version | ID y versión válidos | C para vínculo canónico; concepto no catalogado queda texto propuesto separado |
| claim.original_text / criterion | texto ≤300 / ≤1000 | Conservar lenguaje original y alcance observable; no score global |
| claim.evidence_refs | refs propias, al menos una | C. Declaración manual cuenta como evidencia declarada, no demostrada |
| claim.decision | proposed / accepted / rejected / deferred | Joven decide; solo accepted entra a versión confirmada. Rechazo conserva traza mínima, no se recicla automáticamente |
| evidence.kind | self_report / document / verified_exercise | Servidor por procedencia. En D2 solo se crean las dos primeras; verified_exercise requiere recibo de verificador posterior CU02 |
| evidence.source_ref / fragment_ref | referencia existente y propia | C; documento no implica verdad de todo su contenido |
| evidence.scope / verification_ref | alcance ≤1000, ref nullable | Sin resultado verificable no elevar estado por un número de confianza del LLM |

Una propuesta rechazada/deferred no se confirma por un checkbox global. El resumen final enumera datos incluidos, rechazados y pendientes. Aceptar propuesta conserva origen IA y actor que confirmó.

### Disponibilidad y restricciones

Campos opcionales respecto al registro, pero obligatorios respecto al cálculo que los requiera. Cada grupo usa `state: known | unknown` y `value`; unknown exige value=null. known exige estructura válida. El estado por sección no es un dato de disponibilidad. Cada restricción usa su state propio; movilidad y máximo de minutos se pueden desconocer por separado. No usar null indistintamente para «sin límite», «no respondió» y cero.

| Grupo/campo | Tipo y unidad | Regla |
|---|---|---|
| location | zona aproximada, texto ≤160; referencia geográfica opcional | No dirección exacta obligatoria ni coordenadas precisas. Ubicación no representa tiempo de viaje |
| availability | known con windows[]/exceptions[], o unknown | known con windows=[] significa no disponible dentro de su vigencia, no disponibilidad ilimitada |
| window.weekday / start / end | ISO 1–7; HH:mm | inicio <fin. Intervalos [inicio,fin); turno nocturno se divide en dos días |
| window.timezone / valid_from / valid_to | America/Panama por defecto visible; fechas | C si ventana conocida; valid_to ≥valid_from. Máximo 28 ventanas; rechazar solapadas dentro de igual vigencia en vez de sumar horas dos veces |
| exception.date / intervals | fecha y lista de horas | Reemplaza disponibilidad de ese día; lista vacía = no disponible. Máximo 60 excepciones; fecha dentro del horizonte declarado |
| mobility.modes | bus / metro / walking / bicycle / private_vehicle / other | C si movilidad conocida; no inferir propiedad de vehículo o ruta verificada |
| mobility.max_one_way_minutes | entero 0–1440 o unknown | Máximo aceptado por trayecto, no tiempo calculado. Cero es límite real, no desconocido |
| salary.minimum | amount decimal string ≥0, currency ISO, period hour/day/week/month | Unidad/moneda/periodo obligatorios si conocido; sin conversión automática entre periodos o monedas sin regla posterior explícita |
| budget.transport / budget.training | amount decimal string ≥0, currency ISO, period day/week/month/total según grupo | Presupuesto de transporte y formación separados. Transporte por día/semana/mes; formación total o mes. Cero confirmado válido; no es «sin límite» |

Dinero hasta 12 dígitos enteros y 2 decimales en contrato v1; rechazar NaN, exponentes y negativos, nunca aritmética binaria para sumas. Moneda soportada por catálogo de la aplicación; USD/PAB no se convierten por similitud. Si un usuario declara no tener límite, dejar unknown y pedir una política explícita antes de modelarlo como infinito. Ninguna restricción logística se calcula con datos ausentes.

## 5. Fuente, archivos y procesamiento IA

Source: id, owner_profile_id, kind (manual_text/pdf/image/audio), version, sha256, media_type, size_bytes, created_at y estado received/validated/ready/failed/withdrawn. Original inmutable; corrección de transcripción genera versión nueva con vínculo a original. Texto manual tiene original de declaración y huella; fragmentos conservan página o intervalo temporal si existe, nunca inventado.

Límites técnicos iniciales propuestos para pruebas: texto ≤20 000 caracteres por fuente; PDF ≤10 MiB y 10 páginas; JPEG/PNG/WebP ≤8 MiB; audio WAV/MP3/M4A ≤10 MiB y 120 segundos. Hasta 10 fuentes activas y 50 MiB por perfil de demo. MIME declarado no basta: comprobar contenido real, páginas/duración y tamaño descomprimido/decodificado antes de procesar. Formato no habilitado devuelve error explícito, no éxito vacío. No descargar URLs externas del documento ni aceptar rutas locales del cliente.

Storage privado y acceso mediante servicio con autorización vigente; no enlazar binarios directamente en traza. El CV puede contener datos innecesarios: extraer solo campos de CU01, excluirlos de A02 cuando no sean necesarios y no propagarlos a perfil/puntaje. No guardar copias completas en logs. Límites y política de retención/borrado, antivirus/aislamiento de parser y gestión de menores requieren cierre antes de habilitar carga de datos reales; no prometer borrado completo sin implementarlo. Pruebas iniciales solo con fixtures sintéticos.

Autorizar IA es opcional y específico para ejecución, fuentes/versiones y propósito. Guardar manualmente no requiere permiso de envío a modelo. Registrar autorización antes de encolar A02 y comprobarla otra vez justo antes de envío; revocación cancela trabajo no enviado y evita aplicar resultado tardío. Si el proveedor ya recibió datos, no afirmar que se recuperaron o borraron sus copias. El resultado queda inaccesible para incorporación si el permiso de procesamiento se revocó, conservando solo evento mínimo según política. No equivale a compartir CV con empresa u orientador.

## 6. Estado, revisión y confirmación

Tres ejes independientes:

| Eje | Valores | Efecto |
|---|---|---|
| Ciclo | draft / confirmed / discarded | confirmed es versión inmutable; discarded solo borrador, no borrado histórico de versión |
| Revisión de datos | needs_clarification / ready_for_review / reviewed | Derivado de decisiones/fuentes y revisión explícita; no es aprobación de orientador |
| Completitud | partial / sufficient_for_profile | Calculada por reglas de registro; no afirma viabilidad laboral/formativa |

1. Crear borrador vacío o desde current_version_id. Guardar cada acción con comparación de revision esperada.
2. A02 propone sin sobrescribir; candidato acepta/corrige/rechaza/deja pendiente. Resolver referencia obsoleta exige nueva lectura; no insertar automáticamente salida tardía.
3. Revisión muestra snapshot exacto, pendientes y propuestas aún no aceptadas. Propuestas no resueltas pueden diferirse expresamente; se excluyen, no bloquean por sí solas un perfil parcial. Campos inválidos sí bloquean.
4. Servidor entrega preview_ref/digest para esa revisión. Joven confirma sobre ella con clave idempotente y revisión esperada.
5. En transacción corta revalidar identidad, propiedad, revisión y preview; crear versión/relaciones/confirmación, actualizar current_version_id y cerrar borrador. No requerir llamada IA ni disponibilidad de Vertex para confirmar datos manuales válidos.
6. Marcar propuestas/cálculos dependientes de versión sustituida como desactualizados antes de autorizar nuevos efectos. Fuentes y versiones históricas permanecen referenciadas. No reescribir postulaciones/materiales ya compartidos; CU05 maneja nueva confirmación por separado.

Cambiar solo borrador no sustituye la versión confirmada ni invalida cálculos sobre ella; al confirmar una nueva versión sí se revalidan dependencias. Una respuesta en vuelo sobre revisión anterior se conserva como stale y no puede aceptarse. Al confirmar mientras hay interpretación en vuelo, su salida posterior tampoco modifica la versión confirmada.

Idempotencia: mismo actor/operación/clave y payload devuelve mismo recibo, siempre revalidando acceso; clave con payload distinto devuelve conflicto. Dos confirmaciones concurrentes del mismo borrador crean como máximo una versión; comparación de revisión y unicidad deben mantenerse en BD, no solo en botón deshabilitado.

## 7. Permisos por operación y objeto

| Operación | Joven dueño | Otro candidato | Orientador | Empresa/reclutador | Centro | A02/runtime |
|---|---|---|---|---|---|---|
| Leer/editar borrador o fuente | Sí | No | No en D2 | No | No | Lectura mínima autorizada por ejecución, sin acceso global |
| Leer versión completa | Sí | No | Solo proyección/alcance futuro CU14; no endpoint /me de otro | Solo proyección consentida futura CU05/09 | Solo datos de participación futura | Solo refs mínimas de la tarea |
| Proponer datos/competencias | Sí manualmente | No | Propuesta futura, nunca edición directa | No | No | Sí, a propuesta privada de su ejecución |
| Aceptar/rechazar/confirmar | Sí | No | No | No | No | No |
| Autorizar o revocar procesamiento | Sí | No | No | No | No | Comprobar, nunca otorgarse permiso |
| Consultar traza | Su vista sanitizada | No | Solo vista futura autorizada | Solo objeto propio futuro | Solo objeto propio futuro | Escritura de eventos; sin lectura indiscriminada |

La identidad se deriva de sesión validada en servidor y usuario activo. Parámetros/refs/UUID conocidos no conceden permiso; rechazar campos owner_user_id, auth_subject, role, confirmed_by o verification_ref enviados como edición. A02 solicita herramientas con contexto firmado/gestionado por runtime; el modelo no define actor ni allowlist. No hay endpoint administrativo genérico de todos los perfiles en D2. Datos del dominio solo accesibles a través de la API; concretar roles de BD, RLS/Data API y Storage en D1 para que no exista una ruta alternativa que omita estas reglas.

## 8. Mapeo de interfaz

| Paso Figma | Campos y acciones | Cierre |
|---|---|---|
| Cuenta, 36:2 claro / 36:312 oscuro | Identidad Auth, display_name, preferencia visual | Sesión validada; informar si falta verificar correo |
| Experiencia, 36:78 / 36:388 | Sin CV o importar; experiencia/formación/intereses; A02 opcional; aceptar/rechazar | Guardar datos válidos o sección deferred; archivo fallido no impide manual |
| Disponibilidad, 36:156 / 36:466 | Ventanas, zona aproximada, movilidad, salario/presupuestos | Conocidos válidos o unknown explícito |
| Revisión, 36:234 / 36:544 | Preview, fuentes, decisiones, pendientes y confirmar | Recibo real y nueva versión consultable |
| Inicio vacío, 43:925 | Siguiente acción basada en datos guardados | Sin actividad, postulación ni empleo inventados |

Archivo Figma cWPzNNsLPoUenKyfhf4Diu. IDs de referencia existentes; sin nueva inspección/escritura Figma en esta especificación. Rutas del frontend propuestas: /registro/cuenta, /registro/experiencia, /registro/disponibilidad, /registro/revision, /inicio y /mi-cuenta/perfil. Servidor decide progreso persistido; URL o paso visitado no confirma datos. Volver conserva borrador; abrir dos pestañas maneja conflicto de revisión sin descartar datos silenciosamente. Mantener terracota claro/oscuro, foco, etiquetas y errores accesibles.

## 9. Qué queda pendiente

Esta especificación cierra el contrato lógico de CU01 para D1–D2. Antes de código: fijar framework/versiones/runtime, estrategia Auth/JWT y permisos BD/Storage, contratos físicos e índices y entorno aislado. Antes de archivos/IA reales: retención/borrado, procesamiento, límites confirmados con parser/proveedor y adaptador real Vertex. No bloquean la ruta manual los detalles de matching, vacantes, escala avanzada, entrevistas o reservas; quedan en sus bloques. Seguir [orden y aceptación](ACEPTACION_REGISTRO_PERFIL.md) sin confundir contrato escrito con API implementada.

## Cierre de stack ST01

[Stack técnico seleccionado y versiones](STACK_TECNICO.md): React/Vite, API Hono sobre Bun, Prisma7/adapter-pg y PostgreSQL Supabase. Sustituye NestJS candidato y deja de estar pendiente elegir framework/runtime. Esquema físico, estrategia efectiva Auth/BD/RLS/Storage y aplicación permanecen en D1. Las menciones de stack pendiente en el cuerpo describen el estado anterior a ST01; no reabren la selección.
