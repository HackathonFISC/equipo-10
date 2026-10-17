# D8 — Revisión focal de cierre

Fecha: 2026-10-17. Revisor: Codex. **Resultado: 27 pruebas focales PASS; un caso de reserva independiente todavía falla.** No se repitió E2E ni se modificó código del producto mientras Antigravity ejecutaba su recorrido.

## Verificado ahora

- Suite actual orientation-independent: **17 PASS, 0 FAIL, 79 aserciones**. Incluye las seis reproducciones anteriores y reserva independiente de una edición distinta.
- Regresión reservations-concurrency: **10 PASS, 0 FAIL, 37 aserciones**.
- Typecheck global: exit 0.
- CLI real `node --env-file=.env scripts/deploy-d8.mjs --check`: check_success; migración202610170010_independent_orientation pendiente, sin aplicar ni modificar registros remotos. El helper ahora tiene entrada CLI, valida checksums y contiene controles de esquema/runtime; --verify remoto no se ejecutó porque la migración sigue pendiente.
- Inspección: revisión rechaza PENDING, outdated y cambio de versión de vacante/perfil; añade recibo para reintento y AuditEvent. No se afirma que estas pruebas secuenciales demuestren todas las carreras concurrentes posibles.

Las suites se ejecutaron secuencialmente en un **tercer contenedor dedicado a esta revisión**, localhost:55455/aimpulsa_d8_review. Se copiaron solamente fixtures/pruebas a `.local/verification-d8-final/` con destino restringido al contenedor nuevo y configuración explícita de pruebas; no se cambiaron las guardas de configuración del producto. No se tocaron las BD55435/55445 usadas por otros trabajos. Hubo intentos iniciales fallidos de preparación del contenedor/configuración del fixture; no se contabilizan como fallos funcionales del producto ni como PASS. Los resultados anteriores son las ejecuciones válidas finales.

## Ajuste restante: reserva independiente de la MISMA edición

Ubicación: `apps/api/src/modules/reservations/reservations.service.ts`, búsqueda de planIdToCheck al faltar body.plan_id, aproximadamente líneas177–203.

La nueva búsqueda incluye todo acompañamiento histórico de esa edición, también revocado. Esto cierra la omisión de plan_id desde una ruta, pero bloquea indiscriminadamente la reserva independiente de esa misma edición. La prueba17 cubre otra edición, por lo que no detecta este caso.

Reproducción local ejecutada:

1. Joven solicita acompañamiento de una ruta que incluye edición E.
2. Orientador aprueba la ruta.
3. Joven revoca acompañamiento.
4. Joven decide reservar E por cuenta propia, sin plan_id, sin solapamiento ni cupo agotado.
5. API devuelve **409 ORIENTATION_REVOKED**; esperado por el contrato de reserva independiente: poder realizar una acción nueva explícita por cuenta propia, sin reaprovechar aprobación del orientador.

Probe: `.local/verification-d8-final/same-edition-probe.test.ts`, nombre `AUDIT independent same edition after revocation remains available`. **0 PASS, 1 FAIL**, 17 pruebas filtradas, 4 aserciones. No se cambió el código del producto para conseguir este resultado.

Corrección necesaria: distinguir y acreditar en servidor una acción procedente de la ruta y una nueva reserva independiente iniciada por el joven, con confirmación/recibo propios. No aceptar simplemente una bandera que eluda la revisión desde la misma acción de ruta; no inferir toda intención a partir de que la edición aparezca en una ruta histórica. Conservar capacidad, prerrequisitos, agenda y replays legítimos. Probar MISMA edición y OTRA edición por separado.

## Cierre acotado

La mayor parte de los hallazgos previos está reparada y comprobada. Este caso mantiene incompleto el contrato de reservas independientes; no anunciar cierre completo de D8 por 17 PASS. Una vez corregido, repetir este probe y las regresiones D8/reservas afectadas, sin reiniciar el E2E que ya esté corriendo. Queda aparte obtener el resultado de ese E2E y aplicar/verificar migración010 en el entorno final. No se hicieron llamadas Vertex, cambios remotos, commits ni push.
