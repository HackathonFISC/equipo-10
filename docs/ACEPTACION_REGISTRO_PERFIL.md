# Aceptación y orden D0-01 / D1–D2

Estado: especificación escrita, casos diseñados sin ejecución del producto. [Diccionario y permisos](CONTRATO_REGISTRO_PERFIL.md), [API/A02](API_REGISTRO_PERFIL.md). Leer junto con CU01, RGN01–RGN14 e I02/I07; no sustituye las 20 evals existentes.

## 1. Recorridos y criterios observables

| ID | Dado / cuando | Resultado esperado | Nivel / vínculo |
|---|---|---|---|
| RP01 | Alta Auth sin sesión todavía verificada; intentar crear perfil | Pedir verificación/login, cero datos de perfil creados bajo identidad no validada | Integración/E2E acceso |
| RP02 | Joven sin CV ni experiencia; declarar none o diferir y revisar nombre | Confirmar perfil parcial privado; no inventar competencias ni exigir archivos | E2E, E14/I02 |
| RP03 | Salario/transporte unknown; confirmar | Perfil válido con faltantes; no convertir a cero o afirmar viabilidad | Contrato/integración, E06–E08 |
| RP04 | Experiencia informal y A02 propone habilidad; joven la rechaza | No aparece en versión confirmada; conservar procedencia/decisión mínima | Integración + eval A02, E14 |
| RP05 | Dinero negativo/exponente, horario solapado o fechas invertidas | Rechazo con path y sin guardado parcial; cero sí es dato válido | Unitaria dominio/contrato |
| RP06 | Dos pestañas mismo ETag; ambas editan | Una actualización válida; segunda 412, no pisar datos | Integración concurrencia |
| RP07 | Confirmar con preview de revisión antigua o vencida | Cero versiones nuevas; pedir revisar snapshot actual | Integración, E02/X15 |
| RP08 | Dos confirmaciones simultáneas/reintento misma clave | Una versión y recibo; misma clave con otro payload 409 | Integración BD real aislada, E19 |
| RP09 | Caída/timeout durante confirmación tras posible commit | Consultar/repetir misma clave recupera recibo; no duplica ni anuncia fallo definitivo sin verificar | Inyección de fallo/integración |
| RP10 | Usuario B conoce UUID de fuente/run/versión/recibo de A | 404 sin contenido/propietario; /me siempre B; rol en payload no cambia permiso | Integración, X01/I07 |
| RP11 | Empresa/centro/orientador intenta editar o leer borrador del joven | Denegado; acompañamiento futuro no concede lectura completa por defecto | Integración, RGN01/X11 |
| RP12 | A02 tarda y joven edita/confirma/revoca grant o retira fuente | Resultado stale/cancelled, no incorpora ni muta confirmado; envío aún no iniciado se cancela | Integración asíncrona |
| RP13 | Un lote acepta dos propuestas válidas de la misma revisión | Ambas aplicadas atómicamente, revisión sube una vez, sin invalidación interna artificial | Contrato/integración |
| RP14 | PDF/foto/audio ilegible, MIME falso, demasiado grande o no habilitado | Error recuperable, manual disponible; sin extracción ni éxito inventados | Parser + E2E, E15/E16 |
| RP15 | Documento ordena cambiar rol/enviar secretos o usa refs ajenas | Tratarlo como datos; ninguna herramienta/lectura fuera de ámbito | Eval adversaria + integración runtime, E12 |
| RP16 | Perfil v1 confirmado; editar borrador y luego confirmar v2 | v1 intacta; borrador no invalida por sí solo cálculos v1; v2 desactualiza dependencias pertinentes | Integración versiones |
| RP17 | Guardar/confirmar sin permiso de procesamiento IA | Ruta manual funciona; solicitar A02 no funciona sin grant; sin bloqueo artificial por caída Vertex | E2E/integración |
| RP18 | A02 afirma completed o verified_exercise sin recibo verificador | Ninguna confirmación ni habilidad demostrada fabricadas; rechazar estado/dato reservado | Contrato/eval, I06/I07 |
| RP19 | Confirmar datos y abrir Inicio | Mostrar perfil real y siguiente acción, sin empleo/cita/reserva/actividad ficticios | E2E + revisión visual |
| RP20 | Navegar registro claro/oscuro a 320/390/escritorio con teclado | Volver/continuar sin pérdida, foco/errores legibles, progreso por pasos separado de empleabilidad | E2E + revisión visual |

Umbrales críticos: cero accesos ajenos, confirmaciones sin actor/preview vigente, versiones duplicadas, sobrescrituras silenciosas o competencias inventadas/«demostradas» por LLM solo. Para extracción medir exactitud por campo contra gold por formato; usar E15/E16 y registrar desconocidos, no premiar rellenado inventado. Ninguna prueba descrita tiene resultado real todavía.

## 2. Orden concreto para implementar después

### D1-A — Identidad y contratos compartidos

Leer secciones 1–3/7 del diccionario y 1–4 de API. Fijar framework/runtime/versión y validación de sesión con fuentes oficiales. Preparar configuración ejemplo y estrategia de BD/Storage privada; definir entorno aislado antes de migrar. Traducir primero tipos/validadores y errores, con UI/API compartiendo contrato sin exponer modelos Prisma al cliente. No crear tablas de todos los futuros módulos.

Salida: sesión/usuario activo, propiedad por objeto y soporte de borrador/versión/recibo. RP01/RP10/RP11/RP17 según alcance; migración revisable y destino comprobado al ejecutarla. Fuera del presente encargo: aplicación e instalaciones.

### D2-A — Perfil manual persistido

Cuenta, experiencia, disponibilidad, revisión y primer Inicio; PATCH por sección, ETag, decisiones de revisión, preview y confirmación transaccional. Semillas sintéticas de dos candidatos y catálogo acotado. RP02/RP03/RP05–RP11/RP16/RP17/RP19/RP20. Este recorrido no necesita gastar llamadas a Gemini del producto.

### D2-B — Interpretación A02 texto

Contratos, grant, ejecución asíncrona con herramientas reales y propuestas por revisión; lote de decisiones y alternativa manual. BALTHASAR puede escribir los archivos del bloque mediante Vertex en desarrollo; A02 del producto usa integración propia, no la CLI de desarrollo como servidor compartido. RP04/RP12/RP13/RP15/RP18 e I02/I07; evaluar con texto gold, demostrar decisión/pregunta y herramienta, no solo JSON.

### D2-C — Texto y PDF digital

Decisión humana del 2026-10-17: aceptar en esta etapa texto escrito/pegado y PDF digital con texto seleccionable. Imágenes/fotos, PDF escaneado/OCR y audio quedan pendientes para una ampliación posterior. Las comprobaciones de esos formatos que figuren debajo se conservan como requisitos futuros, no como aceptación exigible o ejecución acreditada del cierre D2. Mantener error recuperable y alternativa manual ante formatos no habilitados; no afirmar extracción ni transcripción de ellos.

Habilitar cada formato tras verificar parser, límites y política de tratamiento/retención; fuente/fragmentos/versiones/transcripción revisable. RP14/RP15 y E15/E16 por formato. No extender permisos de Storage ni enviar datos reales para suplir falta de fixtures.

## 3. Encargo para BALTHASAR cuando se autorice código

Crear una orden desde [plantilla](PLANTILLA_TAREA_DESARROLLO.md), con uno de los subbloques anteriores, **archivos exactos disjuntos una vez definida la estructura del proyecto**, firmas/imports y aceptación. No inventar rutas de código antes de cerrar D1 ni encargar «implementar todo el perfil» en una llamada.

Coordinador concreta; BALTHASAR (`google-vertex/gemini-3.8-flash`) escribe su aporte permitido, sin consola; integrador revisa y ejecuta pruebas; validador contrasta evidencia real. Compartir rutas/secciones/contratos MD/JSON compactos, no conversación completa. Seguir [guía](GUIA_IMPLEMENTACION_Y_REVISION.md) y skills del proyecto. No presentar esta preparación como llamada a Gemini o ciclo MAGI ya ejecutado.

Registro futuro de verificación por caso: revisión/huella, fixture/gold, entorno/DB aislada, comando y exit code, resultado medido, modelo/proveedor real si aplica, evidencia sanitizada, fallos y limitaciones. Pruebas mock de proveedor no prueban acceso Vertex ni calidad de interpretación.

## 4. Cierre documental y pendientes

D0-01 completado como especificación: campos/obligatoriedad, cardinalidades, estados/versión, matriz de permisos, rutas/errores/recibos y A02 acotado definidos. D0 global sigue abierto: stack/versiones, estrategia efectiva Auth/BD/RLS/Storage y adaptación física; políticas de archivos/datos reales y acceso API del modelo pendientes antes de habilitar esas funciones. No se han creado endpoints, schema Prisma, migraciones o tests de aplicación; RP01–RP20 son criterios diseñados.

## Cierre de stack ST01

[Stack técnico seleccionado y versiones](STACK_TECNICO.md): React/Vite, API Hono sobre Bun, Prisma7/adapter-pg y PostgreSQL Supabase. Sustituye NestJS candidato y deja de estar pendiente elegir framework/runtime. Esquema físico, estrategia efectiva Auth/BD/RLS/Storage y aplicación permanecen en D1. Las menciones de stack pendiente en el cuerpo describen el estado anterior a ST01; no reabren la selección.
