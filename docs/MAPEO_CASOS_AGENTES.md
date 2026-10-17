# Mapeo de casos, actores y agentes — revisión 2

Actualización 2026-10-17: esta matriz asigna responsabilidades del diseño a CU01–CU17; no declara que todas sus filas estén implementadas. Estado por caso en [la cobertura actual](CASOS_DE_USO.md#cobertura-actual-por-caso). Reparto de [arquitectura](ARQUITECTURA_AGENTES.md): A01 Vacantes/contenido; A02 Perfil/aprendizaje; A03 Compatibilidad/brechas; A05 Formación implementados por modos con los límites de sus informes. A04 Postulación/práctica/coordinación sigue aplazado. C01 cálculos, C02 seguridad/equidad/trazas y C03 flujo/acción son código, no agentes LLM adicionales. El antiguo A05 Auditor migra a C02. No se requiere IA para cada operación. [Colaboración real, prompts y herramientas](COLABORACION_AGENTES.md).

Todos los casos incorporan C02 para permisos por objeto y trazas; solo los agentes listados participan cuando hay interpretación/generación. «Secundario» no implica acceso automático a datos personales; los permisos se delimitan por candidato, organización, consentimiento y propósito. Las fichas funcionales siguen en [especificación](ESPECIFICACION_CASOS_USO.md); los IDs CU se conservan.

Las colaboraciones son dependencias de información, no obligación de invocar toda la cadena cada vez. Cada rol puede atender un encargo aislado con entradas confirmadas, usar sus herramientas y responder completo/pendiente/bloqueado/error según [contrato de autonomía](AUTONOMIA_CONTRATOS_MODELOS.md). I01–I08 complementan la cobertura cooperativa E01 y la acción real E03.

| CU | Actor principal / secundarios autorizados | Agente responsable | Colaboración o condición | Herramienta/resultado | Confirmación humana | Evals |
|---|---|---|---|---|---|---|
| CU01 | Candidato / orientador autorizado | A02 | Catálogo común y extracción; no A01 para cada CV | C03 guardar perfil y evidencias/versiones | Joven confirma datos/etiquetas; acompañamiento separado | E12–E16, X01 |
| CU02 | Candidato / centro solo banco de su curso, orientador autorizado | A02 | A01 interpreta temario; mapa/banco revisados por centro si es su curso; A03 recalcula brechas | C01 corrección objetiva; C03 guardar intento/evidencia | Centro confirma contenido/banco propio; joven consiente evaluación y confirma evidencia; nadie certifica por IA | E09/E13, X02/X09–X12 |
| CU03 | Candidato / orientador; reclutador solo CU09 | A03 | A01 vacante y A02 perfil confirmados; deriva a A05 si falta formación | C01 restricciones/cobertura/solver, sin reservar | Joven elige; no comparte por explorar | E01/E04–E08/E17–E18 |
| CU04 | Candidato / orientador autorizado | A05 | A03 entrega brecha; A01 resultados esperados de curso; A02 evidencia | C01 planificador, C03 guardar plan | Joven confirma; orientador revisa solo plan acompañado | E09/E02/E03, X02/X09 |
| CU05 | Candidato / reclutador de vacante consentida | A04 | A02 perfil; A03 compatibilidad | C03 postulación idempotente, sin ocupar plaza laboral | Joven confirma materiales y autorización específica | E02/E03/E14/E19/E20, X03 |
| CU06 | Candidato / sin empresa por defecto | A04 | A01 oferta/A02 experiencia; no confundir con microevaluación CU02 | Transcripción y C03 práctica privada | Joven confirma transcripción y guardado/compartir por separado | E16/E20, X01 |
| CU07 | Reclutador de su empresa | A01 | C02 bloqueos de contenido/alcance; A03 reevalúa dependencias | Extracción y C03 publicar/cerrar vacante | Empresa confirma requisitos, etiquetas y correcciones | E11–E15/E17–E18, X01 |
| CU08 | Administrador de empresa | Ninguno requerido | Flujo determinístico de identidad/membresía | C03 gestionar permisos, C02 limitar ámbito | Administrador propio confirma, sin autoescalamiento | X01/X04 |
| CU09 | Reclutador / candidato titular de postulación | A03 | A01 requisitos y A02 evidencia autorizada; A04 coordina salida confirmada | C01 selección con capacidad; C03 lista corta | Empresa confirma; consentimiento candidato vigente | E04/E17–E19, X03/X05 |
| CU10 | Reclutador y candidato | A04 cuando propone alternativas | C01 disponibilidad/traslado; sin LLM para registrar resultado empresarial | C03 cita interna y avisos idempotentes | Ambas partes confirman misma versión; orientador no entrevista por empresa | E05/E10/E19, X06 |
| CU11 | Representante del centro | A01 | A02 propone banco/rúbricas sobre mapa confirmado; A05 consume ediciones | C01 valida edición; C03 guardar contenido/mapa/banco/cupos | Centro confirma temario, etiquetas, banco y edición propios | E09/E13, X02/X05/X09–X11 |
| CU12 | Candidato / centro por edición publicada | A05 si explica alternativa de ruta | A04 puede coordinar solicitud; acción directa UI no necesita generar texto | C01 revalida; C03 reserva y agenda indivisibles | Joven confirma; aprobación de plan acompañado si aplica; centro ya autorizó edición | E02–E05/E09/E19, X05 |
| CU13 | Representante del centro / candidato participante | Ninguno requerido | A02 solo si luego joven solicita CU02; no se invoca para certificar | C03 finalización y certificado adjunto, no generado | Centro confirma resultado; joven decide vincular evidencia | X02/X07 |
| CU14 | Orientador independiente / candidato que autorizó | A03 y A05 como apoyo | A02 evidencia compartida; C02 verifica acompañamiento | C03 registrar revisión versionada del plan | Joven confirma correcciones, orientador su revisión; no ejecutan por empresa/centro | E02/E03/E10/E11, X01/X04 |
| CU15 | Dueño de evento según caso | A04 para coordinar alternativas | A03 recalcula selección; A05 recalcula formación; no IA para cancelar | C01 recalcula, C03 cancela/libera una vez y agenda alternativa confirmada | Dueño cancela; nueva actividad exige confirmaciones propias | E10/E19, X03/X06 |
| CU16 | Cada actor en su ámbito; orientador solo acompañados | Ninguno requerido para leer traza | A01/A02/A03/A05 explican solo sus decisiones cuando se pide; C02 no es agente LLM | C02 consulta/audita/contrafactual; C03 registra resolución | Dueño confirma corrección; ningún humano elude bloqueo | E11/E12/E17–E19, X01/X12 |
| CU17 | Reclutador/orientador con acceso agregado | A01 explica conteos | C01 agrega únicamente ofertas publicadas permitidas, sin personas | Conteos deduplicados con fuente/periodo; no escribir candidaturas | Consulta autorizada, sin nueva aprobación para cada lectura | E13, X08 |

## Fuentes por actor y datos que pueden circular

- Empresa entrega requisitos de vacante; no recibe currículo completo de todo joven ni banco de respuestas privadas del centro/candidato.
- Centro entrega temario y resultados esperados; puede revisar banco y registrar finalización de participantes propios. No recibe CV, restricciones personales o respuestas de un curso externo por el hecho de publicar formación.
- Candidato aporta experiencia y respuestas; A02 convierte esto en evidencia propuesta, no en verdad confirmada ni certificado. Para empresa comparte solo versión/resumen consentido; práctica privada CU06 no se adjunta automáticamente.
- Orientador accede únicamente al joven que autoriza acompañamiento; C02 aplica la misma frontera aunque varios agentes participen.

## Compatibilidad con los requisitos

O01 se demuestra con comunicación real, no con esta tabla: recorrido de demo A01 contenido/vacante → A02 perfil/evidencia → A03 brecha → A05 ruta → A04 postulación/agenda, según caso. O02/O03 se cumplen mediante C01/C03 ejecutados, O04 por confirmaciones y orientador cuando corresponde, O05/O07 mediante C02 y eventos. S07 no se elimina al quitar el agente Auditor independiente. Evals y diagrama final deberán mostrar herramientas y mensajes realmente implementados.

Detalle de datos propuesto en [catálogos de puestos, competencias y cursos](CATALOGOS_CURSOS_PUESTOS_HABILIDADES.md): A01 distingue puesto canónico/título original de habilidades; mapa de curso conserva fuente y resultados esperados, A02 pregunta y documenta evidencia; los17casos mantienen sus IDs.

Revisión integral: [dos recorridos y plan](REVISION_INTEGRAL_PLAN.md). CU01/CU03/CU04/CU07 referencian puestos/competencias y fuente/versiones; CU04/CU12 verifican prerrequisitos sin atribuir resultados futuros al perfil. X13–X15 cubren estas dependencias y los estados separados del modelo. Roles A01–A05 no cambian; no modelos nuevos ni acciones externas.
