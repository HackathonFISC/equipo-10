# Cuentas de demostración de AImpulsa

Preparación y verificación: 2026-10-17, Codex, por solicitud del equipo. Cuentas de prueba en el Supabase configurado para el proyecto.

| Cuenta | Rol | Acceso preparado |
|---|---|---|
| gio@mail.com | Postulante | Perfil vacío, sin historial anterior de Gio |
| jhon.doe@mail.com | Postulante | Perfil vacío para construir durante la demo |
| jane.doe@mail.com | Empresa / reclutadora | Membresía RECRUITER de Empresa Doe DEMO |
| alex.doe@mail.com | Centro de formación | Membresía TRAINING_MANAGER de Centro Doe DEMO |
| sam.doe@mail.com | Orientador independiente | Sam Doe habilitado; sin membresía empresarial ni de centro |

**Contraseña de las cinco cuentas: 123456.** Son credenciales de demostración solicitadas por el equipo, no claves de infraestructura. Los accesos empresariales y formativos están respaldados por organizaciones y membresías reales; no se concede el rol por un selector del navegador.

## Uso

Abrir la aplicación local en http://127.0.0.1:5173 e iniciar sesión con la cuenta correspondiente. Cerrar la sesión previa o utilizar perfiles separados del navegador. Las sesiones anteriores de la cuenta de Gio se revocaron al cambiar el correo.

La cuenta anterior de Gio, identificada mediante su perfil y asociada a exam@mail.com, pasó a gio@mail.com. Se conservaron su identidad de autenticación y AppUser, se eliminó el historial solicitado y se creó un CandidateProfile vacío nuevo. Si una pestaña conserva estado anterior, cerrar sesión y volver a entrar.

Empresa y centro empiezan con organizaciones DEMO nuevas: no se asignó la propiedad de cursos/vacantes de otras organizaciones. El orientador accede al joven solo tras el acompañamiento autorizado. No se creó formación, vacante ni un perfil confirmado artificial para simular una demo terminada.

## Limpieza realizada y límites

Por instrucción explícita del equipo se borró **solo lo asociado a Gio**, sin respaldo: 163 registros de perfil, versiones, experiencia, formación, fuentes, evidencias, actividad/recibos, un plan y una reserva; además, 7 archivos subidos asociados a sus fuentes. No se borraron los documentos originales de Descargas ni las fuentes del proyecto.

Antes de crear los nuevos accesos se comprobó que los conteos de todas las tablas app coincidían con los anteriores menos los registros seleccionados para eliminación. No se borraron catálogos, cursos, vacantes ni cuentas ajenas. La reserva eliminada deja de contar para el cupo calculado por reservas activas.

La limpieza administrativa se ejecutó en una transacción: se bloquearon las tablas afectadas, se suspendieron temporalmente sus triggers de aplicación que impiden borrar historial y se restauró su estado original antes del commit. Las claves foráneas no se deshabilitaron y se comprobó la restauración de triggers. No se cambiaron políticas RLS, migraciones ni permisos de la aplicación.

El primer intento falló por un conflicto de tipos en la inserción de identidad Auth y se revirtió completamente. Tras corregir el cast, la operación terminó con commit. No se guardaron respaldos de los registros borrados; los scripts/resultados administrativos locales solo conservan el procedimiento, IDs técnicos y conteos, fuera de Git.

## Verificación ejecutada

- Login real en Supabase con correo/contraseña: **5 de 5 PASS**.
- Verificación del token con el verificador real del API: **5 de 5 PASS**.
- Lectura del contexto mediante IdentityService y la conexión runtime con RLS: **5 de 5 PASS**.
- Gio/Jhon: perfil sin versión confirmada, sin membresías de organización ni habilitación de orientador.
- Empresa/centro: exactamente su membresía y tipo de organización.
- Sam: orientador habilitado, sin membresías de empresa/centro; visible en el listado autorizado de orientadores.
- Acceso del postulante al contexto de la organización empresarial: denegado.
- Sesiones creadas para esta verificación: cerradas al terminar.

Esto comprueba autenticación y contextos con usuarios reales del proyecto; no acredita todavía el ensayo completo de interfaz, colaboración de tres agentes ni los evals pendientes.
