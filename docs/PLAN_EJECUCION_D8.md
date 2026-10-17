# D8 — Orientador independiente: ejecución acotada

Estado: PLAN PROPUESTO PARA IMPLEMENTAR. Preparado por Codex el 2026-10-17; no constituye ejecución ni verificación de D8.

## Resultado observable

El joven solicita revisión de una versión concreta de su ruta a un orientador identificado. Este ve exclusivamente lo autorizado, propone aclaraciones y registra una revisión motivada. El joven conserva la decisión sobre sus datos y acciones. Revocar impide accesos futuros. Ninguna aprobación reserva, postula, contrata o certifica.

Referencias mínimas: AGENTS.md; PLAN_DESARROLLO_ETAPAS.md sección D8; ESPECIFICACION_CASOS_USO.md CU14/CU16 y RGN01/02/07/08/09/11/12; GUIA_IMPLEMENTACION_Y_REVISION.md; REGLAS_COMPONENTES_CAPAS.md; INTEGRACION_D5_D7.md como estado de integración. No volver a leer todos los documentos de D1–D7.

Diseño: ENTREGA_REDISENO_FIGMA_V2.md, orientador nodo 43-3610 del archivo cWPzNNsLPoUenKyfhf4Diu. Reutilizar shell, navegación, tarjetas, formularios y tokens de AImpulsa; terracota/marfil/carbón/oliva, claro y oscuro. Consultar las skills pertinentes antes de herramientas Figma. Si no hay acceso, declarar límite y reutilizar componentes existentes; no afirmar fidelidad comprobada ni detener backend por ello.

## Alcance y límites

- Una bandeja de jóvenes/planes autorizados, un detalle de revisión y un panel del joven en Mi ruta. Sin CRM, chat, correo, agenda nueva, tendencias, analítica ni notificaciones externas.
- CU16 limitado a las decisiones, reglas, fuentes, alertas y revisiones de ese plan autorizado. No construir una consola universal de auditoría ni declarar todo CU16 terminado.
- Reutilizar explicaciones A03/A05 ya persistidas y autorizadas. Ausencia de explicación se muestra como pendiente; falta de traza crítica bloquea aprobación. No inventar motivos ni añadir un agente LLM para operaciones CRUD. Mantener Vertex en integraciones existentes; no cambiar proveedor o modelo.
- No abrir CV original, borradores, respuestas privadas, práctica, certificados o datos de empresa por el simple acompañamiento. Compartir solo el resumen confirmado necesario para la versión de plan elegida.
- No refactorizar D1–D7 ni completar pendientes históricos de D7. Sin nuevas dependencias salvo bloqueo demostrado.

## Hallazgos de partida y decisiones para el prototipo

LearningPlan ya tiene id, version, revisionId, targetOpportunityId, catalogVersionId, estado, factibilidad y outdated. Reutilizar estos datos: no crear un segundo planificador. No se observó un modelo de acompañamiento ni rol de orientador en MembershipRole; esta membresía representa empresas y centros, no al orientador independiente.

Proponer un registro mínimo de orientadores habilitados por configuración administrativa controlada, asociado a AppUser, separado de OrganizationMembership. Sin endpoint público de autoasignación de rol; el selector visual nunca autoriza. Fixture local con cuentas sintéticas; no crear usuarios remotos reales para probar. El candidato elige entre orientadores habilitados con identidad visible, sin exponer un directorio de todos los usuarios.

Cada solicitud comparte un plan y su versión con un orientador. La autorización registra candidato, destinatario, propósito, alcance, snapshot/versiones, fecha y revocación. Cambiar la versión exige nueva solicitud/aceptación de su alcance; no ampliar consentimiento automáticamente. Repetir una solicitud revocada con la misma clave no la reactiva.

La reserva actual acepta plan_id y lo persiste; el código inspeccionado no muestra una validación de revisión del orientador. Incorporar el control en servidor, sin confiar en una bandera enviada por el cliente.

## Bloques verticales, en este orden

### D8-0 — Contratos y persistencia

Antes de implementar, inspeccionar únicamente los callers de planificación/reservas, sesión/identidad y recibos. Escribir un contrato breve en CONTRATOS_D8.md con rutas, DTO, estados, errores y lista exacta de archivos a tocar. Seguir el estilo de controllers/services/modules y contratos Zod existente.

Modelos mínimos propuestos: registro de orientador, solicitud/consentimiento de acompañamiento, revisión y propuesta de corrección con decisión del joven. Ajustar nombres a convenciones reales. La revisión conserva planId + planVersion + revisionId y versiones de dependencias relevantes/snapshot verificable. Un cambio de perfil, oferta, catálogo o edición utilizado por el plan invalida su revisión. Reutilizar la comprobación de vigencia existente, ampliándola solo si resulta insuficiente.

Estados de solicitud: solicitada, en revisión, por aclarar, aprobada, rechazada, desactualizada, revocada. No mezclarlos con factibilidad del plan ni confirmación del joven. Propuesta de corrección: pendiente, aceptada o rechazada; aceptar no significa aplicar cambios de perfil sin sus validaciones normales.

Preparar migración incremental posterior a la última existente (actualmente 202610170009_company_scope; comprobar nuevamente), índices, restricciones y RLS. Conservar migraciones anteriores y datos. Extender el helper de despliegue usado en integración con check/apply/verify si procede; no ejecutar reset, db push destructivo ni semillas de demo en Supabase remoto.

### D8-1 — Solicitud, consentimiento y revocación

Joven: panel «Pedir apoyo de un orientador», seleccionar destinatario y versión de ruta, explicar qué comparte y confirmar explícitamente. Mostrar estado persistido tras recarga y acción «Dejar de compartir».

API: crear/listar solicitudes propias y revocar; orientador: listar solo solicitudes vigentes dirigidas a su identidad y consultar su detalle mínimo. Identidad desde sesión verificada, autorización por objeto en servicio y RLS. Para objetos ajenos usar el patrón de denegación existente sin revelar su existencia.

Mutaciones con idempotencia y auditoría transaccional. Revalidar permisos antes de servir recibos o replays sensibles. Revocar corta también acceso por URL directa, endpoints auxiliares y recibos; no borrar historia ni cancelar reservas independientes ya confirmadas. Evitar carreras entre revocación/aprobación mediante bloqueo u optimistic concurrency dentro de la transacción.

### D8-2 — Bandeja y revisión humana

Orientador: bandeja con nombre autorizado, objetivo, fecha y estado; detalle con resumen permitido, brechas, factibilidad calculada, pasos de ruta, motivos/incertidumbres y trazas sanitizadas pertinentes. No mostrar JSON técnico ni identificadores de campos al usuario.

Acciones: pedir aclaración/proponer corrección, aprobar o rechazar con motivo. La escritura exige versión esperada y autorización vigente. Cambió plan/dependencias: conflicto 409 y pedir recargar/recalcular; nunca aprobar una versión antigua. Factibilidad inviable, bloqueo discriminatorio o traza crítica incompleta no se eluden con aprobación humana.

Joven: leer propuesta y aceptarla o rechazarla. Rechazar conserva sus datos. Aceptar conduce al editor existente para confirmar la corrección, recalcular y solicitar nueva revisión; no aplicar texto libre como actualización automática de campos. Conservar vínculo y resolución en historia. La aprobación solo registra revisión; no ejecuta acciones del joven.

### D8-3 — Integración con Mi ruta y reserva

Mostrar por separado «Viabilidad», «Tu confirmación» y «Revisión del orientador». Loading visible, botones deshabilitados mientras procesan, estados vacío/error/reintento y mensajes comprensibles. No perder contexto al volver o recargar.

Si una acción deriva de una ruta enviada a revisión, exigir revisión aprobada y vigente más confirmación explícita del joven antes de reservar. El servidor resuelve esta condición desde el plan/solicitud persistidos. No permitir eludirla omitiendo plan_id en la misma acción de ruta ni borrando el estado de revisión. La reserva independiente sin ruta acompañada sigue permitida con los controles normales de D4; distinguir ambos contextos sin imponer orientador obligatorio a todos.

Revalidar autorización, versión, dependencias y revisión en la misma transacción que el efecto, conservando controles de cupo, agenda e idempotencia. Un replay de una reserva ya confirmada devuelve su recibo sin ejecutar una nueva ni cancelarla por revocación posterior.

### D8-4 — Verificación y entrega

Crear pruebas dirigidas con fixtures sintéticos en base aislada verificada. Nunca reutilizar un helper que limpie otro puerto/base sin comprobar su destino. Cobertura mínima:

1. Consentimiento exacto: destinatario autorizado consulta solo campos/plan compartidos; otro usuario no consulta ni por ID conocido.
2. Cuenta de empresa/centro y selector del navegador no conceden rol de orientador ni acceso global.
3. Revocación corta detalle, escrituras y recibos alternativos; replay de consentimiento no reactiva acceso.
4. Aprobación concurrente con revocación no produce aprobación utilizable sin autorización vigente.
5. Cambio de versión de plan o dependencia rechaza aprobación/reserva obsoleta.
6. Aceptar/rechazar propuesta conserva la autoridad del joven; ningún texto libre modifica el perfil por sí solo.
7. Aprobación no altera cupos, crea reservas/postulaciones ni cambia factibilidad; bloqueo crítico persiste.
8. Ruta acompañada pendiente/rechazada/revocada no reserva; aprobada vigente requiere además confirmación del joven. Ruta no acompañada conserva flujo D4.
9. Reintento no duplica revisiones, solicitudes ni reservas; revocar no cancela una reserva ya confirmada.
10. Detalle y traza no filtran CV, práctica, respuestas privadas, secretos ni datos de otra organización.

Un recorrido de navegador: joven solicita → orientador propone aclaración → joven la rechaza conservando datos → orientador revisa versión válida → joven ve revisión y confirma su acción → revoca → orientador pierde acceso. Verificar persistencia tras recargar y carga con botón deshabilitado. Si se usa autenticación sintética, declararlo; no presentarla como validación live de Supabase Auth.

Ejecutar suite D8 y regresión focal de planificación/reservas tocadas; un typecheck y build finales. Si falla, corregir y repetir solo lo afectado. No repetir suites completas D1–D7, llamadas Vertex, ni build por cada cambio sin nueva causa. No confundir pruebas técnicas con evals semánticas oficiales E01–E20.

Comprobar que tablas/políticas estén aplicadas en la BD utilizada por la API antes de declarar la pantalla funcional, evitando repetir P2021 de etapas anteriores. Para remoto, usar despliegue aditivo check/apply/verify del proyecto y no introducir datos sintéticos. Sin autorización operativa aplicable o acceso suficiente, entregar migración y declarar despliegue pendiente; no afirmar cierre funcional en ese entorno.

Actualizar bitácora IA con autoría real, plan por etapas y un informe D8_ENTREGA.md: implementado, ejecutado, pendiente, archivos, migración/destino sanitizado, comandos y resultados, pruebas negativas y límites. CU16 permanece parcial. Sin commit/push ni modificaciones de MAGI, credenciales o archivos ajenos.

## Disciplina para terminar pronto

Realizar una lectura focal inicial, fijar contratos y completar bloques en secuencia. Comunicar avance por bloque y continuar sin pedir aprobación rutinaria. No llamar LLM dentro de transacciones. No realizar refactors cosméticos o pruebas en bucle. Una vez cumplida la aceptación, detener ampliaciones y entregar evidencia. Si surge un bloqueo real, informar punto exacto y trabajo restante; no esconder fallos como fallback exitoso ni prometer un tiempo que no esté medido.
