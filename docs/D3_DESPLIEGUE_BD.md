# Activación de D3 en la base de la aplicación

Fecha: 2026-10-17. Motivo: el usuario reportó 503/P2021 en `tx.opportunity.count()`: `app.Opportunity` no existía en la base utilizada por su API.

Se creó `scripts/deploy-d3.mjs`, limitado a la migración `202610170001_opportunities` y un fixture demo versionado. Verifica destino Supabase coincidente entre URLs configuradas sin imprimir credenciales, TLS con CA, migraciones base, checksum de D3 y ausencia de estado parcial. La aplicación usa transacción, lock de despliegue y registro en `public._prisma_migrations`; no resetea esquemas ni aplica otras migraciones.

Se aplicó la migración de cuatro tablas y sus políticas/permisos a la base configurada. Se agregó un catálogo sintético, una organización ficticia y una vacante «Auxiliar de soporte — DEMO», con su requisito. Todos usan IDs estables y el fixture no crea cuentas, candidatos, postulaciones ni membresías. No representa una oferta real ni una importación de ESCO.

Verificación ejecutada:

- `node --env-file=.env scripts/deploy-d3.mjs --check`: inicialmente cero tablas D3 y migración pendiente.
- Primer apply: se revirtió íntegro al comprobar que la cuenta de migración no puede asumir `equipo10_runtime`. Se corrigió el verificador para usar DATABASE_URL, sin otorgar nuevos privilegios. Check posterior confirmó cero tablas persistidas.
- `--apply`: éxito, cuatro tablas, RLS habilitado, una vacante demo y recuentos de perfiles/revisiones/experiencias/formación conservados dentro de la transacción.
- `--verify`: conexión con las credenciales reales de API, `SET LOCAL ROLE equipo10_runtime`; lectura de vacantes, requisitos y joins de organización/ocupación correcta. Una demo visible. Comparaciones y explicaciones no visibles sin actor. Verificación de solo lectura y rollback.
- Segundo `--apply`: éxito sin duplicar fixture; una demo. Registro de checksum vigente.

Esto verifica el esquema y las lecturas requeridas con rol runtime; no suplanta al usuario ni acredita una navegación HTTP autenticada completa desde su sesión. No se enviaron documentos a Vertex. No hubo commit/push.

Uso futuro: `node --env-file=.env scripts/deploy-d3.mjs --check|--apply|--verify`. El actualizador histórico D1 tiene expectativas de número fijo de tablas; no usarlo como verificador global después de D3 sin actualizar sus criterios en un encargo separado.
