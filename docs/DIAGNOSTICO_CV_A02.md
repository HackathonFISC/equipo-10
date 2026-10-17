# Diagnóstico de lectura de CV y conexión directa de A02

Fecha: 2026-10-17.

## Arquitectura comprobada

La API del producto ejecuta `AgentA02Service`, que usa ADC y llama directamente a `generateContent` de Vertex. MAGI no es un intermediario en ejecución: coordina el desarrollo y la revisión. No se atribuye esta decisión a una herramienta concreta sin evidencia de autoría.

## Archivo real revisado localmente

CV aportado por el usuario: PDF digital de una página. Se cotejó su render con el texto del parser de producción. Se conservaron las seis secciones: perfil profesional, formación, conocimientos, experiencia académica, certificaciones e idiomas. Las 20 comprobaciones locales de contenido pasaron, incluyendo títulos educativos, tres entradas de certificaciones, tutoría y conocimientos de herramientas/idiomas. Esto comprueba lectura, no calidad de interpretación por el modelo.

El archivo original, su texto y el render no se añadieron al repositorio ni se enviaron a Vertex. La falta de propuestas no demuestra por sí sola un problema de extracción PDF.

## Fallos encontrados y corrección

- El bucle construía `systemInstruction` pero no lo incluía en el cuerpo enviado al proveedor. Se agregó al envío en cada ronda.
- El tope de salida era 2048 tokens. Se amplió inicialmente a 8192. Tras el nuevo reporte de truncamiento, se configura `thinkingLevel=LOW` para Gemini 3.8 Flash y propuestas compactas, sin fusionar cursos ni experiencias distintos. La guía oficial recomienda controlar el esfuerzo con thinking level y retirar temperature en este modelo: [guía de Gemini 3.8 Flash](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/guides/gemini-3-8-flash).
- Con `finishReason=MAX_TOKENS`, se reintenta la misma ronda una sola vez con techo de 16384 tokens. No se ejecutan herramientas parciales ni se incorpora la respuesta cortada al contexto. Se conservan las seis rondas y el plazo total de 120 segundos. Si vuelve a truncarse, se devuelve error sin modificar el borrador.
- Se solicita revisar todas las secciones/páginas, cursos, certificaciones y conocimientos explícitos, preservando años parciales sin fabricar meses ni competencias verificadas.

## Evidencia y límites

- `bun test tests/api/a02-result.test.ts`: 7 PASS, 0 FAIL. HTTP simulado; comprueba instrucciones, thinking LOW, recuperación única y rechazo de truncamiento persistente.
- `bun run typecheck`: exit 0.
- PDF real: 20 comprobaciones locales PASS y cotejo visual de la página.
- Prueba real opt-in `RUN_VERTEX_CV_EVAL=1 bun --env-file=.env test tests/api/a02-cv-live.test.ts`: 1 PASS, aproximadamente 16 segundos, proveedor `vertex-gemini-3.8-flash`, 13 propuestas, cinco formaciones distintas y dos preguntas. Datos sintéticos; no se ejecutó Vertex con el CV personal.
- `bunx playwright test`: 8 PASS. Verifica registro completo, acceso y aislamiento, renovación de sesión con PDF seleccionado, 502 recuperable sin cerrar diálogo ni repetir subida y bloqueo real del botón. Interpretación HTTP interceptada en E2E, distinta de la prueba real del proveedor.
- `bun run build`: exit 0, aviso existente de tamaño del bundle. `bun run typecheck`: exit 0.
- Las propuestas de competencias siguen pendientes de catálogo y persistencia; no se convierten en habilidades acreditadas.
- La compatibilidad con múltiples diseños necesita un conjunto de PDFs sintéticos/gold con columnas, tablas, varias páginas e imágenes. El parser actual usa una heurística de columnas; no se verificó compatibilidad universal. Un PDF escaneado necesita OCR real, todavía pendiente en este recorrido.

No se cambió el parser para solucionar un fallo no reproducido en este documento. No hubo cambios remotos, commit ni push.

## Interfaz y transporte tras el segundo reporte

El estado de procesamiento aparece en el pie del diálogo junto al botón, con spinner, etiqueta «Revisión en curso…», explicación y controles deshabilitados visual y funcionalmente. Pie fijo dentro del diálogo y adaptación móvil; no aparece otro bloque de proceso arriba. La fuente subida se conserva durante un reintento de análisis con la misma entrada.

Se conserva el contexto del mismo usuario al renovar sesión y el borrador existente durante recargas, evitando desmontar el selector de CV. Un cambio de usuario o cierre de sesión elimina el contexto anterior; los E2E de aislamiento e invalidación 401 pasan.

Servidor Bun: `idleTimeout=130` para permitir el plazo de proveedor de 120 segundos. No sustituye ese plazo ni crea reintentos ilimitados.

El 502 reportado coincide con `A02_INCOMPLETE_RESULT` por truncamiento. El 404 adicional no trae URL concreta en el reporte y no se reprodujo en las rutas verificadas; queda sin atribuir, no declarado corregido.
