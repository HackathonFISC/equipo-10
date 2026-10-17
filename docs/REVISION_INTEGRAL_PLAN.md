# Revisión cruzada de CU, agentes, datos y plan

Fecha: 2026-10-16. Estado: revisión documental integrada, con decisiones pendientes explícitas; no desarrollo ni aprobación humana global. Primera referencia: análisis de Codex sobre documentos vigentes. Segunda referencia: [BALTHASAR, Gemini 3.8 Flash por Vertex](REVISION_BALTHASAR_CU_AGEN_DATOS.md), lectura/escritura verificadas de un paquete acotado con extractos literales y síntesis identificados. La petición amplia inicial agotó240segundos sin informe; la tarea acotada sí produjo informe. No afirmar que Gemini leyó todos los originales. Las referencias de proceso siguientes son recorridos funcionales, no entrevistas con usuarios ni pruebas del producto.

Fuentes: [requisitos](REQUISITOS.md), [17 CU](ESPECIFICACION_CASOS_USO.md), [agentes](AGENTES.md), [arquitectura](ARQUITECTURA_AGENTES.md), [autonomía](AUTONOMIA_CONTRATOS_MODELOS.md), [modelo de datos](MODELO_DATOS_MODULOS_PROPUESTA.md), [catálogos](CATALOGOS_CURSOS_PUESTOS_HABILIDADES.md) y [entregables](ENTREGABLES.md). Se conserva el enunciado original local en `magi/contexto/RETO_OFICIAL.md` como fuente de §2/§5/§6; no reescribirlo.

## Acuerdos humanos frente a propuestas técnicas

| Tema | Estado | Consecuencia para el plan |
|---|---|---|
| Orientador independiente que ayuda al joven | Confirmado por el usuario | Acompañamiento autorizado y alcance limitado; no actuar por empresa/centro |
| Finalización y certificado del centro | Confirmado | Adjuntar documento existente, no generar certificación por IA |
| Acciones internas aprobadas y persistidas | Confirmado | Postulaciones/listas/reservas/citas dentro del sistema; sin envío a plataformas externas |
| Supabase Auth | Confirmado | Identidad externa vinculada a usuario de aplicación y permisos propios; no duplicar contraseñas |
| Registro de candidatos y organizaciones | Confirmado | Candidato se registra; organizaciones mediante cuentas de demo/invitaciones, sin registro público libre |
| Reserva inmediata con descuento de un cupo | Confirmado | Centro autoriza edición al publicar; joven confirma y C03 registra indivisiblemente, sin aprobación posterior individual del centro |
| Catálogos de puestos y competencias, contenido de cursos | Inclusión solicitada por el usuario | Precisar entidades y referencias en CU; campos y políticas aún son diseño para revisión |
| Cinco agentes, C01–C03 y monolito modular | Propuesta documentada | No atribuir aprobación humana de cada detalle ni ejecución real |
| React/TSX, API, Prisma, Bun/Nest y modelos del producto | Diseño técnico candidato; versiones/compatibilidad pendientes | Supabase y ejecución local acordados; no dar Nest/Bun/runtime ni asignación de modelos por validados |

## Referencia de proceso 1: candidato ↔ empresa

| Paso | CU / actor | Agente y código | Datos y permisos | Resultado verificable previsto |
|---|---|---|---|---|
| Preparar empresa | CU08 / administrador de empresa | C02/C03; sin LLM obligatorio | Usuario Supabase Auth, organización, membresía/invitación y alcance | Reclutador activo únicamente en su organización |
| Publicar oferta | CU07 / reclutador | A01 + catálogo; C02 exige revisión semántica | Título original, puesto propuesto/catálogo, requisitos/fuente y versión confirmados | Oferta publicada o bloqueada/por aclarar, sin requisitos inventados |
| Preparar perfil | CU01/CU02 / joven | A02; A01 si hay temario, C01 ejercicio objetivo | Perfil/versiones, interés en puesto y evidencias; privado hasta autorización específica | Perfil con o sin CV, evidencia limitada, desconocidos visibles |
| Comparar | CU03 / joven; CU09 solo empresa autorizada | A03 + C01 + C02 | Requisitos de vacante confirmados, no lista genérica del puesto; logística y versiones | Factibilidad/cobertura/brecha calculadas; no contratación por puntuación |
| Preparar/postular | CU05 / joven | A04 + C03 | CV adaptado o generado desde perfil; permiso empresa/vacante/materiales | Postulación persistida sin consumir plaza laboral |
| Seleccionar | CU09 / empresa | A03 + C01; C03 confirma lista | Evidencia compartida, capacidad selección separada de empleo | Lista corta autorizada y motivada, sin ver base completa |
| Entrevistar | CU10 / reclutador y joven | A04 + C01/C03 | Aceptaciones de misma versión y agenda viable | Cita interna confirmada por ambos, resultado empresarial humano |
| Prepararse en privado | CU06 / joven | A04 | Práctica propia, sin acceso empresarial por defecto | Sesión privada; no alimenta selección salvo resumen voluntario expresamente autorizado |
| Seguimiento y cambio | CU15/CU16 / dueño de cada objeto | A04 coordina, A03 recalcula; C02/C03 | Historial, versiones, autorizaciones y trazas | Cancelación/retirada/reacomodo consistente, sin doble efecto |

Requisitos rastreados: O01–O05/O07/O08; R01–R08 según formato; S01–S03/S05–S07. Evals diseñados E01–E08/E10–E20, X01/X03–X06/X08/X11/X12 e I01–I04/I06–I08. No afirmar resultados hasta ejecutar.

## Referencia de proceso 2: centro ↔ curso ↔ evidencia ↔ formación

| Paso | CU / actor | Agente y código | Datos y permisos | Resultado verificable previsto |
|---|---|---|---|---|
| Publicar contenido y oferta | CU11 / centro autorizado | A01; C01 valida edición, C03 persiste | Curso/versiones, unidad, resultado esperado, etiqueta, prerrequisito y fuente; edición/sesiones/cupos/precio | Mapa confirmado y edición publicada; aprendizaje esperado no atribuido al alumno |
| Preparar preguntas | CU11 / centro | A02; C02 valida fuentes/alcance | Banco/rúbrica ligados a mapa/versiones; centro revisa su banco sin ver perfiles privados | Banco aprobado o pendiente; banco pendiente no bloquea publicar/reservar curso |
| Definir meta/ruta | CU03/CU04 / joven | A03 determina brecha; A05 consulta C01 | Puesto/meta o vacante confirmada, perfil y ediciones; prerrequisitos separados del aprendizaje esperado | Plan viable/parcial/pendiente, con costo/horario/logística y dependencias explícitos |
| Acompañar | CU14 / orientador y joven | A03/A05 explican; C02/C03 limitan | Acompañamiento y revisión de versión exacta | Orientador propone/revisa; joven confirma cambios; no sustitución de voluntad ni autoridad del centro |
| Reservar | CU12 / joven | C01 revalida; C03 registra; A05 explica si hace falta | Edición publicada y cupo actual; requisitos, agenda, autorizaciones y clave única | Reserva inmediata/agenda y un descuento de plaza; nada parcial ni pendiente de aprobación del centro |
| Registrar finalización | CU13 / centro | C03, sin LLM obligatorio | Participante/edición y resultado; certificado existente opcional | Finalización sin dominio automático y documento solo si fue emitido |
| Registrar/verificar aprendizaje | CU02 / joven | A01 contenido si hace falta; A02 preguntas; C01 objetiva | Curso previo o recién completado, banco aprobado, intento/respuestas y fuentes/versiones | Evidencia orientativa o ejercicio verificado específico; no inventar certificado ni exponer respuestas a empresa |
| Actualizar decisiones | CU03/CU04/CU15/CU16 | A03/A05 y C01–C03 | Evidencia confirmada/consentida, nueva brecha y dependencias | Recalcular futuro sin reescribir intentos/certificados pasados; nuevas acciones con nueva confirmación |

Un plan puede explicar una secuencia de aprendizaje futuro; eso no demuestra que el joven ya cumple prerrequisitos de cursos posteriores. Reserva exige comprobar los prerrequisitos aplicables; desconocidos quedan pendientes y no descuentan cupos. Un curso externo sin temario solo admite registro declarado/diagnóstico general marcado, no verificación inventada de ese curso.

Requisitos rastreados: O01–O05/O07/O08, R01–R04/R06–R08, S02–S04/S07; E04–E07/E09/E10/E13–E19, X01/X02/X05/X07/X09–X12 e I02/I03/I05–I08. CU17 cubre tendencias de ofertas y usa solo agregados permitidos con periodo, fuentes y deduplicación: S01/E13/X08. O06 exige ejecutar al menos 15 evals y registrar métricas/resultados, no solo enumerarlos.

## Hallazgos de primera referencia y tratamiento

| ID | Hallazgo de Codex | Documentos afectados / tratamiento realizado o pendiente |
|---|---|---|
| RC01 | Puestos/alias/intereses están detallados en datos, pero CU01/CU03/CU04/CU07 no concretan todas sus referencias | Precisar título original, puesto/etiqueta y fuente/versión, ambigüedad y confirmación sin imponer plantilla genérica de requisitos |
| RC02 | CU04 no explicita comprobación de prerrequisitos de cada curso frente a resultados esperados futuros | Añadir entrada/regla/alterno de secuencia condicional y bloqueo de reserva si no se cumple o desconoce requisito aplicable |
| RC03 | Estados de postulación/plan en fichas iniciales mezclan lista corta/entrevista/revisión, mientras modelo propone entidades separadas | Usar en CU05/CU09 ciclo de postulación y selección aparte; CU04 plan confirmado y CU14 revisión aparte; conservar cambios como decisión técnica de diseño, no aprobación humana inventada |
| RC04 | Algunas descripciones antiguas todavía llaman propuesta a reserva inmediata o no enumeran acuerdos nuevos | Armonizar acuerdo humano sin extenderlo a todos los campos/módulos |
| RC05 | La tabla de20horas inicial no demuestra tiempo restante real ni calendario oficial | Identificarla como estimación histórica y usar condiciones de salida; no recalcular plazo ficticio ni iniciar desarrollo |
| RC06 | Niveles, puesto principal y clasificación de requisitos en dos ejes siguen opciones abiertas | Registrar decisiones pendientes con recomendación y alcance; no aplicarlas como reglas aprobadas en BD/solver |

RC01–RC05 están tratados en fichas/catálogo/flujo; RC06 permanece pendiente de decisión, no es un defecto corregible inventando aprobación. Estos hallazgos son de diseño documental. La coincidencia entre revisores no sustituye decisión humana ni prueba del producto. Informe original del modelo conservado con nota de integración; evidencia local fuera del repo en `magi/contexto/REVISION_INTEGRAL_BALTHASAR_ACOTADA.json` y paquete fuente/huellas en `PAQUETE_REVISION_BALTHASAR.md`; intento amplio fallido en `REVISION_INTEGRAL_BALTHASAR_INTENTO_AMPLIO.json`.

## Comparación de segunda referencia y resolución

| ID | Opinión BALTHASAR | Resolución de integración |
|---|---|---|
| RB01 | Coherencia conceptual, estados separados y privacidad; RC01–RC06 coherentes en resolución teórica | Aceptar como segunda opinión acotada, sin extrapolar a producto ejecutado o revisión íntegra de17fichas por Gemini |
| RB02 | «Ningún agente decide ni publica» | Corregir: cada agente decide interpretación, preguntas, aclaraciones y solicitudes de herramientas; aprobación humana rige acciones clave. No reducir agentes a formateadores de texto |
| RB03 | Ruta condicional frente a reserva con prerrequisitos exige estado proyectado_condicional | Precisar indicador de factibilidad viable/condicional/pendiente/inviable separado del ciclo borrador/calculado/confirmado del plan; no hace falta cambiar el enum para expresar esa frontera. Acciones se revalidan individualmente |
| RB04 | Siguiente curso se habilita tras registrar finalización del anterior | Aceptar solo si esa finalización satisface exactamente el criterio de entrada confirmado; si se requiere habilidad demostrada/certificado específico, pedir evidencia correspondiente. Completar curso no acredita todo el temario |
| RB05 | Entrevista no consume vacante final | Ya contemplado; reforzar capacidad de empleo, selección, agenda y curso separadas. No descontar plaza laboral por entrevistar/postular |
| RB06 | Cerrar esquema y después implementar reglas antes de interfaces | Reordenar como P0–P4 documental, contratos antes de implementación. No DDL/schema/migraciones ni desarrollo ahora; P5 solo al levantar instrucción de no desarrollar |

Conclusión integrada: base coherente para continuar especificación técnica, con RC01–RC05 tratados y RC06 abierto; no afirmar que se cerraron decisiones de nivel/puesto principal/dos ejes. Los métodos de cálculo, fuentes operativas y compatibilidad de stack también necesitan definición y pruebas posteriores.

## Plan de cierre: puertas de salida, sin código ahora

| Bloque | Salida concreta | Condición de cierre |
|---|---|---|
| P0 Reconciliar documentación | Dos referencias, hallazgos/resolución, 17 CU y mapeo coherentes | Verificar lecturas/escritura Vertex y enlaces/campos/IDs; marcar sin ejecución de producto |
| P1 Acordar catálogo/requisitos | Escala de nivel o decisión de omitirla; puesto principal; representación esencial/deseable y entrenable | Decisión humana o aceptación explícita de opción propuesta; no pedir de nuevo Auth/alta/reserva ya confirmados |
| P2 Diccionario y estados | Por entidad: campos, tipo lógico, obligatorio/opcional, fuente, dueño, versión, unicidad y relaciones; por transición: actor/precondición/efecto | Cubrir CU01–CU17 y casos aislados I01–I08, incluyendo fuentes/privacidad/prerrequisitos; aún sin schema/migración |
| P3 Contratos por módulo y agente | Entradas/salidas por modo, herramientas y errores; actor/permiso/versión/recibo; límites de ejecución | Ningún agente declara efecto sin recibo; individual y cooperativo especificados; ninguna UI accede directo a credenciales Prisma/IA |
| P4 Compatibilidad y decisiones técnicas | Versiones de React/API/Bun/Prisma; estrategia Auth/BD/RLS/Storage, transportes y modelos; entorno de pruebas aislado | Comprobaciones técnicas se planifican y solo se ejecutan al autorizar desarrollo; no asumir acceso API por tener OpenCode |
| P5 Desarrollo futuro por recorridos | Base de acceso/catálogos → candidato+vacante+matching → centro/preguntas/ruta/reserva → postulación/agenda/orientador | Usuario autoriza iniciar; servicios/BD/agentes/permisos y aceptación junto a cada vista, no frontend vacío |
| P6 Robustez y entregables | Fixtures/E2E/integración/≥15evals reales, trazas, metodología, diagrama, demo en vivo por perfiles y PPT (sin video, duración por acordar) | Resultados reproducibles, instalación y fuentes/bitácora; tag solo dentro de ventana oficial confirmada |

No asignar nombres de responsable humano por inferencia; equipo confirmado Mainor Villarreal y Giovanny Arpaia. Modelos de producto propuestos, no configurados: Gemini 3.8 Flash por Vertex como base; GPT-6 Sol medium alternativa evaluable. C01/C02/C03 siguen código/servicios, no tres modelos extras.

Acuerdo humano posterior de presentación: descartar video y mostrar recorrido alternando perfiles reales, con PPT que explique módulos. [Guion, diseño y skills propuestas](DEMO_PPT_DISENO.md). Añadir bocetos/identidad/componentes/estados antes de frontend; no adelantar desarrollo ni crear archivos Figma/PPT todavía. Mantener trazabilidad del enunciado original sin atribuirle modificaciones no verificadas.

## Cierre de stack ST01

[Stack técnico seleccionado y versiones](STACK_TECNICO.md): React/Vite, API Hono sobre Bun, Prisma7/adapter-pg y PostgreSQL Supabase. Sustituye NestJS candidato y deja de estar pendiente elegir framework/runtime. Esquema físico, estrategia efectiva Auth/BD/RLS/Storage y aplicación permanecen en D1. Las menciones de stack pendiente en el cuerpo describen el estado anterior a ST01; no reabren la selección.
