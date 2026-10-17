# Metodología, arquitectura y operación de AImpulsa

> **Estado conciliado — 2026-10-17:** consultar [ESTADO_ACTUAL.md](ESTADO_ACTUAL.md) para distinguir implementación, evidencia histórica y pendientes de entrega. D8 figura corregido localmente y su migración remota aplicada/verificada; el ensayo manual completo y la traza de tres agentes siguen pendientes. Los evals finales están en [el paquete reproducible](../evals/README.md).

Actualizado: 2026-10-17. Reto 3 — Empleabilidad. Equipo: Mainor Villarreal y Giovanny Arpaia.

Este documento describe el prototipo implementado y sus límites. No declara cerrados todos los CU ni los evals del reto. Estado técnico vigente en [ESTADO_ACTUAL.md](ESTADO_ACTUAL.md), [entrega D8](D8_ENTREGA.md) y [despliegue remoto](CIERRE_MIGRACIONES_REPOSITORIO.md). La verificación integral y focal anteriores son antecedentes.

## 1. Problema, actores y alcance
La solución conecta tres lados: jóvenes que necesitan expresar experiencia y encontrar oportunidades, empresas que necesitan requisitos claros y centros que ofrecen formación con condiciones concretas. El orientador es una persona independiente que ayuda al joven autorizado, sin facultades empresariales.

[El catálogo CU01–CU17](CASOS_DE_USO.md) presenta objetivos y actores. [Las especificaciones](ESPECIFICACION_CASOS_USO.md) contienen entradas, reglas RGN, permisos, alternos y aceptación. Un CU describe una obligación funcional; su existencia en un documento no acredita implementación.

Entrada actual: texto y CV PDF con capa de texto. Sin audio, fotos/imágenes ni OCR propio en esta entrega. El prototipo combina funciones implementadas, funciones parciales y ampliaciones aplazadas, señaladas en la matriz de CU.

## 2. Arquitectura de tres capas
AImpulsa usa una separación lógica de **presentación, aplicación/negocio y datos**, desplegada actualmente como web local + API local + Supabase. La API es un monolito modular.

~~~mermaid
flowchart TD
    H[Actores humanos] --> W[Presentación: React y TSX]
    W -->|HTTP autenticado y DTO Zod| C[API: controladores Hono]
    C --> S[Servicios de casos de uso]
    S --> A[Adaptadores A01 A02 A03 A05]
    A -->|Herramientas autorizadas| S
    A --> V[Vertex AI]
    S --> K[C01 cálculo y controles C02 C03]
    K --> P[Prisma y SQL parametrizado con withActor]
    P --> D[PostgreSQL Supabase con RLS]
    W --> U[Supabase Auth]
    C -->|Valida sesión| U
    S --> F[Archivos privados del servidor]
~~~

Los controladores HTTP pertenecen al límite de presentación de la API; se organizan físicamente en apps/api. Los servicios concentran reglas y orquestación. Prisma/SQL y el almacenamiento implementan persistencia. Frontend/API son aplicaciones, y controller/service/module son responsabilidades internas: no se cuentan como tres capas adicionales.

No se introducen microservicios, un repositorio genérico sobre Prisma ni un bus de agentes. [Reglas de componentes/capas](REGLAS_COMPONENTES_CAPAS.md) y [stack](STACK_TECNICO.md).

## 3. Organización del código y lenguajes
| Elemento | Organización |
|---|---|
| Interfaz | apps/web/src/features por función; componentes reutilizables, hooks y CSS Modules |
| API | apps/api/src/modules por dominio: identidad, perfil, oportunidades, formación, planificación, reservas, empresa y orientación |
| Módulo | Registra rutas y dependencias; no ejecuta el caso de uso |
| Controlador | Obtiene identidad, valida DTO y traduce respuesta/error HTTP |
| Servicio | Autoriza por objeto, aplica reglas, coordina agente/cálculo y persiste efectos |
| Contratos | packages/contracts: Zod y tipos TypeScript compartidos |
| Datos | prisma/schema.prisma y migraciones SQL incrementales |
| Verificación | tests/api, tests/e2e y evals; tienen objetivos distintos |

TypeScript es el lenguaje principal; TSX expresa componentes React, CSS Modules los estilos y SQL las migraciones/políticas. JavaScript se usa en scripts. Runtime Bun, framework HTTP Hono, ORM Prisma/adapter-pg, frontend React/Vite y PostgreSQL/Auth Supabase. Las versiones exactas están en los manifiestos y lockfile.

## 4. Agentes, prompts y colaboración
A01 interpreta vacantes/temarios; A02 propone perfil y bancos de preguntas; A03 explica comparaciones; A05 explica rutas. A04 permanece aplazado. No se cuentan MAGI, desarrolladores Codex/Antigravity ni C01–C03 como agentes LLM del producto.

El código envía instrucciones de sistema, declara herramientas y procesa sus llamadas con límites. La información de CV/temario/vacante es entrada no confiable, no instrucciones del desarrollador. El servidor delimita ámbito y efectos. Las propuestas requieren revisión humana donde corresponda.

La colaboración utiliza resultados confirmados y versionados, no conversaciones libres entre modelos. A01 → mapa confirmado → A02 banco es un vínculo concreto. Perfil propuesto A02 → confirmación juvenil → perfil consultado por A03 es otro. A05 también puede calcular desde el perfil y los requisitos de la vacante sin invocar A03. No afirmar un encadenamiento automático diferente al código.

[COLABORACION_AGENTES.md](COLABORACION_AGENTES.md) detalla prompts, herramientas, archivos, ejemplos y evidencia pendiente. La traza correlacionada de tres agentes de un mismo caso todavía debe incorporarse como evidencia de entrega.

## 5. Cálculos y decisiones humanas
C01 compara requisitos, disponibilidad, mínimo salarial declarado y supuestos de traslado; en formación explora combinaciones acotadas de ediciones, costo de matrícula, sesiones y prerrequisitos. No se promete óptimo global fuera de la muestra.

La IA no calcula porcentajes, descuenta cupos, acredita competencias ni emite certificados. C02 representa validación, permisos y guardrails de código; C03 representa servicios de acción y recibos, no componentes LLM separados.

Una propuesta de plan no matricula; una candidatura no ocupa plaza laboral. Confirmar reserva es un efecto transaccional/idempotente. La finalización del centro, el certificado adjunto y el resultado de un ejercicio son registros distintos. Una declaración aceptada sin evidencia no se convierte en demostración.

Se usan tiempos de traslado aportados/supuestos explícitos; no hay una integración acreditada de rutas/tarifas MiBus/Metro. El salario se contrasta con el mínimo declarado del perfil, no con una tabla legal de salario mínimo. La evaluación integral de costo de transporte sigue limitada.

## 6. Datos, identidad y privacidad
Supabase Auth identifica la cuenta; la API valida su sesión y resuelve AppUser. Membresías delimitan empresa/centro. El orientador tiene habilitación independiente y acceso por acompañamiento autorizado.

Prisma/SQL ejecuta con rol runtime y contexto de actor bajo RLS. El navegador no recibe conexiones de BD ni ADC. La autorización se comprueba también por objeto; un rol enviado por el cliente o el LLM no la concede.

Catálogo, perfil confirmado, propuesta, banco/intento, plan, consentimiento/revisión y recibo tienen relaciones/versiones propias. Los esquemas y migraciones son la referencia para las tablas vigentes; las cifras antiguas de D1 no describen todo el producto.

Datos DEMO son sintéticos. No se declara cobertura completa de ESCO/O*NET, datos oficiales en vivo ni autenticidad académica de un PDF adjunto. Fuentes: [FUENTES.csv](FUENTES.csv).

## 7. Desarrollo, IA y control de cambios
1. Mainor y Giovanny aportan ideas, alcance y decisiones de producto.
2. Se investigan fuentes y se definen actores, CU, reglas, entidades y contratos.
3. Figma v2 guía navegación, componentes y temas; no sustituye aceptación funcional.
4. Cada bloque vertical integra vista, API, datos y controles del mismo objetivo.
5. Codex y Antigravity/Gemini aportan código/documentos según registro real, con integración/revisión y pruebas dirigidas.
6. La bitácora distingue decisiones humanas, correcciones IA, herramientas/modelos y evidencia; no presupone cambios manuales.

[BITACORA_IA.csv](BITACORA_IA.csv) registra autoría por bloque. MAGI es herramienta externa de desarrollo; no forma parte de la aplicación entregable.

## 8. Operación y recuperación
El README describe instalación/arranque. Preparar variables, esquema y roles; generar cliente Prisma; ejecutar API y frontend. Cambiar código no aplica una migración a Supabase. Los actualizadores incrementales permiten check/apply/verify sobre destino autorizado; check no equivale a apply.

Ante fallo de Vertex, conservar borrador/plan y ofrecer reintento/manual según el CU; no anunciar generación completada sin entrega. Evitar llamadas de red dentro de transacciones. Tras una escritura de resultado incierto, consultar el recibo antes de repetir el efecto.

Los certificados se almacenan en .local/certificates de una instancia privada. Conservar ese directorio al mover el servidor; no publicarlo como estático. Un despliegue multiinstancia necesita una solución de almacenamiento persistente adecuada.

## 9. Pruebas y límites de la evidencia
- Unitarias: cálculos, contratos y fronteras sin infraestructura.
- Integración: identidad, RLS, consentimiento, versiones, recibos y concurrencia en BD aislada.
- Navegador: recorrido de interfaz, recarga, carga/error y navegación.
- Live Vertex: acceso y conducta de un modo del agente con datos sintéticos.
- Evals de calidad: entradas/gold, métrica, umbral y resultado; no se reemplazan por compilar o contar tests.

La verificación integral y la focal D8 son snapshots, no sumas acumulables. El banco A02 tuvo un timeout real; perfil A02 sí pasó. No se declara disponibilidad garantizada ni cierre de modos que no terminaron.

La reserva independiente D8 figura corregida en la entrega posterior de Antigravity; Codex aplicó y verificó la migración remota. El [set publicado](../evals/README.md) registra 37 evals PASS sustentados por 94 pruebas. Siguen pendientes la traza de colaboración de tres agentes y el ensayo completo con cuentas reales. Pueden combinarse casos determinísticos, permisos, guardrails y calidad del modelo: el enunciado no exige 15 llamadas LLM. La instalación limpia y el paquete final/PPT no están acreditados por estas pruebas.

## 10. Entrega y explicación
El README enlaza actores, CU y especificaciones. La presentación debe conectar problema, arquitectura, colaboración y acción real antes de mostrar tecnología o código. Usar capturas concretas de interfaz/resultados y referencias al código/prompts; no capturar secretos o expedientes personales.

[Guía de presentación/evidencias](GUIA_PRESENTACION_Y_EVIDENCIAS.md), [guion de demo](DEMO_PPT_DISENO.md) y [entregables](ENTREGABLES.md). El equipo descartó video del plan de trabajo; no afirmar exención organizadora. No se retrofechan commits ni se crea final-24h sin la acción correspondiente.
