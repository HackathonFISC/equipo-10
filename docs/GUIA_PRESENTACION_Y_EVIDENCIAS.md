# Guía para explicar AImpulsa y organizar evidencias

> **Estado conciliado — 2026-10-17:** consultar [ESTADO_ACTUAL.md](ESTADO_ACTUAL.md) para distinguir implementación, evidencia histórica y pendientes de entrega. D8 figura corregido localmente y su migración remota aplicada/verificada; el ensayo manual completo y la traza de tres agentes siguen pendientes. Los evals finales están en [el paquete reproducible](../evals/README.md).
Actualizado: 2026-10-17. Organización propuesta para el README, la exposición y el PPT; no es un archivo PPT ya creado ni una aceptación de los pendientes.

## Orden recomendado
| Orden | Pregunta que responder | Referencia y evidencia |
|---|---|---|
| 1 | ¿Qué problema resolvemos y para quién? | Problema, tres lados y orientador independiente; un ejemplo concreto |
| 2 | ¿Qué hace cada actor? | Matriz del README y catálogo CU; diferenciar permisos |
| 3 | ¿Qué recorridos se implementaron? | CU y su especificación; señalar alcance parcial/aplazado |
| 4 | ¿Cómo se organiza el software? | Tres capas, frontend/API modular y diagrama de metodología |
| 5 | ¿Qué aporta cada agente y cómo colabora? | Entrada → herramienta → salida → confirmación → consumo del resultado |
| 6 | ¿Qué ocurre realmente en el sistema? | Demo de perfil, vacante/comparación, ruta/reserva y centro/orientador según estado válido |
| 7 | ¿Cómo sabemos que funciona? | Pruebas ejecutadas, límites, fallos y evals; sin confundir sus métricas |
| 8 | ¿Cómo se construyó y qué falta? | Bitácora, fuentes, decisiones humanas, entrega y siguientes pasos |

El README resume y enlaza; no debe contener las 17 fichas completas, todos los prompts ni todas las capturas. La exposición puede usar 8–10 diapositivas siguiendo este orden y dejar fichas/código como respaldo.

## Qué documento responde cada parte
- README: problema, estado, actores, stack, tres capas, colaboración breve, instalación y enlaces.
- CASOS_DE_USO: objetivo y recorrido por actor, más cobertura del prototipo.
- ESPECIFICACION_CASOS_USO: precondiciones, entradas, reglas RGN, pasos, alternos, estados y aceptación.
- METODOLOGIA: proceso de desarrollo, arquitectura, datos, operación y verificación.
- COLABORACION_AGENTES: fuente de prompts, herramientas, datos compartidos e intervención humana.
- BITACORA_IA: qué hizo el equipo humano, qué produjo IA, herramienta/modelo y correcciones/evidencia.
- Informes de verificación y evals: qué se ejecutó sobre qué versión y con qué resultado.

## Prompts, código y capturas
Sí conviene explicar el prompt y cómo interactúa con el sistema. Presentarlo en una ficha breve:
1. Agente y objetivo.
2. Entrada y datos que tiene permitido leer.
3. Dos o tres instrucciones esenciales, resumidas como tales.
4. Herramientas permitidas y comprobaciones de servidor.
5. Resultado estructurado, quién lo confirma y qué servicio lo consume.
6. Archivo/símbolo de código y evidencia de una ejecución.

La fuente completa es el código enlazado en [COLABORACION_AGENTES](COLABORACION_AGENTES.md). Un screenshot de código sirve como apoyo visual si la letra es legible; no reemplaza el enlace al archivo ni prueba que se ejecutó. No usar capturas de instrucciones dadas a Antigravity como si fueran prompts del producto.

## Capturas a preparar
| Captura | Qué demostrar | Precaución |
|---|---|---|
| Perfil asistido | Fuente → propuesta → revisión juvenil | Usar CV/texto sintético |
| Vacante | Requisitos normalizados y corrección de alerta | No fingir que toda discriminación es detectada |
| Comparación | Viable/inviable/pendiente y razones C01 | No presentar cobertura como probabilidad de contratación |
| Ruta/reserva | Confirmar plan es distinto de reservar; recibo y agenda | D8 corregido y desplegado; ensayar con cuentas reales |
| Centro | Mapa/banco revisados, intento privado o finalización/PDF | No publicar soluciones previas ni fabricar certificados |
| Orientador | Autorización, revisión y revocación | Datos mínimos del joven autorizado |
| Prueba/traza | Herramienta, versión, confirmación y resultado | Sanitizar tokens, URLs privadas y datos personales |

Preparar una lámina de arquitectura y una de colaboración; no una diapositiva por archivo ni listas extensas de frameworks. Capturar código solo donde explique una regla importante: prompt/herramienta, C01 o transacción/permiso. Las capturas y el PPT quedan por producir; esta actualización organiza su contenido.

## Demo y cierre
Usar sesiones separadas por actor y cuentas autenticadas con permisos reales. Mostrar una historia coherente y un intento bloqueado; distinguir datos preparados de acciones ejecutadas en vivo. No hacer llamadas IA para CRUD ni disparar todos los agentes para llenar tiempo.

El usuario eligió demo y PPT; no producir video ni afirmar que el organizador lo dispensó. Mantener visibles los pendientes vigentes: ensayo y aceptación con cuentas reales, publicación de al menos 15 evals con métricas/resultados, traza correlacionada de tres agentes, instalación limpia, PPT y cierre administrativo. La frontera de reserva independiente figura corregida y la migración remota D8 fue aplicada/verificada; consultar [estado actual](ESTADO_ACTUAL.md).
