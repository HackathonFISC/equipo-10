# Guardado de propuestas: vencimiento de transacción

Fecha: 2026-10-17. Autoría: corrección y pruebas por Codex; reporte y log aportados por el usuario.

## Causa confirmada

El log del usuario muestra `P2028` al ejecutar `trainingDeclaration.create`: transacción con límite de 5000 ms, vencida a los 5116 ms. La API convertía este error en un 503 genérico. No era evidencia de caída de la base de datos.

La [documentación de Prisma 7](https://docs.prisma.io/docs/orm/v7/prisma-client/queries/transactions) establece 5 segundos de límite predeterminado para transacciones interactivas y permite configurarlo por operación. El lote realiza varias inserciones de declaraciones, evidencias, enlaces y recibo; además repetía lecturas del mismo fragmento.

## Corrección

- `withActor` admite opciones de transacción manteniendo rol local, actor y validación de cuenta. Sus valores predeterminados no cambian para el resto de operaciones.
- Solo `applySuggestionBatch` configura 30000 ms de ejecución y 8000 ms de espera para adquirir transacción.
- Las fuentes aceptadas se consultan una sola vez por lote, con filtro por perfil. Se comprueba que todas existan y que no estén retiradas; los enlaces usan esos fragmentos autorizados. No se omite la verificación de fuentes.
- Un P2028 devuelve `DATABASE_TRANSACTION_TIMEOUT`, recuperable y comprensible, conservando el rechazo del lote. No se reintenta automáticamente una escritura.
- Se mantiene una única transacción para declaraciones, evidencia, revisión, recibo y auditoría. El reintento del cliente usa su misma clave de idempotencia.

## Verificación

Base aislada: PostgreSQL local `127.0.0.1:55435/equipo10_d1_test`. No se modificó Supabase ni se añadieron migraciones.

La prueba de lote introduce un segundo de retraso en cada inserción de experiencia, formación, evidencia y enlace mediante triggers temporales de la base de pruebas, retirados en `finally`. El guardado de dos propuestas ejecuta seis inserciones y supera el límite antiguo.

Antes de la corrección: se reprodujo P2028 con 5000 ms y 5341 ms transcurridos, respuesta 503. Las pruebas posteriores que dependían del lote también fallaron al no existir los registros revertidos.

Después: el lote demorado completa y su reintento devuelve el mismo recibo, sin duplicados. Se verifica además rollback de una inserción en una transacción deliberadamente vencida, con error recuperable específico.

Comando: `bun test tests/api/a02-interpretation.test.ts tests/api/a02-result.test.ts`. Resultado final en bitácora. `bun run typecheck`: exit 0.

No se realizó un guardado del CV personal en producción desde esta revisión. La comprobación en la sesión del usuario sigue correspondiendo a su siguiente intento de guardado. No hubo llamada Vertex, commit ni push.
