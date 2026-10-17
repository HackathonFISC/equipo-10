# Cierre de migraciones y preparación del repositorio

Fecha: 2026-10-17. Ejecutor: Codex. Autorización: el equipo solicita aplicar las migraciones pendientes y limpiar los archivos para subir, y aclara que la copia conserva el desarrollo D7.

## Migración aplicada en Supabase

Se utilizó el helper existente con la configuración privada del servidor, sin imprimir credenciales. Antes de aplicar se revisaron el script y la migración; no se ejecutó reset ni db push.

| Ejecución real | Resultado |
|---|---|
| node --env-file=.env scripts/deploy-d8.mjs --check | check_success; pendiente únicamente 202610170010_independent_orientation |
| node --env-file=.env scripts/deploy-d8.mjs --apply | apply_success; aplicada 202610170010_independent_orientation; pending: [] |
| node --env-file=.env scripts/deploy-d8.mjs --verify | verify_success; pending: []; runtime_verified: true |

El helper comprobó las migraciones previas, checksum D8, cuatro tablas nuevas con RLS, tres enums y ausencia de permisos anon/authenticated sobre las funciones privadas consultadas. En verify comprobó acceso mediante equipo10_runtime y ausencia de filas privadas visibles sin actor en las tablas D8 consultadas.

Los conteos de CandidateProfile, ProfileRevision, Opportunity, Course y CourseReservation se mantuvieron iguales durante la aplicación. Esto acredita esos conteos y las verificaciones descritas, no una comparación de cada campo de toda la base ni aceptación funcional completa con cuentas reales.

## Ramas y copia D7

Tras actualizar referencias de origin, main y origin/main apuntaban a 5e448e0: cero commits pendientes por delante o detrás. codex/d7-centros también apuntaba a ese commit. El desarrollo posterior estaba en archivos modificados/nuevos, no en dos historiales de commits que debieran fusionarse.

La integración vigente está en equipo-10/main. La carpeta hermana equipo-10-d7 y la rama codex/d7-centros **se conservan** como respaldo del trabajo anterior; no se borraron ni se sustituyeron por main.

Se compararon, normalizando finales de línea, **35 archivos D7: 35 idénticos y ninguno ausente**:
- Módulos API training-center, training-assessments, training-participants y training-certificates.
- Interfaz training-center.
- Cuatro contratos compartidos.
- Migraciones 004–008.
- Cuatro suites de pruebas D7.

Los demás archivos compartidos tienen diferencias posteriores de integración, permisos, A05 y D8; no se copió masivamente la versión anterior sobre la actual.

## Selección para Git

Se prepara el índice de main con código, contratos, migraciones, documentación, lockfile y pruebas del producto. No se publican MAGI, dependencias, compilados, resultados privados, credenciales ni certificados personales.

Se añade a .gitignore solamente la configuración local apps/web/vite.d7.config.ts: depende de la carpeta hermana y no es configuración de entrega. El archivo queda intacto en disco. Las pruebas útiles y fixtures sintéticos siguen incluidos; limpiar no significa quitar evidencia de pruebas.

Se realizó una revisión automatizada de nombres sensibles, archivos grandes y patrones comunes de claves en los archivos candidatos, sin coincidencias. Es una comprobación acotada, no una auditoría exhaustiva de secretos. Se comprobará igualmente la selección final del índice.

No se crea un tag final ni se publica a GitHub en esta tarea. La rama de respaldo no debe subirse como segunda entrega. El número de archivos seleccionados y la validación del índice se registran al terminar en la [bitácora](BITACORA_IA.csv).

## Pendientes distintos del despliegue

La aceptación con Supabase Auth real, los evals semánticos y la preparación de demo/PPT siguen siendo actividades separadas. Esta tarea no repite las suites de aplicación ya registradas en [D8_ENTREGA.md](D8_ENTREGA.md).
