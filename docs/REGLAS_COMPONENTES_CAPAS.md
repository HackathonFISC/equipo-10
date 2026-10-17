# Reglas Canónicas de Componentes y Capas de Software

**Estado:** Vigente y obligatorio a partir de D2.  
**Alineación:** Clean Architecture acotada, React 19, Hono, Prisma 7, PostgreSQL (Supabase).

---

## 1. Arquitectura de Tres Capas Canónicas

El sistema se estructura estrictamente en tres capas. No se permite la creación de capas intermedias artificiales:

1. **Capa de Presentación (`apps/web`)**: Componentes de interfaz React, hooks de estado local, estilos CSS Modules con design tokens. Prohibido ejecutar consultas directas de datos o llamadas a bases de datos.
2. **Capa de Aplicación y Dominio (`apps/api`)**: Módulos verticales Hono organizados por contexto de negocio en `apps/api/src/modules/<feature>/` con estas responsabilidades principales y helpers acotados cuando sean necesarios:
   - `<feature>.module.ts`: Ensamblado de rutas y wiring de dependencias. Prohibida la lógica de negocio o validación directa aquí.
   - `<feature>.controller.ts`: Extracción de identidad (`actorId`, `role`), validación de esquemas Zod de entrada/salida y serialización de respuestas HTTP.
   - `<feature>.service.ts`: Orquestación de reglas de dominio e invariantes de negocio. **Prohibido recibir o manipular instancias de `c: Context` o peticiones HTTP de Hono**.
   - *Integración de IA (A01–A05)*: Los adaptadores de agentes de IA son componentes integrados dentro de la Capa de Aplicación (invocados por servicios), **no constituyen una tercera capa de infraestructura independiente**.
3. **Capa de Datos y Persistencia (`prisma/schema.prisma` y PostgreSQL)**: Acceso tipado exclusivo mediante `@prisma/adapter-pg` dentro de transacciones acotadas (`withActor`) bajo el rol `equipo10_runtime` con variables GUC aplicadas.

---

## 2. Reglas de Frontend (`apps/web`)

### Organización de Componentes
- Organizar vistas y componentes por dominio/feature bajo `apps/web/src/features/<feature>/` (ejemplo: `features/identity/` o `features/profile/`).
- Reutilizar componentes compartidos existentes en `apps/web/src/components/Controls.tsx`. No introducir directorios alternativos como `src/components/ui/` mientras los componentes actuales satisfagan la interfaz.
- Separar estrictamente hooks de estado de vista de las funciones de comunicación de red.
- La comunicación HTTP debe consumir el cliente existente `apps/web/src/lib/api.ts`. No crear `services/apiClient.ts` ni capas cliente redundantes.
- Prohibido incorporar nuevas dependencias de gestión de estado global (como Redux o Zustand); utilizar estado de React y contextos nativos.

### Estilos y Tokens
- Emplear CSS Modules manteniendo coherencia con los tokens de diseño definidos en `apps/web/src/styles/tokens.css` (con contexto de tema en `apps/web/src/app/theme.tsx`).
- Prohibido el uso de colores codificados en duro (*hardcoded*); reutilizar siempre tokens existentes. Si no existe un token de espaciado para una necesidad visual específica, reutilizar tokens semánticos afines o proponer un token reutilizable en `tokens.css`.

### Manejo de Estados y Errores UI
- Toda vista con carga asíncrona debe modelar explícitamente: carga inicial (`loading`), guardado (`saving`), error descriptivo y estado vacío con instrucciones de acción.
- Errores de concurrencia optimista (`HTTP 412 Precondition Failed` / conflicto de versión) deben mostrarse claramente indicando al usuario que recargue los datos.
- No mostrar ceros no tipados, estados indefinidos o valores `unknown` sin formato.

---

## 3. Reglas de Backend y Dominio (`apps/api`)

### Módulos Verticales y Controladores
- El módulo de perfil debe organizarse como módulo vertical separado en `apps/api/src/modules/profile/` junto al módulo de identidad (`apps/api/src/modules/identity/`). Se permiten helpers de dominio pequeños según necesidad sin imponer un límite rígido de 3 archivos. Prohibido crear rutas sueltas como `src/routes/profile.ts` o servicios en `src/services/` raíz.
- El controlador valida DTOs de entrada utilizando **exclusivamente los esquemas Zod compartidos** importados de `@equipo10/contracts` (`packages/contracts/src/index.ts`). Prohibido implementar parsers o validaciones manuales paralelas.

### Servicios de Dominio
- Los métodos de servicio reciben DTOs planos y tipos primitivos validados; devuelven modelos de dominio tipados o lanzan errores de dominio con código de estado asociado.
- Prohibido acoplar `service.ts` con cabeceras, cookies o tipos de frameworks web.

### Acceso a Datos y Transaccionalidad
- Las operaciones de persistencia se ejecutan siempre dentro del helper `db.withActor(actorId, async tx => ...)` para asegurar el aislamiento multinquilino y RLS.
- Las transacciones de base de datos deben ser ultracortas: abarcar estrictamente lecturas y escrituras atómicas. **Queda terminantemente prohibido ejecutar llamadas de red, inferencias de LLM o procesamiento de agentes dentro de un bloque transaccional de base de datos**.
- Nunca exponer modelos crudos de Prisma directamente hacia el frontend; todo payload saliente debe ser serializado y filtrado según el contrato Zod correspondiente.
- No implementar capas de repositorio genérico abstractas sobre Prisma.

---

## 4. Definición de Hecho (Definition of Done - DoD)

Una tarea o bloque funcional se considera terminado únicamente cuando satisface:
1. **Contratos Zod**: DTOs de entrada y salida actualizados y tipados en `packages/contracts/`.
2. **Permisos y Seguridad**: Verificación estricta de autorización y contexto de actor en UI, API y persistencia RLS.
3. **Pruebas Críticas**: Test unitario o de integración verificable para la ruta crítica del cambio.
4. **Evidencia y Trazabilidad**: Verificación observable registrada formalmente sin conjeturar ejecuciones.
5. **Limpieza Técnica**: Ausencia de `TODO` o marcadores pendientes en rutas críticas del flujo entregado.

---

## 5. Vinculación con Skills de MAGI

Esta guía define el estándar técnico transversal de implementación. Para asegurar la carga efectiva en sesiones de desarrollo guiadas por agentes, refiérase y vincule este documento en:

- `.opencode/skills/magi-equipo10-desarrollo/SKILL.md`
- `.opencode/skills/magi-equipo10-validacion/SKILL.md`

*(La carga efectiva se documenta mediante referencia explícita en los prompts de trabajo, sin asumir autodescubrimiento por CLI).*
