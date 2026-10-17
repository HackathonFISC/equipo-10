# Plan de desarrollo por etapas

> **ESTADO VIGENTE (2026-10-16)**: El bloque D1 está **IMPLEMENTADA Y VERIFICADA EN PERSISTENCIA Y LOCALMENTE; ACEPTACIÓN LIVE DE SUPABASE AUTH PENDIENTE DE VALIDACIÓN MANUAL**. Cualquier tabla o checklist posterior que muestre D1 en borrador o progreso queda supeditado a este estado vigente. Ver detalle en [D1_BASE_IMPLEMENTADA.md](D1_BASE_IMPLEMENTADA.md). Infraestructura consolidada: 27 tablas y 18 enums en Supabase real mediante `scripts/deploy-d1.mjs` (`--check`, `--apply`, `--verify`) en modalidad upgrade (scripts viejos con `--migrate`/`--runtime` archivados). En la API, la autenticación remota opera con `supabase.auth.getUser(token)`, rol de conexión `equipo10_api` (`LOGIN`) y rol de datos `equipo10_runtime` (`NOLOGIN`). El arranque se realiza con `bun run setup:web`, `bun run db:generate`, `bun run dev:api` y `bun run dev:web`. D2 a D9 y E01–E20 permanecen pendientes.

Fecha: 2026-10-16. Estado: D1 local autorizado y parcialmente desarrollado. Dependencias base instaladas (bun.lock creado), Prisma CLI 7.10.1 validate/generate verificado con PrismaClient funcional en Bun, esquema de 25 tablas y 15 enums con migración y guards probados localmente (30 PASS), y matriz RLS runtime de 25 tablas validada en PGlite (12 PASS). Despliegue DDL remoto a Supabase, aprovisionamiento de API y servicios de runtime/login permanecen pendientes. Sustituye el orden operativo histórico de FLUJO_TRABAJO.md; no supone que sigan quedando veinte horas ni fija una ventana oficial.

## Empezar por el joven, con una base mínima

Sí: el primer recorrido que desarrollaremos será **registro → experiencia con o sin CV → disponibilidad → revisión → perfil privado confirmado → Inicio**. Antes hacen falta identidad, permisos, persistencia y componentes comunes. Después completaremos oportunidades, formación y postulaciones por recorridos verticales; cada bloque incluye interfaz, API, datos, agentes cuando aporten valor y pruebas. No terminar todo el frontend para conectar el backend al final.

Para explorar desde el joven antes de construir la gestión empresarial usaremos vacantes, cursos y organizaciones de prueba identificados como sintéticos. Prepararlos mediante fixtures en entorno aislado, sin crear APIs de administración públicas ni fingir que los publicó un usuario. La revisión humana de esos datos de demo se distingue de una publicación ejecutada en vivo. Más adelante las pantallas de reclutador y centro reemplazan esa preparación en el recorrido real.

## Fuentes y orden de autoridad

1. Enunciado original local, requisitos oficiales y decisiones humanas expresas. Conservar las ideas humanas sin reescribirlas como si fueran propuestas IA.
2. [Especificaciones CU01–CU17 y RGN01–RGN14](ESPECIFICACION_CASOS_USO.md): reglas funcionales transversales y aceptación. [Catálogo](CASOS_DE_USO.md) y [mapeo](MAPEO_CASOS_AGENTES.md) ayudan a localizar responsables.
3. [Modelo lógico y módulos](MODELO_DATOS_MODULOS_PROPUESTA.md), [catálogos](CATALOGOS_CURSOS_PUESTOS_HABILIDADES.md), [arquitectura de agentes](ARQUITECTURA_AGENTES.md) y [contratos/autonomía](AUTONOMIA_CONTRATOS_MODELOS.md). Sus opciones abiertas siguen siendo propuestas.
4. [Entrega Figma v2](ENTREGA_REDISENO_FIGMA_V2.md) y [plan aplicado](PLAN_REDISENO_FIGMA_V2.md) para estructura visual; [entrega v1](ENTREGA_FIGMA_V1.md) conserva IDs de vistas. Un éxito dibujado no define una operación ya ejecutada.
5. Este plan organiza implementación, sin cambiar los requisitos anteriores. Registrar conflictos antes de alterar contratos. [Revisión documental](REVISION_PREVIA_DESARROLLO.md) identifica referencias históricas.

## Decisiones antes de codificar: bloque D0

No reabrir Supabase Auth, registro propio del candidato, organizaciones mediante demo/invitación, orientador independiente, reserva inmediata ni certificado adjunto: son acuerdos humanos.

| Decisión pendiente | Recomendación para concretar el prototipo | Salida necesaria |
|---|---|---|
| Escala de competencia | Empezar con criterio observable y evidencia; omitir nivel numérico global | Decisión registrada antes de esquema y matching |
| Puesto de vacante | Un puesto principal confirmado; separar anuncios múltiples en borradores | Regla y ejemplo de alias ambiguo |
| Requisitos | Dos ejes: esencial/deseable y de entrada/entrenable, con desconocido explícito | Tipos y efecto sobre elegibilidad; no inferir entrenabilidad |
| Stack | ST01 seleccionado: React/Vite + Hono/Bun + Prisma7/adapter-pg; ver [decisión](STACK_TECNICO.md) | Versiones y evidencia limitada de compatibilidad en ST01; instalación del producto/seguridad/migraciones siguen D1 |
| Acceso a datos | Frontend autentica con Supabase Auth; API verifica identidad y aplica permisos por objeto; Prisma solo en servidor | Definir rol BD, exposición de Data API, RLS y Storage. Prisma no hereda permisos del JWT automáticamente |
| Logística/solver | Datos de transporte de demo confirmados con origen/unidades; reglas y búsqueda acotada determinísticas | Horizonte, tamaño máximo, objetivo y desempate; declarar límite si no se demuestra óptimo |
| Modelos del producto | Evaluar Gemini Flash 3.8 por Vertex con el contrato previsto | Validar integración API de producto aparte de OpenCode, modelo disponible, acceso, límites y costo observado; sin sustitución automática |
| Archivos | Texto, PDF, imagen y audio con límites por formato y consentimiento | Tamaños, formatos, conservación/borrado, fuente y alternativa manual; fixture gold por formato |

Estas son recomendaciones, no aprobaciones retroactivas. El plan puede prepararse sin cerrarlas; un bloque de código espera solo las decisiones que afecten sus contratos. Identidad visual/nombre y duración de demo pueden cerrarse sin bloquear permisos o perfil.

## Secuencia de ejecución y condiciones de salida

Condición inicial del plan histórico: todos los bloques empezaban pendientes (ver estado vigente al cierre). Cada uno necesita una [orden concreta](PLANTILLA_TAREA_DESARROLLO.md), cambios revisables y evidencia de la versión actual. No asignar tareas a Mainor o Giovanny sin acordarlo.

### D1 — Base común, acceso y entorno aislado

Dependencias: decisiones técnicas de D0 que afecten esta base.

1. Comprobar repositorio/archivos existentes; fijar estructura de frontend, API y contratos compartidos, versiones y arranque local. Preferir un monolito modular, sin microservicios.
2. Preparar configuración de ejemplo sin secretos, scripts de arranque/verificación y entorno de pruebas separado. Confirmar destinos antes de aplicar cualquier migración futura.
3. Implementar Supabase Auth, usuario de aplicación y contexto de organización/membresía. Sesión válida no permite consultar otro candidato. No guardar contraseñas en tablas propias.
4. Crear solo tablas/contratos necesarios para D2: perfil/versiones/experiencia/restricciones, fuentes, catálogo inicial, confirmación y traza; evolución incremental después. Elaborar esquema y migración revisables antes de ejecutarlos.
5. Trasladar tokens semánticos claro/oscuro, Source Sans 3 y componentes mínimos desde Figma: controles, validación, pasos, avisos, cabecera, navegación inferior. Añadir componentes por necesidad, sin reproducir las 166 vistas como páginas distintas.
6. Preparar dos candidatos y organizaciones de prueba para verificar aislamiento, sin datos personales reales. La preparación de cuentas usa mecanismo controlado, sin exponer altas privilegiadas al navegador.

Salida: iniciar/cerrar sesión, validar sesión caducada y acceso ajeno denegado; temas y navegación adaptables a 320/390/escritorio, teclado/foco y estados de error. Pruebas de API/autorización y E2E breve de acceso sobre entorno aislado. Sin llamada LLM para login.

### D2 — Primer bloque del joven: registro y perfil (CU01, CU16)

Dependencia: D1. Agente: A02 modo perfil; C02/C03 desde la primera escritura.

1. Cuenta → Experiencia → Disponibilidad → Revisión, con volver, guardar borrador privado y continuar sin perder datos.
2. Comenzar por texto/experiencia informal sin CV. A02 pregunta faltantes y propone competencias con fuente, sin inventar empleos ni diplomas. No implementar una entrevista fija como prueba de autonomía: A02 debe decidir aclaraciones y usar herramientas permitidas.
3. Registrar intereses de puesto, experiencia, formación declarada, disponibilidad, zona aproximada, movilidad, salario y presupuesto con unidades; desconocido es distinto de cero.
4. Revisar sugerencias y permitir aceptar/rechazar/corregir; confirmar crea versión. Confirmar perfil no comparte con empresas ni orientador.
5. Mostrar Inicio vacío y siguiente acción real; progreso de registro indica pasos completados, no porcentaje de empleabilidad. Retomar un borrador desde la etapa pendiente.
6. Alcance de formatos de D2 decidido por el usuario el 2026-10-17: texto escrito o pegado y CV en PDF digital con texto seleccionable. Conservar revisión, fuente/versión y alternativa manual. Fotos, imágenes, PDF escaneado/OCR y audio quedan fuera del cierre D2 y pendientes de una ampliación posterior. Esta decisión acota la etapa; no elimina los requisitos originales de la hackathon ni los declara satisfechos.

Salida: joven sin CV confirma y vuelve a consultar su perfil; sugerencia rechazada no reaparece como dato confirmado; candidato B no ve datos de A; caída de Vertex conserva borrador y permite continuar manualmente. Cubrir E12–E16 según formato implementado, X01/X13 e I02. Registrar prueba manual y automática por separado.

### D3 — Explorar oportunidades y entender brechas (CU03, CU16)

Dependencia: D2; vacantes de fixture con requisitos confirmados, catálogo y logística conocida/desconocida.

1. Inicio y Explorar: Empleos/Cursos, filtros, detalle y motivos; datos sintéticos visibles, sin estadísticas inventadas.
2. C01 calcula restricciones duras y cobertura con numerador, denominador y desconocidos. Usar requisitos de la vacante, no imponer referencias genéricas del puesto.
3. Integrar A03: decide aclaraciones, consulta C01 y explica cumple/falta/desconocido/entrenable. No cuenta dinero, viajes o puntuaciones por sí mismo.
4. Conservar versiones del cálculo; un cambio de perfil/oferta vuelve obsoleto el resultado dependiente. Explorar no comparte perfil ni reserva nada.
5. Feed deriva próxima acción, próximo evento y continuidad de los módulos existentes con reglas de prioridad; no agregar un agente de feed.

Salida: distinguir viable/inviable/pendiente ante salario, transporte y horario; cambio solo nombre/género no altera cálculo, logística fija. E05–E08/E17–E18, X13 e I03. Comparar resultados C01 con fixtures esperados, no solo capturas.

### D4 — Formación, ruta y reserva del joven (CU04, CU12, CU15)

Dependencia: D3; cursos/mapas y ediciones revisados de fixture. Para el recorrido acompañado, habilitar D8 antes de confirmar la acción que dependa de esa revisión; no simular aprobación del orientador.

1. Explorar Cursos y detalle separan temario/resultados esperados, prerrequisitos y condiciones de la edición.
2. A05 recibe brecha/meta directamente o desde A03 y solicita C01; comparar costo total, agenda, traslados, cupos y brecha residual. La ruta es condicional cuando dependa de aprendizaje futuro no acreditado.
3. Mi ruta: Plan/Formación/Postulaciones/Práctica. Confirmar plan guarda versión; no matricula ni acredita competencias.
4. Reserva concreta: mostrar edición/condiciones/versiones y confirmación del joven. C03 revalida bajo C02 y transacción corta registra una reserva, cupo y agenda coherentes. LLM fuera de transacción.
5. Idempotencia, lectura por clave tras timeout, conflicto de última plaza y cancelación que libera una vez. Alternativa exige nueva confirmación; fallo de cálculo posterior no revierte cancelación válida.
6. Agenda deriva sesiones e historial; progreso del curso distingue reserva, sesiones, finalización y certificado. No inventar asistencia ni emitir certificado.

Salida: dos candidatos sobre última plaza → una reserva; repetición → mismo recibo; prerrequisito desconocido/futuro → cero descuentos; revisión obsoleta → bloqueo. E02–E05/E09/E10/E19, X05/X14/X15 e I05/I06.

### D5 — Materiales, postulación y práctica privada (CU05, CU06)

Dependencia: D3; D4 solo si la acción depende de un plan formativo.

1. A04 adapta CV o prepara primer CV desde perfil confirmado; dueño revisa y confirma sin sobrescribir original.
2. Consentimiento específico por empresa/vacante/materiales/versión, separado de acompañamiento; confirmar postulación persistida e idempotente.
3. Mi ruta/Postulaciones permite consultar y retirar; revocación corta acceso futuro y procesos afectados según RGN07, con historial mínimo restringido. Postular consume cero plazas de empleo.
4. Práctica A04 independiente con texto/audio confirmado, retroalimentación orientativa, guardado voluntario y borrado conforme a política. Nunca alimentar selección con respuestas privadas por defecto.

Salida: sin permiso no hay exposición; reintento no duplica; retirada revoca acceso; CV no contiene afirmaciones inventadas; reclutador no ve práctica. E02/E03/E19/E20, X03/X11 e I04/I07.

### D6 — Reclutador y entrevista bilateral (CU07–CU10, CU15, CU17)

Dependencias: D3 y D5; identidad de empresa desde D1. No autorizar acceso global al probar un cambio de perfil.

1. Resumen y sidebar de gestión; membresías/invitaciones propias, aceptación de identidad y revocación efectiva. Impedir autoescalamiento o eliminar último administrador sin sustituto.
2. A01 interpreta oferta texto/PDF/foto/WhatsApp pegado; propone puesto, requisitos y alertas con fuentes. Reclutador corrige/confirma y C02 exige revisión semántica de esa versión antes de publicar.
3. Candidaturas de sus vacantes con consentimiento vigente; A03/C01 proponen selección con capacidad distinta de empleo. Empresa confirma lista; no contratación automática.
4. A04 ayuda a proponer entrevista; candidato y empresa aceptan la misma versión, agenda/logística revalidadas. Contrapropuesta invalida aceptaciones anteriores; resultado empresarial lo registra reclutador.
5. Tendencias dentro de Vacantes: conteos determinísticos deduplicados, periodo/cobertura/fuente; A01 explica sin inventar cifras nacionales.

Salida: publicar oferta normalizada o bloquear alerta sin bypass; otra empresa no ve candidaturas; entrevista no existe sin ambos acuerdos; selección/entrevista/postulación conservan estados y capacidades distintos. E04/E10/E11/E15/E17–E20, X01/X03–X06/X08/X12/X15 e I01.

### D7 — Centro, temario, banco y evidencia (CU11, CU13, CU02)

Dependencias: D4 y D1. Reemplazar fixtures por gestión real de la misma estructura.

1. Centro gestiona contenido y ediciones propias; temario → unidad → resultado esperado → competencia con fragmento y versión. A01 propone, centro confirma mapa.
2. Edición con sesiones, modalidad, sede/precio/capacidad conocidos. Banco pendiente no bloquea publicación o reserva válida.
3. A02 propone preguntas/rúbricas sobre mapa confirmado; centro revisa banco propio. Separar soluciones internas de preguntas entregadas al candidato.
4. Registrar finalización de participante propio y adjuntar certificado ya emitido, opcional. Finalización no acredita automáticamente todo el temario.
5. Joven registra curso previo interno/externo y consiente microevaluación; C01 corrige objetivas, A02 da retroalimentación orientativa sobre abiertas. Evidencia limitada al ejercicio y asociación confirmada por joven.
6. Versionar mapa/banco/rúbrica/intento sin recalificación retroactiva. Curso externo sin temario admite registro declarado o diagnóstico general marcado, no verificación inventada.

Salida: centro ajeno denegado; publicar sin banco es posible; banco no aprobado no verifica ese curso; preguntas ajenas rechazadas; editar temario no cambia intento pasado. X02/X07/X09–X12/X14, E09/E13 e I01/I02.

### D8 — Orientador independiente (CU14, CU16)

Dependencias: D4; activar antes del primer recorrido de reserva que dependa de plan acompañado.

1. Joven autoriza orientador identificado y alcance; bandeja muestra solo jóvenes autorizados, sin acceso global a CV, respuestas o práctica.
2. Revisar motivos/brecha/ruta con A03/A05; correcciones son propuestas y joven confirma sus datos antes de nueva revisión.
3. Registrar revisión de versión exacta; plan, factibilidad y revisión siguen dimensiones separadas. Revisar no reserva, postula o contrata.
4. Revocar corta lecturas futuras y revisiones pendientes; cambiar dependencias deja revisión desactualizada. No anular por ello reservas independientes ya confirmadas.

Salida: acceso ajeno/revocado denegado; aprobar versión antigua falla; joven puede rechazar corrección; orientador no actúa por empresa ni centro. E02/E03/E10/E11, X01/X04/X11/X15.

### D9 — Integración real, evals y entrega

Dependencias: recorridos anteriores. Pruebas y bitácora se acumulan desde D1; esta etapa integra y cierra.

1. Verificar invocación individual A01–A05 con entradas suficientes y casos I01–I07; ejecutar I08/E01 con al menos tres agentes reales comunicados, herramientas y mensajes correlacionados.
2. E2E de historia completa con sesiones aisladas por actor, datos reiniciables y acciones consultables; ruta candidato→empresa y centro→curso→evidencia→ruta→reserva. Probar reacomodo y fallos de proveedor sin efectos ficticios.
3. Ejecutar los 20 casos E01–E20; mínimo oficial ≥15 con métricas/resultados reales. Añadir X01–X15/I01–I08 según cobertura; no contarlos dos veces ni convertir fixtures/mocks en prueba de acceso real al modelo.
4. Publicar resultados sanitizados con fecha, revisión/huella, fixture/gold, modelo/proveedor real, comando, umbral, medición, aprobación/efecto y pendiente. Mocks, integración, E2E y evals IA tienen evidencias distintas.
5. Revisar ambos temas, móvil/teclado/foco, formularios, navegación y descubrimiento de Postulaciones; contraste del diseño no demuestra contraste correcto del código.
6. Completar README reproducible, metodología, diagrama fiel, fuentes y bitácora; ensayar demo alternando perfiles y PPT de módulos. No video por decisión humana, sin afirmar dispensa organizadora.
7. Revisar archivos de entrega: producto y evidencia sanitizada; excluir MAGI, credenciales y registros internos. Commit/push/tag se realizan cuando corresponda a autorización y ventana oficial confirmada, no en esta planificación.

Salida: instalar y ejecutar la misma revisión evaluada; cero fallos críticos de permisos, consentimiento, versiones, capacidad o efectos ficticios. Casos sin ejecutar/fallidos permanecen visibles. No declarar cumplimiento del reto por tener documentos o cinco nombres de agentes.

## Coordinación con Gemini y control de contexto

Usar [guía de implementación y revisión](GUIA_IMPLEMENTACION_Y_REVISION.md). BALTHASAR está configurado en MAGI como `google-vertex/gemini-3.8-flash`; el producto necesita su adaptador propio y comprobación de acceso aparte. Configuración inspeccionada no es disponibilidad futura verificada. Las llamadas a Vertex REST efectivamente ejecutadas para redactar artefactos de despliegue y documentación se registraron en la bitácora; el plan histórico original pudo no requerir llamadas en su redacción inicial.

Codex delimita contrato, bloque y archivos; Gemini escribe el aporte asignado; integrador ejecuta pruebas; revisión final contrasta cambios y evidencia en ejecución separada cuando se usa MAGI completo. El ejecutor existente reparte tres aportes entre MELCHIOR/BALTHASAR/CASPER: usarlo para bloques que realmente tengan tres unidades disjuntas; un encargo pequeño a BALTHASAR no se anuncia como ejecución completa de MAGI.

Estados de avance: pendiente → listo_para_implementar → en_desarrollo → en_revision → verificado, o bloqueado con causa. Avance D0-01: [registro/perfil concretado](CONTRATO_REGISTRO_PERFIL.md), [API/A02](API_REGISTRO_PERFIL.md) y [aceptación](ACEPTACION_REGISTRO_PERFIL.md), con enlaces y contratos ST01 preservados. D1 completó persistencia remota, RLS y roles; Auth, JWT y API HTTP permanecen pendientes. D2-D9 permanecen pendientes; no crear aplicación por la mera existencia del contrato.

## Avance de esquema y despliegue D1

[Esquema inicial CU01 y migración](ESQUEMA_INICIAL.md), [permisos BD API](PERMISOS_BD_API.md) y [guía de despliegue](DESPLIEGUE_BD.md) completados. Autoría técnica de scripts de despliegue y documentación por Gemini 3.8 Flash Vertex, con delimitación y ejecución por Codex. Despliegue remoto en Supabase ejecutado y verificado exitosamente (2026-10-16): 25 tablas en esquema `app`, migración registrada en `_prisma_migrations`, 25 políticas RLS aplicadas, rol no-owner `equipo10_api` activo y prueba transaccional con rollback superada sin datos residuales. Pruebas locales: 30 de esquema PASS, 15 de runtime PASS y 11 de helpers PASS. Siguiente alcance D1: validación JWT, bootstrap de `AppUser` y servicio API HTTP. Storage de aplicación, UI y etapas D2-D9 pendientes.
