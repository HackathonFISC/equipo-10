# Cursos, puestos y habilidades: definición lógica propuesta

> **Diseño/plan de su etapa — conciliación 2026-10-17:** los pasos futuros y alternativas siguientes conservan su contexto original; no son una lista de todo lo que falta hoy. Implementación y pendientes vigentes en [ESTADO_ACTUAL.md](ESTADO_ACTUAL.md) y [cobertura CU](CASOS_DE_USO.md#cobertura-actual-por-caso). Los casos diseñados no se presentan como ejecutados.

Fecha: 2026-10-16. Estado: diseño para discusión, sin código ni esquema Prisma ni cambios en Supabase. Precisión humana: incluir cursos, etiquetas de puestos y etiquetas de habilidades en el cierre del modelo. Separación de entidades/campos/reglas organizada por IA; no equivale a aprobación de cada detalle.

Complementa [modelo de datos y módulos](MODELO_DATOS_MODULOS_PROPUESTA.md), [fichas](ESPECIFICACION_CASOS_USO.md), [mapeo](MAPEO_CASOS_AGENTES.md) y [arquitectura](ARQUITECTURA_AGENTES.md). Se conservan Supabase Auth, invitaciones controladas y reserva inmediata ya confirmados por el usuario.

## Tres conceptos que no se deben mezclar

- **Puesto:** ocupación/función, por ejemplo auxiliar de bodega. Es una entrada del catálogo, no una vacante concreta ni una habilidad.
- **Habilidad o conocimiento:** capacidad o saber específico, por ejemplo registrar entradas de inventario o conocer rotación de existencias. Un mismo concepto se reutiliza en perfiles, requisitos, temarios y preguntas.
- **Curso:** contenido que pretende enseñar resultados concretos. Su edición ofrece fechas, sede/modalidad, precio y cupos. No crear automáticamente habilidades adquiridas por matricular o completar.

Usar IDs estables como referencias; el texto de la etiqueta es nombre visible. No comparar solo cadenas ni guardar listas separadas de etiquetas inventadas por cada agente.

## Catálogos compartidos

| Entidad | Campos mínimos propuestos | Relaciones y validaciones |
|---|---|---|
| Puesto | ID, código estable, nombre canónico, descripción de tareas/alcance, estado y versión de catálogo | Familia/sector y referencia externa opcionales; no usar sexo/residencia como definición del puesto |
| AliasPuesto | ID, puesto, texto/idioma/contexto y procedencia de equivalencia | Varios alias por puesto; alias ambiguo puede apuntar a varios candidatos y requiere aclaración, no equivalencia automática |
| Competencia | ID, código estable, nombre, descripción, tipo conocimiento/habilidad, estado y versión de catálogo | Categoría opcional técnica/transversal; no convertir juicio vago como «buena presencia» en etiqueta válida de competencia |
| AliasCompetencia | ID, competencia, texto/contexto/idioma y fuente | Evitar duplicar mismo concepto por sinónimo; conservar contexto cuando dos conceptos distintos usan palabra igual |
| PuestoCompetenciaReferencia | Puesto, competencia, descripción de uso y fuente/versión | N:M; referencia orientativa para explorar meta y pedir aclaraciones, no todos los requisitos obligatorios de cualquier vacante de ese puesto |
| NivelReferencia, si se usa | Código, descripción observable y versión de escala | Opcional: definir criterio antes de usar básico/intermedio/avanzado; no inventar nivel o porcentaje por título del curso |

Catálogo inicial pequeño curado por el equipo mediante archivo/datos versionados; no construir administrador global extra por costumbre. Agentes proponen equivalencias o conceptos nuevos; no modifican automáticamente el catálogo global ni eliminan distinciones ambiguas. Fuente externa opcional (tipo ESCO), con correspondencia y procedencia explícitas, sin afirmar que ya fue importada o que sus IDs son nuestros IDs internos.

Estado de entrada canónica: activa/inactiva. Propuestas de alias/concepto son objetos aparte: propuesta → por revisar → aceptada/rechazada. Aceptar genera versión de catálogo; no renombrar silenciosamente significados en resultados históricos.

## Relaciones con vacante, candidato y curso

| Relación | Qué se guarda | Qué no implica |
|---|---|---|
| VersiónVacante → Puesto | Un puesto principal confirmado, título original, fuente y versión del catálogo | No imponer requisitos estándar del puesto sin que la empresa confirme la vacante |
| RequisitoVacante → Competencia | Competencia, texto original, nivel/criterio si se conoce, fuente y clasificación confirmada | Un nombre parecido no demuestra equivalencia ni cumplimiento del candidato |
| Perfil → PuestoInterés | Puestos que interesan al joven y, si corresponde, puesto meta | Interés no significa estar cualificado ni postular automáticamente |
| VersiónPerfil → Competencia | Vínculo con evidencia, confirmación del joven, alcance verificado y fuente/versiones | Etiqueta declarada no equivale a demostración o certificado |
| ResultadoAprendizaje → Competencia | Resultado esperado, unidad/fragmento, competencia, criterio esperado y confirmación del centro | Lo que el curso enseña no es dominio ya adquirido por un alumno |
| PrerrequisitoCurso → Competencia | Requisito de entrada confirmado, criterio y fuente | No confundir saber que debe tener antes con contenido que aprenderá durante el curso |
| Pregunta → Resultado/Competencia | Unidad, pregunta/microtarea, criterio/rúbrica, respuesta objetiva si aplica y fuente/versiones | Una pregunta correcta solo verifica su ejercicio; no toda la competencia profesional |

Propuesta para demo: una vacante concreta tiene un puesto principal. Si el documento anuncia varios puestos, A01 propone separarlos en borradores y empresa confirma, sin publicar ni repartir plazas automáticamente. Un curso puede servir para varios puestos por competencias compartidas; no hace falta afirmar equivalencia directa curso→empleo. Consultar referencia puesto/competencias y requisitos de la vacante para explicar su utilidad.

En requisitos, distinguir dos preguntas: importancia (esencial/deseable) y cuándo puede adquirirse (de entrada/entrenable en el trabajo), más desconocido cuando falte confirmación. Es una precisión propuesta al modelo anterior esencial/deseable/entrenable, no un cambio humano ya aprobado. Si se adopta, actualizar representación de requisitos antes de implementar, sin inferir que un esencial es entrenable.

## Cursos y ediciones: campos por entidad

| Entidad | Campos requeridos para confirmar/publicar | Campos opcionales o condicionados |
|---|---|---|
| Curso | ID, centro propietario, nombre, descripción y estado | Familia temática, fuente externa |
| VersiónCurso | Curso, número/ID de versión, temario/fuente, objetivos/resultados, confirmador y fecha | Duración orientativa, idioma y requisitos de entrada declarados o «por aclarar» |
| UnidadContenido | VersiónCurso, título, orden, contenido/fragmento fuente | Duración orientativa por unidad |
| ResultadoAprendizaje | Versión/unidad, descripción observable, competencia vinculada, criterio esperado y confirmación | Nivel de escala si está justificado y definido |
| Edición | VersiónCurso confirmada, modalidad, inicio/fin, capacidad entera, precio con moneda/base y sesiones conocidas | Requisitos particulares, fecha límite de inscripción, información de acceso bajo permisos |
| Sesión | Edición, inicio/fin y zona horaria; ubicación si presencial o condiciones de acceso si virtual | Excepciones/cambios con nueva revisión; no hacer público enlace privado de clase |
| Banco/VersiónBanco | Curso/mapa/versiones, preguntas/rúbricas y revisión del centro antes de verificar ese curso | Banco puede estar pendiente sin bloquear publicación o reserva de edición válida |
| Reserva | Candidato, edición, estado, confirmación, clave única y fecha | Plan/revisión asociados cuando correspondan; sin solicitud esperando aprobación del centro en política confirmada |
| Finalización/Certificado | Participante/edición, resultado/fecha, centro confirmador | Certificado adjunto existente opcional; no exigir certificado para registrar curso externo declarado |

Reglas: gratuito es precio cero confirmado, desconocido no es gratuito. Modalidad mixta exige representar sus sesiones presenciales y virtuales. Cupos/horarios/precio desconocidos permiten borrador pero no reserva factible. Versión de contenido no se actualiza en ediciones activas silenciosamente; cualquier cambio material requiere revisión de dependencias y reacomodo aplicable. Temario/mapa/banco/intento históricos permanecen fijados a su versión, sin recalificación automática.

## Ejemplo ficticio del recorrido

1. Empresa publica borrador «Ayudante de almacén». A01 propone puesto canónico «Auxiliar de bodega», pero pide aclarar tareas si el alias es ambiguo. Empresa confirma puesto y requisitos concretos, por ejemplo registrar movimientos y conteo de existencias.
2. Joven interesado en ese puesto aporta experiencia de inventario familiar. A02 propone evidencia limitada y joven confirma su perfil; A03 compara con requisitos confirmados, no con el nombre del cargo solamente.
3. Centro registra «Fundamentos de inventario», unidad «Entradas y salidas» y resultado «Registrar un movimiento con cantidades y fecha». A01 propone competencia correspondiente; centro confirma mapa.
4. A02 propone microtarea con tabla de movimientos y criterio verificable. Centro revisa banco; joven consiente responder. C01 verifica la parte objetiva y se guarda evidencia acotada; no se crea certificado por responder.
5. A03 recalcula brechas; A05 propone edición compatible si hace falta. Joven confirma reserva inmediata con cupo revalidado, y la herramienta registra un solo efecto. Compartir evidencia a empresa requiere permiso específico.

## Módulos, agentes y casos afectados

- Renombrar módulo lógico **CatalogoHabilidades → CatalogosPuestosCompetencias** para incluir puestos, alias y referencias puesto/competencia. Es propuesta de nombre/agrupación, sin código generado.
- VacantesSeleccion administra puesto principal/requisitos de cada vacante; Candidatos administra intereses y evidencia personal; Formacion administra contenido/mapa/ediciones; EvaluacionPractica administra banco/intentos/rúbricas. Catálogos no absorben esos datos privados.
- A01 normaliza puesto/vacante y temario; A02 perfil/preguntas/evidencia; A03 compara IDs, requisitos y evidencia mediante C01; A05 relaciona brecha con resultados esperados de cursos; A04 usa oferta y perfil confirmados.
- CU01/CU03/CU04 incorporan puestos de interés/meta; CU07 puesto canónico/título original/requisitos; CU11 mapa de curso y prerrequisitos; CU02 preguntas y evidencia. Se conservan IDs de los 17 casos, sin crear casos nuevos solo por etiquetas.

Antes del esquema: acordar si se usa escala de nivel en la demo, confirmar puesto principal único por vacante y la clasificación de requisitos en dos ejes. La falta de esos acuerdos no autoriza a inventar niveles, equivalencias o cambios a los documentos humanos originales.

Reconciliación con CU: RGN14 y CU01/CU03/CU04/CU07/CU12 detallan catálogos, ambigüedad y prerrequisitos; [plan y revisión integral](REVISION_INTEGRAL_PLAN.md) conserva opciones pendientes como decisiones por cerrar. Ruta futura no demuestra prerrequisito para reservar hoy.
