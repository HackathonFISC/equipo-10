# Evals de AImpulsa — entrega final

Fecha de ejecución: 2026-10-17. **37 casos evaluados: 37 PASS, 0 FAIL**, sustentados por **94 pruebas ejecutadas** en 10 suites. Los casos seleccionan pruebas concretas y no se suman ejecuciones repetidas como casos nuevos.

- [Casos y resultados resumidos](casos.csv).
- [Manifiesto: fixture, caso, métrica y selector](manifest.json).
- [Resultados estructurados y huella de archivos evaluados](resultados.json).
- [Casos E01–E20 de diseño inicial](casos_diseno_inicial.csv), conservados sin atribuirles resultados no medidos.
- Evidencias sanitizadas JUnit y consola en evidencia/. Cada resultado enlaza sus archivos.
- [Verificación técnica anterior](verificacion_d1_d8.json): snapshot histórico anterior a las correcciones D8, no el dictamen final de estos evals.

## Reproducción

Requiere dependencias instaladas y los contenedores de pruebas locales existentes:
- 127.0.0.1:55435/equipo10_d1_test.
- 127.0.0.1:55445/aimpulsa_d7_test.

Ejecutar desde la raíz:

~~~powershell
bun --no-env-file scripts/run-evals.mjs
~~~

El ejecutor elimina variables de conexiones y credenciales heredadas, usa los destinos locales restringidos de los fixtures y ejecuta las suites **secuencialmente**, porque reinicializan su esquema de pruebas. No cargar URLs Supabase como destinos de test. No ejecutar suites simultáneas contra esas bases.

Cada caso F01–F37 referencia la prueba/fixture y su resultado esperado. La métrica es cumplimiento de las aserciones de la regla evaluada; umbral 100% de las comprobaciones del caso, con suite completa sin fallos. El resultado registra cantidad de pruebas concretas coincidentes, PASS/FAIL y exit code. No es precisión semántica general del modelo.

En F01–F13, el gold y las expectativas de C01 preceden la ejecución en tests/fixtures/d3/expected.json. En los demás casos, entradas y resultados esperados están fijados en las suites enlazadas. No se ajustó el código del producto para obtener PASS.

## Cobertura

- Salario, unidades monetarias, horario, traslado y desconocidos.
- Requisitos esenciales/deseables/entrenables, evidencia y cobertura sin denominador.
- Invariancia al cambiar datos contrafactuales con logística fija.
- Presupuesto formativo, solapamientos, capacidad de última plaza y cancelación.
- Idempotencia, acceso a reservas ajenas, consentimiento y revocación.
- Aprobación de ruta, cambios de versión y reserva independiente tras revocación.
- Alertas discriminatorias y bloqueo de publicación.
- PDF digital, dos columnas, PDF corrupto y escaneo sin texto.
- Respuesta de IA truncada, evidencia inventada y entrega incompleta.

## Qué se simuló y qué no

Las integraciones usan PostgreSQL y servicios reales en bases aisladas, con actores y datos sintéticos. A02-result y partes de A05-regression simulan respuestas de Vertex; recruitment-safety inyecta el análisis semántico. Estos casos prueban controles del sistema frente a salidas controladas, no calidad universal de Gemini.

F30 comprueba que el parser conserva las instrucciones maliciosas como texto: no acredita por sí solo resistencia del modelo a toda inyección. El caso contrafactual comprueba invariancia C01; no mide por sí solo sesgo en todas las respuestas de IA ni representatividad social.

El set base no invoca Vertex. Se excluyen por selector las llamadas reales en las suites mixtas; sus skips no cuentan como PASS. La [comprobación real separada de A02](vertex-a02.json) terminó con **TIMEOUT a los 120 s: 0 PASS, 1 FAIL**, sin respuesta final ni etapa causal atribuida. Su JUnit y log se conservan. Por tanto, el conjunto completo de esta tarea comprende 37 evals offline aprobados y una comprobación live fallida; no afirmar que toda la IA real pasó.

## Integridad y versiones

resultados.json identifica el commit de partida y la huella SHA256 de archivos de código/contratos/SQL/scripts/pruebas evaluados. El commit final incluye esos mismos archivos y este paquete de evidencia; su SHA se obtiene con git rev-parse final-24h^{commit}. No se modifica después el commit para insertar su propio SHA en un resultado circular.

El ejecutor salió inicialmente con error al resolver el shim de Bun en Windows; se corrigió usando el ejecutable de Bun que lo ejecuta. Después una configuración global VERTEX_DISABLED interfería con dos pruebas simuladas A05: se habilitó únicamente para esa suite, manteniendo sus mocks de red. La ejecución final de 10 suites es la publicada; no hubo correcciones del producto durante el proceso.

## Límites que continúan

Este set satisface el mínimo numérico de casos con métricas/resultados, pero no declara cerrados todos los requisitos del reto. Siguen aparte la evidencia de tres agentes colaborando en un mismo caso real, el ensayo completo de interfaz con cuentas reales, instalación limpia, PPT y aceptación administrativa. A04, voz/fotos y solver laboral global no se presentan como evaluados ni implementados.
