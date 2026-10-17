# Acompañamiento del Joven y Especificación de CU14

**Estado:** Diseño documental propuesto, no aplicación implementada. Redacción: BALTHASAR por Vertex AI; título armonizado por Codex con el catálogo final. Ver reglas y ficha vigente en [especificación completa](ESPECIFICACION_CASOS_USO.md).

## 1. Marco y Acuerdos de Autoridad
Se contemplan tres acuerdos de fuente humana: (1) roles separados e independencia del orientador, quien apoya al joven y no pertenece ni decide por empresa alguna; (2) centro formativo registra finalización y adjunta certificado emitido por él, no se genera automáticamente; (3) postulación, reserva y citas son internas y persistidas en el sistema. Las reglas operativas, de concurrencia y guardrails complementarios corresponden a propuestas de diseño de IA.

El orientador es una persona independiente que acompaña únicamente a jóvenes que autoricen dicho acompañamiento mediante consentimiento explícito. No sustituye al candidato, al centro ni al reclutador; no decide contrataciones, no asigna plazas laborales al postular ni impone su asistencia para que el joven edite su CV, practique entrevistas o seleccione empresas. Los guardrails de equidad y no discriminación son mandatorios y técnicamente no eludibles por intervención humana.

## 2. Especificación CU14: Revisar y Aprobar un Plan Juvenil
- **Nombre:** CU14 — Revisar y aprobar el plan del joven acompañado.
- **Objetivo:** Evaluar equidad, coherencia y viabilidad de la propuesta de ruta de un joven que autorizó acompañamiento, aprobando, rechazando o sugiriendo ajustes sobre una versión determinada.
- **Permisos:** Orientador independiente con autorización concedida por el candidato en cuestión. Carece de visibilidad sobre la base global de candidatos o decisiones de contratación de empresas.
- **Disparador:** El candidato solicita acompañamiento o remite a evaluación su propuesta de plan generada tras CU04.
- **Precondiciones:** Consentimiento de acompañamiento activo; propuesta de plan estructurada con identificador de versión; orientador autenticado y asignado.
- **Entradas:** Identificador del joven, versión del plan (metas, cursos seleccionados, tiempos de traslado, costos y brechas estimadas), observaciones y ajustes recomendados.
- **Flujo principal:**
  1. Orientador accede a la propuesta del plan juvenil del candidato que autorizó el acompañamiento.
  2. Orientador examina viabilidad logística, equidad de la ruta y consistencia frente a brechas detectadas.
  3. Orientador formula recomendaciones u observaciones de ajuste sobre los datos o la ruta.
  4. El joven evalúa las recomendaciones y confirma o descarta personalmente cada corrección en su perfil y plan.
  5. Orientador registra la aprobación o rechazo circunscrito a la versión concreta del plan juvenil confirmada por el joven.
  6. El sistema almacena la aprobación versionada y habilita la prosecución hacia reservas formativas internas (CU12).
- **Flujos alternos ligados a pasos:**
  - *1a (Paso 1 - Consentimiento revocado o no otorgado):* Se deniega el acceso a la ficha del plan; finaliza el caso de uso sin consulta.
  - *2a (Paso 2 - Alerta de discriminación o trasgresión de guardrail):* El sistema bloquea el flujo; el bloqueo es ineludible y no puede ser superado por el orientador ni otro actor.
  - *4a (Paso 4 - Joven rechaza corrección sugerida):* El plan conserva su estado anterior o se descarta la modificación; el criterio del orientador no se impone.
  - *5a (Paso 5 - Alteración previa de cupo, horario o contenido en el curso):* La versión bajo revisión queda invalidada; se requiere recálculo y nueva evaluación.
- **Consentimiento y revocación:** El candidato puede revocar la autorización de acompañamiento en cualquier momento. La revocación suspende de inmediato la visualización del orientador e invalida revisiones pendientes.
- **Salidas y estados:** Estados: *Aprobado* (versión fijada para CU12), *Rechazado* o *Pendiente de corrección*. Salida: registro trazable de aprobación asociado a la versión.
- **Herramienta real prevista y traza:** Componente de auditoría (CU16) sobre almacén transaccional persistente, registrando fecha/hora, identificador de orientador, identificador de candidato, versión evaluada, dictamen y justificación.
- **Criterios verificables:**
  - Aprobación válida exclusivamente para la versión exacta del plan juvenil.
  - Imposibilidad de alterar datos del perfil o plan sin confirmación directa del joven.
  - Restricción técnica absoluta para que el orientador asigne plazas laborales, matricule o reserve cupos por cuenta propia.
