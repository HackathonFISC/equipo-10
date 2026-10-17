# D7: núcleo de centros y aprendizaje verificado localmente

> Actualización posterior: integrado en la carpeta principal y migraciones aplicadas/verificadas en Supabase. Ver [INTEGRACION_D5_D7.md](INTEGRACION_D5_D7.md). Los estados de carpeta aislada y errores de tipos siguientes son históricos.

Fecha: 2026-10-17. Esta actualización prevalece sobre los pendientes de certificados y banco objetivo de `D7_ENTREGA_PARA_INTEGRAR.md`. Desarrollo en `equipo-10-d7`, rama `codex/d7-centros`; sin modificar la carpeta activa de Gemini, sin despliegue Supabase y sin commit/push.

## Comportamiento disponible

1. Centro autorizado crea curso privado, interpreta temario mediante A01/Vertex, revisa habilidades/prerrequisitos con citas, guarda avance y publica una versión y edición inicial sobre las entidades D4.
2. A02/Vertex lee el mapa publicado y propone preguntas objetivas de opción única con opciones, respuesta, justificación/rúbrica, cita y habilidad del mapa. Centro puede editar y confirma el banco; sin confirmación no se ofrece al joven. Un banco nuevo conserva los anteriores.
3. Joven consiente un intento privado. Antes de entregar, la API no incluye respuestas correctas ni rúbricas. C01 corrige por comparación de opciones en código, registra aciertos y explicación; el alcance es exclusivamente el ejercicio. No se calcula un porcentaje global de dominio ni se promueven habilidades automáticamente.
4. Joven confirma por separado la asociación del resultado a una versión confirmada de su perfil. Se guarda `TrainingAssessmentAssociation`, no se inventa un `CompetencyClaim` de dominio. Historial e intentos se recuperan desde el servidor en otra pestaña o tras limpiar el estado local.
5. Centro consulta participantes propios y registra finalización humana. Puede adjuntar un PDF existente de hasta 5 MiB a una finalización COMPLETED; un adjunto no se sobrescribe. Gestor autorizado y joven propietario descargan con sesión, sin URL pública. La validación comprueba tamaño, MIME, extensión, firma PDF e integridad SHA256; no verifica autenticidad del emisor ni el contenido académico del documento.

La finalización, el certificado y el resultado del ejercicio son registros distintos. Ninguno equivale a acreditar automáticamente todo el temario.

## Persistencia y permisos

Migraciones004–008: políticas del centro sobre tablas D4, finalización, avance de borrador, banco/intento/asociación y certificado. Seis modelos nuevos reconciliados en `schema.prisma`; validación Prisma aprobada, sin regenerar el cliente compartido durante el trabajo paralelo. Servicios nuevos usan SQL parametrizado para esas tablas.

Banco, fuente, rúbrica e intento conservan snapshots. Un intento iniciado usa su banco original aunque se publique otro; no se recalifica el pasado. El centro no dispone de endpoints para consultar respuestas privadas de los jóvenes. Reintentos llevan recibos; permisos se revalidan antes de devolverlos. Se revisó además el acceso a recibos por las rutas generales de perfil.

Archivos en `.local/certificates`, fuera del servidor web y excluidos de Git. El proceso reconcilia recibos antes de limpiar un archivo cuando el commit es incierto; conserva el archivo privado si no puede comprobarlo. Se deben preservar ese directorio y sus respaldos al mover la aplicación. Este almacenamiento es para una instancia local, no compartido entre servidores.

## Verificaciones realizadas

| Comprobación | Resultado observado |
|---|---|
| Cursos, avance, permisos y publicación | 8 pruebas API aprobadas |
| Participantes y finalización | 9 pruebas API aprobadas |
| Banco, privacidad, snapshots, corrección y asociación | 18 pruebas API aprobadas, incluidas la ruta general de recibos y revocación; 49 aserciones |
| Certificado y descarga HTTP con CORS | 8 pruebas aprobadas; 37 aserciones |
| Vertex A01, prueba sintética | Aprobada en entrega anterior: fuente, catálogo y propuesta |
| Vertex A02, prueba sintética real | Aprobada: Gemini3.8Flash por Vertex; read_confirmed_course_map y submit_assessment_bank; dos preguntas; 8.98s |
| Navegador centro → banco → finalización → PDF → joven descarga | Aprobado, con reserva previamente sembrada y PDF técnico de prueba |
| Navegador joven → consentimiento → respuestas → C01 → asociación → recarga sin sessionStorage | Aprobado; respuesta previa inspeccionada sin clave correcta/rúbrica |
| Interfaz claro/escritorio y oscuro/móvil390 | Capturas inspeccionadas, reutilizando tokens y componentes |
| Build web | Aprobado, bundle aprox.581kB con aviso de tamaño |
| Prisma validate | Aprobado; no conexión ni generación |
| Typecheck global | Siete errores heredados de la copia inicial de recruitment; ninguno en D7 |

Los tests se ejecutaron secuencialmente sobre el contenedor local exclusivo `aimpulsa-d7-isolated`, puerto55445/base `aimpulsa_d7_test`. No ejecutar estos fixtures en paralelo; reinicializan SOLO ese esquema local. No se tocó la BD55435 de Gemini. Los tests funcionales no sustituyen las 15 evals de calidad semántica que exige el reto.

Total: **43 pruebas aprobadas** (8+9+18+8). La revisión de integración detectó que el endpoint genérico de recibos de perfil podía devolver soluciones de un banco creado por un gestor ya revocado. Se añadió una política restrictiva SELECT sobre esos recibos, además del control del módulo de bancos. La prueba real del servicio de perfil comprueba acceso antes de revocar y404 después; no se alteraron sus archivos compartidos.

El primer intento real A02 falló sin diagnóstico suficiente. Se añadieron trazas sanitizadas y se restringió cada turno a la herramienta permitida: leer mapa y después entregar propuesta. El único reintento posterior pasó sin relajar validaciones. Los logs no incluyen temario, respuestas, tokens ni credenciales. Scripts reales: `scripts/verify-d7-vertex.ts` y `scripts/verify-d7-assessment-vertex.ts`.

El navegador usa API/BD locales reales e IA inyectada para un recorrido reproducible. Las llamadas reales a Vertex se verificaron separadamente. El PDF de prueba se identifica como fixture técnico, no como certificado emitido a una persona real. Una prueba de navegador encontró un error CORS en descarga, corregido en el controller con `c.body`; la nueva prueba HTTP verifica cabeceras y bytes.

## Integración selectiva pendiente

Conservar las instrucciones de `D7_ENTREGA_PARA_INTEGRAR.md` y sumar:

- Módulos API `training-assessments` y `training-certificates`, contratos homónimos y exports.
- Migraciones007/008 y los seis modelos D7 con sus relaciones inversas. Incorporarlos sobre el schema MÁS RECIENTE de Gemini; no reemplazar el archivo completo.
- En app/server, inyectar y montar ambos módulos dentro del router autenticado; límite multipart6MiB solo en la ruta de certificado. El archivo tiene límite5MiB.
- Componentes de banco, diagnóstico y certificado dentro de `features/training-center`; llamada al diagnóstico desde CourseDetailPage y al certificado desde participantes/resultados.
- Fixtures y pruebas nuevas; `d7-confirmed-profile.ts` confirma un actor sintético usando los servicios D2 y todas las guardas SQL, sin desactivarlas.

Scripts de comprobación de navegador: `tests/support/d7-bank-browser-check.js`, `d7-assessment-browser-check.js`; servidor sintético `d7-preview-server.ts`. Las capturas y archivos privados no se publican. El preview omite partes de la aplicación ajenas a D7; las solicitudes de agenda del inicio devolvieron404 durante esa sesión y no se contabilizan como una regresión validada de D4.

Antes de usarlo en la carpeta habitual: reconciliar módulos/contratos/esquema con D5/D6 de Gemini, resolver los siete errores de su copia inicial si aún existen, preparar/aplicar/verificar las migraciones incrementales sobre la base configurada y probar con autenticación real. No asumir que el frontend disponible implica tablas desplegadas. No copiar toda esta rama: contiene el snapshot inicial no confirmado de otras etapas.

## Límites restantes de D7 completo

- Preguntas abiertas y retroalimentación orientativa A02: este núcleo cubre solamente opción única con corrección determinística.
- Diagnóstico general de formación externa sin temario, ampliación del mapa por unidades/fragmentos estructurados y más flujos de evidencia.
- Nuevas versiones/ediciones de un curso publicado, corrección de finalizaciones/adjuntos con historial y gestión de cancelaciones de edición.
- Recorrido completo reservar por la UI de D4 → centro finaliza: en la prueba actual la reserva era un fixture previo; no declarar ese E2E ejecutado.
- Evals de calidad IA del reto, integración final, autenticación real y despliegue en Supabase.

Autoría: dirección funcional y visual humana de la conversación. Código, coordinación, revisión cruzada y ejecución por Codex y subagentes Codex; Gemini3.8Flash por Vertex generó las propuestas de los agentes del producto en las pruebas reales. No atribuir a Gemini la escritura de este código ni confirmar ediciones humanas que no se observaron.
