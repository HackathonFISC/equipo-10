# Integración de Antigravity y D7

Fecha: 2026-10-17. Estado: **D5/D6 reducido y núcleo D7 integrados en la carpeta principal, verificados localmente; migraciones aplicadas y verificadas en la base Supabase configurada**. Este documento prevalece sobre los estados históricos de copia aislada y los siete errores de tipos anteriores.

Carpeta activa: `magi/solucion/equipo-10`. Se conservaron los cambios finales de Antigravity y se incorporaron selectivamente módulos, contratos, navegación, modelos y pruebas de D7; no se copió toda la rama antigua. La carpeta `equipo-10-d7` queda como referencia histórica. No hubo commit, push ni publicación del frontend/API.

## Qué se corrigió al integrar

- Rutas, nombres de campos y envelopes de empresa/postulación que no coincidían entre React y Hono. Publicación ahora envía los contratos validados; las aclaraciones pasan por PATCH y nuevo análisis. El editor permite revisar prioridad/etapa de requisitos, confirmar y recuperar el borrador de la pestaña.
- Reintentar una autorización antigua después de retirarla ya no vuelve a compartir el perfil. Reactivar exige una acción nueva con clave propia, versión confirmada vigente, recibo y auditoría. Una retirada antigua tampoco revoca una autorización posterior. La interfaz conserva claves en reintentos y crea otras para nuevas acciones.
- La consulta empresarial usa C01 y distingue declarado/documentado/desconocido. No cuenta una declaración sin evidencia como requisito comprobado. Las restricciones y ventanas consentidas quedan disponibles a C01 por RLS; la ausencia sigue pendiente. DTO empresarial excluye nombre, correo, sexo y fotografía.
- Editar título u otro campo ya no borra alertas semánticas. Publicar vuelve a comprobar la propuesta mediante A01 fuera de la transacción y bloquea alertas. El catálogo queda fijado al borrador y se validan sus identificadores.
- Operaciones empresariales requieren organización COMPANY activa; un administrador de centro no hereda permisos de empresa. Migración009 corrige también las políticas RLS, sin reescribir003.
- D7: cursos/avance/mapa, banco revisado, intento privado, corrección objetiva y asociación voluntaria, participantes/finalización y certificados existentes privados. Se preserva el control de recibos de bancos tras revocación y la descarga CORS autenticada.

## Evidencia ejecutada sobre la carpeta principal

| Suite | Resultado |
|---|---|
| recruitment-applications | 8 PASS |
| recruitment-safety | 7 PASS |
| application-safety | 6 PASS |
| training-center | 8 PASS |
| training-participants | 9 PASS |
| training-assessments | 18 PASS |
| training-certificates | 8 PASS |
| deploy-d5-d7 | 2 PASS |
| **Total** | **66 PASS, 0 FAIL; 262 aserciones** |

Suites ejecutadas una por vez en la base aislada55445 `aimpulsa_d7_test`, sin usar ni resetear55435. La prueba heredada de empresas se trasladó al fixture aislado y se corrigieron dos expectativas obsoletas: declaración sin evidencia no equivale a50% de cobertura; tras retirada, la empresa recibe una lista sin esa candidatura.

`bun run typecheck`, `bun run build`, `prisma validate` y generación del cliente Prisma: aprobados. El build mantiene un aviso no bloqueante de bundle aproximado820kB. No se actualizaron dependencias.

Playwright CLI sobre la aplicación integrada y datos sintéticos:

1. Empresa describe → A01 inyectado → revisa → confirma/publica → joven autoriza → recarga conserva candidatura → empresa consulta DTO minimizado → joven retira → empresa recibe cero candidaturas.
2. Centro confirma banco → registra finalización → adjunta PDF técnico → joven consulta y descarga el archivo privado.
3. Joven consiente ejercicio → DTO previo sin respuesta correcta/rúbrica → entrega → C01 → asociación al perfil → limpiar sessionStorage y recargar recupera resultado e historial del servidor.

Los recorridos de navegador usan IA inyectada y autenticación sintética, no se presentan como aceptación manual con cuentas reales Supabase. Las pruebas reales de A01/A02 por Vertex descritas en D7_NUCLEO_VERIFICADO corresponden a la etapa previa, no se repitieron para gastar cuota al integrar. El fixture C ahora permite login/refresh del tercer actor sintético; su token ya existía en los tests de Antigravity.

## Base de datos activa

Se creó `scripts/deploy-d5-d7.mjs` con modos `--check`, `--apply`, `--verify`. Comprobó proyecto/destino, TLS, prerequisitos D1/D3/D4, checksums y ausencia de esquema parcial. Aplicó en una transacción y registró en `_prisma_migrations`:

`202610170003_applications_and_recruitment`,004 training_center_access,005 training_completion,006 training_workspace,007 training_assessments,008 training_certificate y009 company_scope.

Resultados reales: `check_success` → `apply_success` → `verify_success`. No quedaron migraciones de ese lote pendientes. Las cantidades preexistentes de perfiles, versiones, oportunidades, cursos y reservas no cambiaron. No se sembraron usuarios, organizaciones, candidaturas ni certificados en remoto. La verificación abrió conexión con DATABASE_URL y rol equipo10_runtime, comprobando que sin actor no lee los registros privados nuevos. Se comprobó también que funciones privadas no sean ejecutables por anon/authenticated.

El actualizador no reinicia la base ni adopta tablas desconocidas sin ledger. Conserva los checksums originales; elimina solo envolturas BEGIN/COMMIT externas al juntar las migraciones. No ejecutar los fixtures de pruebas contra Supabase.

## Uso y pendientes

Usar la carpeta principal. Mi cuenta muestra gestión de vacantes para miembros de empresas y gestión de centro para TRAINING_MANAGER/ADMIN de centros. Las membresías deben existir realmente; no se otorgaron permisos a personas o cuentas remotas al integrar. Si la API no está en modo watch, reiniciarla y recargar la web para tomar el código nuevo.

Los certificados están en almacenamiento local privado `.local/certificates`, excluido de Git; conservarlo y respaldarlo al mover el servidor. No son archivos públicos ni almacenamiento multiinstancia.

Siguen fuera del núcleo: preguntas abiertas, diagnóstico general de formación externa sin temario, cambios/versiones de cursos ya publicados y correcciones históricas de finalización, funciones D5/D6 aplazadas, evals semánticas completas del reto y aceptación con autenticación real. La reserva del recorrido de finalización era un fixture previo; no declarar verificado en navegador el recorrido entero de reserva D4 por ese test. El usuario debe revisar la demo final y los entregables del reto.

Autoría: Antigravity/Gemini entregó la base D5/D6; coordinación, integración y correcciones descritas por Codex y subagentes Codex. D7 fue implementado por Codex; Gemini3.8Flash por Vertex actuó como modelo del producto en pruebas reales previas. Aprobación funcional/visual humana según conversación; ninguna edición manual humana adicional confirmada. No se atribuye la escritura de las correcciones a las llamadas del agente del producto.
