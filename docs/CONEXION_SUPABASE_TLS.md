# Conexión Supabase: diagnóstico y confianza TLS

Fecha: 2026-10-16. Resolución local de conectividad autorizada por el usuario; sin migraciones ni cambios en tablas, Auth, políticas, facturación o SSL enforcement del servidor.

## Problema y resolución

DATABASE_URL y DIRECT_URL usan Session pooler. El servidor era alcanzable, pero su cadena no estaba en el almacén de confianza utilizado por el cliente: `self-signed certificate in certificate chain` (código19). El certificado público Supabase Root 2021 CA permite verificar la cadena y el hostname en Node con `pg`, manteniendo `rejectUnauthorized: true`.

Certificado: `certs/supabase-prod-ca-2021.crt`, obtenido mediante HTTPS desde el [servidor de descargas de Supabase](https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt). SHA256 del archivo: `700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7`. Sujeto/emisor: Supabase Root 2021 CA; vencimiento observado 2031-04-26. Es un certificado público, no una clave privada; se puede versionar. Renovación exige verificar la fuente y volver a comprobar conexión, sin confiar en certificados recibidos de servidores no autenticados.

La [guía oficial](https://supabase.com/docs/guides/platform/ssl-enforcement) requiere configurar la CA en el cliente además de cifrar; `verify-full` verifica certificado y hostname. No se instaló una nueva CA global en Windows ni se utilizó `rejectUnauthorized:false`, `CERT_NONE` o `NODE_TLS_REJECT_UNAUTHORIZED=0`.

Python3.13, incluso con la CA correcta, detectó código92: falta de extensión Key Usage en la cadena intermedia. Es una incompatibilidad de esa comprobación estricta; no se desactivó dicha comprobación para fingir éxito. Usar el driver Node con validación de CA y hostname resuelve la conexión prevista para API TypeScript. [Incidencia en el repositorio de Supabase](https://github.com/supabase/supabase/issues/50862). No asumir que este hallazgo significa que todos los runtimes/SDKs ya están configurados.

## Configuración y comprobación reproducible

`.env` conserva URL/credenciales sin mostrarlas. Se añadió `DATABASE_SSL_CA_FILE="certs/supabase-prod-ca-2021.crt"`; `.env.example` contiene el mismo campo sin secretos. Esta variable es contrato del proyecto: **no es una variable que Prisma interprete automáticamente**. El futuro adaptador/API deberá leer el PEM y aplicar TLS con validación explícita; si el cliente utiliza parámetros URL de SSL, evitar que reemplacen esa configuración.

Diagnóstico desde la raíz, con `pg` disponible:

```powershell
node --env-file=.env scripts/check-db-connection.cjs
```

Para verificar sin instalar dependencias en el producto, se instaló `pg` en un directorio temporal externo mediante npm, sin scripts de instalación. Se ejecutó el mismo diagnóstico pasando la ruta absoluta temporal al módulo `pg` como argumento final; se retiró ese directorio al terminar. No hay package.json, lockfile o node_modules nuevos en el repo. Cuando se cree la aplicación, declarar la dependencia/adaptador que realmente se elija en D1.

El diagnóstico consume credenciales localmente para autenticar únicamente con el destino configurado, oculta valores/errores crudos y ejecuta `BEGIN READ ONLY`, `SELECT 1 AS ok` y `ROLLBACK`. Elimina parámetros SSL de la URL solo en memoria para impedir que sustituyan la opción de verificación; no modifica la URL guardada. No ejecutar consultas de aplicación ni DDL.

Resultado real en ambas conexiones: autenticación correcta, SELECT1 correcto, socket autorizado y TLSv1.3. Verificación repetida con el helper persistido: ambas conexiones correctas, salida 0. La comprobación demuestra conexión y autenticación; no permisos por candidato, RLS, esquema, migraciones, datos aislados de pruebas ni funcionamiento del producto. La configuración del driver Prisma y roles de BD continúa pendiente de D1.
