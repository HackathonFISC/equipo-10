# Activación D4 en la base habitual — 2026-10-17

Reporte: API Cursos falla con 503/P2021 porque `app.Course` no existe. La implementación local de Gemini no había sido aplicada a la base usada por la API habitual.

Codex revisó `scripts/deploy-d4.mjs` y la migración incremental. Check verificó D1/D3 previos y cero tablas D4. El primer apply se revirtió completo: el fixture de Gemini omitía `CourseLearningOutcome.description`, obligatorio. Check posterior volvió a confirmar cero tablas, sin instalación parcial. Se corrigió esa descripción y se usaron nombres de centro/sede explícitamente ficticios, sin aparentar una oferta real de UTP.

Resultado de activación:

- `node --env-file=.env scripts/deploy-d4.mjs --apply`: éxito; diez tablas, RLS habilitado y un curso DEMO con versión, resultado esperado, edición y horario.
- `--verify`: éxito usando la conexión real de API y rol equipo10_runtime. Lectura de cursos y joins de organización/versiones/ediciones; sesiones, resultados y prerrequisitos accesibles. Planes/reservas privados ocultos sin actor. Función de conteo de capacidad operativa.
- La función SECURITY DEFINER de capacidad quedó sin EXECUTE para PUBLIC/anon/authenticated; se conservó el acceso runtime requerido. El verificador comprueba esta frontera.
- Segundo `--apply`: éxito, mismo curso demo sin duplicados.
- Recuentos de candidatos, revisiones y vacantes no cambiaron en las transacciones de instalación. No reset, db push ni edición de perfiles reales.

La migración y su checksum quedan registrados por el actualizador. No se modificó el SQL de migración ya aprobado localmente; se corrigieron fixture y verificación del despliegue.

Esto verifica activación y lectura de datos con rol runtime; no acredita por sí solo calidad del planner, reservas concurrentes, ejecución A05 ni cierre completo D4. La sesión HTTP del usuario no fue operada. Sin llamada Vertex, commit ni push.
