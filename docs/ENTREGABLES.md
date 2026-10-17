# Entregables y congelamiento

Fuente: §6 p. 7; rúbrica §7 p. 8. Estado inicial: pendiente salvo repo existente y documentos de planificación. Las rutas son una propuesta del equipo, no nombres impuestos por la organización, excepto tag `final-24h`.

| ID | Entrega oficial | Ruta propuesta | Acumular desde ahora | Validar al cerrar | Plazo oficial |
|---|---|---|---|---|---|
| D01 | Repositorio registrado y commits durante periodo | GitHub HackathonFISC/equipo-10 | Prueba de registro, historial y SHA por bloque | Confirmar registro y commits dentro de ventana | Registrar hora 1 |
| D02 | Tag congelamiento | `final-24h` en Git | SHA último commit válido y hora oficial | Tag apuntar al SHA correcto; no moverlo sin autorización | Hora 24 |
| D03 | README | README.md | Problema, arquitectura, tecnologías, fuentes, instalación, ejecución y credenciales demo | Probar instalación limpia; usar .env.example sin claves reales | Hora 24 |
| D04 | Diagrama arquitectura | docs/arquitectura.* | Agentes, herramientas, mensajes, datos y punto humano | Coincidir con implementación y demo | Hora 24 |
| D05 | Evals propios | evals/casos.csv, evals/resultados.json | 15+ casos, expectativas, métricas, ejecución/errores | Resultados reproducibles con fecha, comando y SHA | Hora 24 |
| D06 | Bitácora IA | docs/BITACORA_IA.csv | Parte creada con IA, herramienta/modelo y cambios manuales | No atribuir trabajo inventado ni incluir secretos | Hora 24 |
| D07 | Metodología adicional a formularios del día | docs/METODOLOGIA.md | Despliegue, funcionamiento, arquitectura y decisiones | Explicar operación, límites y recuperación | Hora 24 |
| D08 | Video mencionado en enunciado original | Descartado del plan por instrucción expresa del usuario | Conservar referencia original sin afirmar cambio organizador | No producir video; demo y PPT son plan actual | No planificado |
| P09 | Demo en vivo por perfiles (plan del equipo) | docs/DEMO_PPT_DISENO.md | Historia, cuentas/sesiones aisladas, datos y acciones reales | Cambio de perfiles con permisos reales, agentes/herramientas y evidencia | Duración por acordar |
| P10 | PPT de módulos (plan del equipo) | Archivo por crear | Guion, vistas, módulos, agentes y evidencia | Legibilidad, consistencia visual y correspondencia con demo | Por acordar |

Todo entregar al cumplirse hora 24. Lo posterior no cuenta. Cualquier commit posterior al tag se ignora para evaluación. No usar fecha de esta sesión para simular una entrega en fechas anteriores.

## Presentación actual: demo y PPT

Decisión humana confirmada: no realizar video. Demostrar el mismo caso alternando candidato, reclutador, centro y orientador; PPT explicará idea y módulos. Consultar [guion y dirección visual](DEMO_PPT_DISENO.md). No trasladar a demo en vivo el límite de180segundos que el enunciado asignaba al video. No se ha creado presentación, diseño ni producto.

## Control de cierre

- Registrar responsable, estado y evidencia de entregables vigentes en REGISTROS.md; D08 descartado por usuario, P09/P10 describen demo/PPT del equipo.
- Verificar nombres de Mainor Villarreal y Giovanny Arpaia, reto y T0/T24; no añadir un tercer integrante.
- Congelar alcance antes de ensayar la demo; correr instalación y evals sobre el commit destinado a entrega.
- Examinar archivos a incluir: solo producto; no MAGI, runs internos, catálogos, entornos, credenciales o datos personales sin tratamiento.
- Verificar recorrido de demo, cambios de perfiles con autenticación real y PPT legible; guardar SHA y resultados de la misma versión.
- Crear/publicar tag solamente al confirmar ventana y acción correspondiente. El cronograma es pendiente; no crear tag durante planificación.
