# Entidades, relaciones, estados y módulos — propuesta para cerrar

> **Diseño/plan de su etapa — conciliación 2026-10-17:** los pasos futuros y alternativas siguientes conservan su contexto original; no son una lista de todo lo que falta hoy. Implementación y pendientes vigentes en [ESTADO_ACTUAL.md](ESTADO_ACTUAL.md) y [cobertura CU](CASOS_DE_USO.md#cobertura-actual-por-caso). Los casos diseñados no se presentan como ejecutados.

Fecha: 2026-10-16. Estado: discusión de diseño, no aprobación global ni implementación. No hay schema Prisma, migraciones, conexiones nuevas ni cambios en Supabase. Base: [17 casos](CASOS_DE_USO.md), [fichas y reglas](ESPECIFICACION_CASOS_USO.md), [arquitectura de agentes](ARQUITECTURA_AGENTES.md) y [autonomía](AUTONOMIA_CONTRATOS_MODELOS.md). Mainor y Giovanny aportan ideas y decisiones; organización del modelo lógico por IA.

## Decisiones confirmadas por el usuario

1. **Supabase Auth** para autenticación; perfiles, organizaciones y permisos propios en nuestra BD. La API valida identidad y permisos por objeto; login no concede acceso global.
2. **Candidatos con registro propio; empresas/centros con cuentas de demo e invitaciones controladas**. No incluir registro público de organizaciones con aprobación posterior en este alcance. Invitación concede membresía solo tras aceptar y verificar identidad correspondiente.
3. **Reserva interna inmediata y descuento de un cupo** cuando joven confirma, edición está publicada y se cumplen restricciones, versiones, permisos y aprobaciones aplicables. Comprobación de cupo y creación de reserva/agenda en una operación indivisible e idempotente. No hay solicitud esperando aprobación individual del centro; el centro autoriza al publicar edición. Cancelar una reserva confirmada libera un cupo exactamente una vez.

Confirmaciones explícitas en conversación de 2026-10-16. No equivalen a aprobar automáticamente cada campo, módulo, estado restante o versión de tecnología. No se ha configurado Supabase ni iniciado desarrollo.

## Arquitectura de aplicación propuesta

Monolito modular: frontend React/TypeScript/TSX local → API TypeScript local → Prisma en servidor → PostgreSQL en Supabase. Stack cerrado posteriormente en [ST01](STACK_TECNICO.md): API Hono sobre Bun, React/Vite y Prisma7 con adapter-pg; NestJS queda como propuesta histórica sustituida. Evidencia y límites de compatibilidad en ST01; implementación del producto pendiente. Tres capas: presentación, aplicación/negocio y persistencia. Dentro de la API: controlador → servicio/caso de uso → acceso a datos Prisma. Módulo agrupa responsabilidades, no es una cuarta capa ni servicio desplegado separado.

Agentes A01–A05 son unidades invocables del módulo de agentes, con herramientas acotadas que llaman servicios del dominio. No exponer Prisma directo al modelo o navegador. Los servicios hacen cumplir autorización, versiones, cálculo y confirmación incluso si una petición no proviene de un agente. Llamadas LLM fuera de transacciones largas; registrar propuesta y luego ejecutar acción corta con revalidación.

## Entidades lógicas y relaciones

Son conceptos del dominio, no número definitivo de tablas ni diseño físico ya elegido. En el siguiente paso se traducirán a tablas, claves, índices y contratos API.

| Grupo | Entidades principales y responsabilidad | Relaciones y campos clave | CU |
|---|---|---|---|
| Identidad y acceso | Usuario de aplicación; Organización; Membresía | Usuario N:M Organización mediante membresía; organización tipo empresa/centro; rol/ámbito/estado en membresía. Identificador de Supabase Auth único vinculado al usuario de aplicación; contraseña/sesión no se duplican en tablas de dominio. Un rol no concede acceso global | CU08 y todos |
| Perfil del joven | PerfilCandidato; VersiónPerfil; Experiencia; Restricción/Disponibilidad | Usuario 0..1 perfil; perfil 1:N versiones; experiencias/intereses/horarios/movilidad/salario mínimo y presupuesto con moneda/periodo pertenecen a versión confirmada. Zona aproximada, no domicilio exacto obligatorio | CU01/CU03/CU04 |
| Puestos, competencias y evidencia | Puesto; AliasPuesto; Competencia; AliasCompetencia; PuestoCompetenciaReferencia; PuestoInterés; Evidencia; VinculaciónPerfilEtiqueta | Puesto define función ocupacional, separado de competencia tipo conocimiento/habilidad; alias contextual, ID estable y catálogo versionado; puesto N:M competencias de referencia, vacante confirma sus requisitos reales. Interés por puesto no acredita idoneidad. Perfil N:M etiquetas por vínculo con evidencias/alcance/confirmación. Evidencia puede documentar experiencia, archivo o ejercicio; evitar un único booleano «domina» | CU01/CU02/CU03/CU07/CU11 |
| Vacantes | Vacante; VersiónVacante; RequisitoVacante | Empresa 1:N vacantes; vacante 1:N versiones; versión 1:N requisitos esenciales/deseables/entrenables asociados a etiqueta y fuente. Puesto principal referenciado al catálogo y título original, vigencia, salario/periodo, turnos/sede; plazas empleo, capacidad selección y cupos de entrevista separados | CU03/CU07/CU09 |
| Formación ofrecida | Curso; VersiónCurso; Unidad/ResultadoEsperado; MapeoResultadoEtiqueta; Edición; Sesión | Centro 1:N cursos; curso 1:N versiones; unidad/resultado y mapa ligados a versión. Edición N:1 versión de curso; edición 1:N sesiones con fecha/horario/sede/modalidad, cupo, precio y requisitos. Contenido y oferta concreta no son lo mismo | CU04/CU11/CU12 |
| Aprendizaje del candidato | RegistroFormaciónPrevia; Finalización; DocumentoCertificado | Perfil 1:N registros previos; curso/edición referenciados opcionalmente, proveedor externo declarado permitido sin inventar centro. Reserva/participación interna puede tener finalización confirmada por centro; documento certificado opcional, emitido por él y nunca generado por IA | CU02/CU13 |
| Microevaluación | Banco; VersiónBanco; Pregunta/Rúbrica; Intento; Respuesta; ResultadoEjercicio | Banco ligado a versión/mapa de curso, revisado por centro propio. Pregunta→unidad/resultado/etiqueta/fuente; intento N:1 versión de banco y candidato. Resultado de respuesta objetiva o revisión humana es evidencia acotada, no certificación ni dominio general | CU02/CU11 |
| Candidatura y selección | Postulación; VersiónMaterial; AsignaciónSelección | Postulación une candidato y vacante, fija versiones y autorización. Lista corta se representa por asignaciones de selección, no por ocupar plaza de empleo. Una sola postulación activa por candidato/vacante en demo; historial de intentos y estados conservado | CU05/CU09 |
| Plan y acompañamiento | Plan; VersiónPlan; PasoPlan; Acompañamiento; RevisiónPlan | Candidato 1:N planes; versión fija perfil/meta/vacante/cursos/resultados del solver. Pasos se refieren a ediciones, no matriculan. Candidato N:M orientador por acompañamiento autorizado con alcances; revisión referida a versión exacta y revisor | CU04/CU14 |
| Reservas y agenda | ReservaFormación; Entrevista; AceptaciónEntrevista | Reserva une candidato y edición con idempotencia y estado; entrevista une postulación/partes y propuesta versionada. Aceptación de cada parte ligada a misma versión. Agenda es vista derivada de sesiones reservadas y entrevistas, no copia editable de ambos | CU10/CU12/CU15 |
| Práctica privada | SesiónPráctica; Intercambio/Retroalimentación | Candidato y oferta/puesto objetivo con versiones; acceso privado. No reutilizar respuestas de práctica como evaluación empresarial o microevaluación del curso; solo resumen voluntario consentido | CU06 |
| Consentimiento y confirmaciones | Consentimiento; Confirmación/Decisión | Candidato→destinatario/propósito/artefactos/versiones/alcance/vigencia. Diferenciar compartir postulación y acompañamiento. Confirmación de acción por actor competente no se deduce de consentimiento genérico | CU05/CU12/CU14/CU16 |
| Fuentes y ejecución | Documento/Fuente; Fragmento; EjecuciónAgente; Mensaje; LlamadaHerramienta; EventoAuditoría; Alerta | Fuente conserva huella/versión/propietario/acceso; binario en almacenamiento, referencia en BD. Ejecución tiene agente/modelo/versión/caso/estado; mensajes con correlación; llamada con idempotencia y recibo; traza y alerta sanitizadas por ámbito | O01–O07/CU16 |

No usar JSON para sustituir membresías, relaciones de etiquetas, reservas, consentimientos ni versiones que deban comprobarse. JSON sí es adecuado para payload variable de IA, instantánea de restricciones/resultado del solver y metadatos, referenciando entidades y versiones reales. El esquema físico concretará las claves y evitará referencias genéricas a objetos inexistentes.

## Estados y transiciones propuestas

Estados del negocio separados de cargando/error de pantalla y de status del agente. La versión confirmada no se sobrescribe al editar: nueva versión borrador, enlaces históricos intactos.

| Objeto | Estados/transiciones | Quién y condiciones |
|---|---|---|
| Membresía | invitada → activa → desactivada; invitada → cancelada | Administrador de su organización, identidad aceptada antes de conceder acceso; no eliminar último administrador sin sustituto |
| VersiónPerfil | borrador → por aclarar/por confirmar → confirmada; confirmada es inmutable | Joven confirma; completitud es indicador aparte, se admiten datos desconocidos sin afirmar viabilidad |
| Vacante | borrador → publicada → cerrada/archivada | Empresa confirma versión; bloqueo por alerta se conserva aparte y siempre impide publicar/actuar; nueva versión necesita controles/revisión aplicables |
| VersiónCurso/mapa | borrador → por revisar → confirmada | Centro dueño confirma contenido y mapa; nuevas versiones no recalifican intentos pasados |
| Edición | borrador → publicada → cerrada/cancelada/finalizada | Centro; cupos/horarios conocidos antes de reserva; reducción por debajo de ocupación exige reacomodo, no borrado silencioso |
| Banco de preguntas | borrador → por revisar → aprobado/rechazado; nueva versión ante cambios | Centro propio revisa. Solo banco aprobado y compatible con versión de curso puede verificar ese curso; curso publicado no exige banco aprobado |
| Intento | iniciado → enviado → evaluado_orientativo/pendiente_revision → revisado; iniciado → abandonado | Joven responde; código o humano autorizado verifican ejercicio si procede; respuesta abierta LLM sola no demuestra competencia |
| Evidencia vinculada al perfil | propuesta → confirmada/rechazada; retirada conserva historia restringida | Joven confirma asociación; tipo/calidad de evidencia se mantiene aparte: declarada/documentada/verificada_en_ejercicio |
| Postulación | borrador → enviada → en_revision → rechazada/retirada/finalizada | Joven envía/retira; empresa gestiona su proceso autorizado. Lista corta, entrevista y contratación son registros/indicadores relacionados; evitar un enum que pierda procesos simultáneos |
| AsignaciónSelección | propuesta → confirmada → liberada | Empresa confirma lista con cupo; retiro/rechazo libera una sola vez. No equivale contrato laboral |
| Plan | borrador → calculado → confirmado → sustituido/cancelado | Joven confirma; revisión del orientador y factibilidad viable/condicional/pendiente/inviable son dimensiones separadas; no «estado aprobado» que sustituya voluntad del joven. Ruta condicional no permite reservas con prerrequisitos no acreditados |
| RevisiónPlan | solicitada → en_revision → aprobada/rechazada/por_aclarar; desactualizada/revocada según dependencia | Orientador autorizado, versión y alcances vigentes; corrección de datos/ruta debe confirmarla joven |
| ReservaFormación, política confirmada | propuesta de UI → confirmada → cancelada/completada | Confirmación del joven + edición publicada + restricciones/cupo vigentes; propuesta no ocupa plaza. No vencimiento provisional |
| Entrevista | propuesta → confirmada → realizada/cancelada/no_asistio | Ambas partes aceptan misma versión y agenda viable; contrapropuesta invalida aceptaciones anteriores; resultado empresarial solo reclutador |
| Consentimiento | vigente → revocado/vencido | Revocar impide accesos futuros y efectos pendientes afectados; no deshacer automáticamente reserva independiente ya confirmada ni prometer borrar copias descargadas |
| Alerta | abierta → en_aclaracion → corregida/reevaluada → resuelta | Dueño corrige y control vuelve a comprobar; no cierre manual para eludir bloqueo |
| EjecuciónAgente | pendiente → ejecutando → completada/necesita_datos/necesita_aprobacion/bloqueada/error | Respuesta `agent-result/1` validada; efecto de herramienta se registra aparte con recibo del runtime |

«Completada» en ejecución no significa reserva/contratación confirmada. «Finalizada» de postulación no implica contratado: resultado empresarial independiente y explícito. Esta separación debe reflejarse en las vistas, no solo en tablas.

## Módulos propuestos de API y propiedad de datos

Son módulos de un mismo backend, sin microservicios ni una BD por módulo. Controller recibe solicitud; Service aplica el caso/permiso; Prisma realiza acceso a datos. Evitar un repositorio genérico que duplique cada operación Prisma sin aportar reglas.

| Módulo | Propiedad y casos | Relación con agentes |
|---|---|---|
| IdentidadOrganizaciones | Cuenta, identidad, membresías, roles e invitaciones; CU08 | Sin IA para conceder permisos |
| Candidatos | Perfil/versiones, experiencia, restricciones y formación declarada; CU01/CU02 | A02 interpreta; evidencia se vincula desde Evaluación |
| CatalogosPuestosCompetencias | IDs, tipos, alias y versiones del catálogo; transversal | Servicio compartido, no agente extra |
| VacantesSeleccion | Vacantes/requisitos, postulaciones/materiales, asignación/lista y resultado empresarial; CU03/CU05/CU07/CU09 | A01 normaliza, A03 compara, A04 prepara |
| Formacion | Curso/versiones/mapa, edición/sesiones/reservas, finalización/certificado; CU11/CU12/CU13 | A01 interpreta temario; A05 consulta oferta. Reserva requiere C01/C02/C03 |
| EvaluacionPractica | Banco/preguntas/rúbricas/intentos/evidencia y práctica privada; CU02/CU06 | A02 microevaluación, A04 práctica; servicios/permisos separados aunque compartan módulo |
| PlanificacionAcompanamiento | Solver/reglas/logística, resultados de compatibilidad, planes/versiones/revisión y acompañamiento; CU03/CU04/CU14 | A03/A05 eligen herramientas y explican; C01 calcula |
| Agenda | Entrevistas, aceptaciones y coordinación de cambios; CU10/CU15 | A04 propone; no mantiene otra reserva de curso ni contador distinto |
| Agentes | Entradas independientes A01–A05, prompts/adaptadores/modelos, contratos y flujo durable; transversal | C03 coordina llamadas a servicios de dominio, no decide toda semántica por agentes |
| SeguridadTrazas | Consentimientos, confirmaciones, autorización, alertas, mensajes/recibos/trazas; CU16 y transversal | C02 y telemetría por ejecución. Lectura de trazas no exige LLM |

Documentos/Storage se expone como servicio compartido con propietario, propósito y referencias; no duplicar documentos por cada módulo. CU17 consulta agregados permitidos en VacantesSeleccion/CatalogosPuestosCompetencias, sin replicar perfiles ni inventar estadísticas. Control de transacción de reserva queda en Formacion; Agenda consume sus sesiones confirmadas para vista/conflictos.

## Invariantes que deben sobrevivir al esquema y a Prisma

- Usuario puede tener roles contextuales distintos; membresía de empresa no concede acceso a jóvenes ajenos ni rol de orientador global. El acompañamiento es relación autorizada con alcance, no membresía empresarial.
- Habilidad de perfil, requisito de vacante y resultado esperado de curso comparten ID canónico, pero son relaciones distintas y con evidencia propia. Leer temario no da habilidad al joven.
- Documento, perfil, vacante, curso, banco, plan y aprobación referencian versiones pertinentes; no unir siempre contra «última versión» al interpretar un resultado histórico.
- Una reserva activa por candidato/edición y una postulación activa por candidato/vacante en demo; clave idempotente además de unicidad de negocio. Toda repetición devuelve el mismo efecto, sin descontar dos veces.
- Cupo de edición y capacidad de selección se verifican en transacción y bajo control de concurrencia. Definir ocupación a partir de reservas/asignaciones activas, sin dos contadores fuente de verdad. No usar una llamada LLM para decidir el descuento ni mantener bloqueo de BD durante generación.
- Dinero con representación decimal/unidad/moneda/periodo; tiempos con unidad; desconocido no es cero. ID y fechas/auditoría coherentes; tipo de IDs, precisión y reglas físicas se cerrarán en esquema, sin código ahora.
- Agenda comprueba intervalos incluyendo traslado y sesiones de todas las reservas activas. Separar horarios declarados recurrentes de sesiones concretas y excepciones; horizonte de planificación por acordar con datos de demo.
- Datos de perfil/curso pueden ser parciales, pero falta de salario/logística/cupo esencial deja cálculo o acción dependiente pendiente. Aprobación desactualizada no habilita efecto.
- Conexión Prisma de servidor no se presupone autorizada por el JWT del usuario. API aplica permisos por objeto; estrategia de roles de BD/RLS y exposición de Data API se diseñará antes de conexión. No poner credenciales de BD/IA en frontend.
- E2E requiere entorno/datos aislados. Pruebas de solver y concurrencia complementan recorridos de navegador; evals de IA no se sustituyen por E2E. No ejecutar pruebas contra datos de demo compartidos sin aislamiento definido.

## Qué falta cerrar en conversación

Las tres decisiones iniciales quedan resueltas. Falta aceptar o ajustar agrupación de módulos y detallar diccionario de campos, cardinalidades obligatorias/opcionales, estados restantes y permisos por transición. Por último traducir a esquema Prisma/contratos API y fijar versiones/compatibilidad; no iniciar desarrollo por la mera existencia de esta propuesta.

## Detalle de cursos y etiquetas

[Catálogos de puestos, habilidades/conocimientos y cursos](CATALOGOS_CURSOS_PUESTOS_HABILIDADES.md): campos, relaciones, alias ambiguos, mapa temario/unidad/resultado/competencia/pregunta, prerrequisitos y evidencia personal separados. Propuestas por cerrar: escala de nivel, puesto principal por vacante y clasificación de requisitos en dos ejes; no atribuir confirmación humana automática.

Reconciliación documental: [dos referencias, recorridos y plan de cierre](REVISION_INTEGRAL_PLAN.md). CU y datos alinean postulación/selección/entrevista y plan/revisión como objetos separados. Niveles, puesto principal y clasificación de requisitos siguen por acordar; no esquema Prisma/migraciones ahora.

## Concreción de registro/perfil D0-01

[Diccionario, permisos y estados v1](CONTRATO_REGISTRO_PERFIL.md), [API/A02](API_REGISTRO_PERFIL.md) y [aceptación](ACEPTACION_REGISTRO_PERFIL.md) concretan CU01 para D1-D2. Perfil parcial permitido; borrador y versiones inmutables separados; A02 solo propone, joven confirma. Sin schema/migración, API o modelo del producto ejecutados. Decisiones de otros módulos siguen pendientes.

## Implementación inicial de datos D1

[Schema y migración CU01](ESQUEMA_INICIAL.md) concretan parte de este modelo lógico. Draft/Version se materializan en ProfileRevision con estado y colecciones propias por revisión; cambios de entidad lógica no implican duplicar tablas. Resto de módulos sigue propuesto. Pruebas locales en VERIFICACION_ESQUEMA.md; sin migración Supabase aplicada.
