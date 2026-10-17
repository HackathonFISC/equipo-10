# Arquitectura de agentes de AImpulsa — revisión 3

> **Estado conciliado — 2026-10-17:** consultar [ESTADO_ACTUAL.md](ESTADO_ACTUAL.md) para distinguir implementación, evidencia histórica y pendientes de entrega. D8 figura corregido localmente y su migración remota aplicada/verificada; el ensayo manual completo y la traza de tres agentes siguen pendientes. Los evals finales están en [el paquete reproducible](../evals/README.md).

Actualizado: 2026-10-17. Esta revisión distingue implementación, evidencia y ampliaciones. Sustituye el estado histórico que describía todos los agentes como propuesta sin código; no declara cinco agentes terminados.

## Roles del producto
| ID | Responsabilidad | Qué recibe y propone | Estado |
|---|---|---|---|
| A01 | Vacantes y contenido formativo | Texto y catálogo → puesto/requisitos o mapa de temario con citas y aclaraciones | Implementado; dueño revisa antes de publicar |
| A02 | Perfil y aprendizaje | Fuentes/perfil o mapa confirmado → propuestas de perfil o banco objetivo | Implementado por modos; banco live tuvo timeout en última verificación integral |
| A03 | Compatibilidad y brechas | Comparación, perfil/vacante autorizados y C01 → explicación y aclaraciones | Implementado; no solver global de asignación |
| A05 | Ruta de formación | Plan/objetivo y herramientas C01 → explicación de ruta y pendientes | Implementado y corregido; no reserva automáticamente |
| A04 | Materiales, práctica y coordinación de entrevistas | Diseño de CV/carta/práctica y propuestas de citas | Aplazado; no contar como implementado |

C01 calcula y verifica; C02 representa seguridad/equidad y trazas de código; C03 coordina estados, acciones y recibos en servicios. No son tres agentes LLM adicionales. El antiguo diseño de A05 Auditor fue sustituido por controles C02; A05 actual significa formación.

## Comunicación implementada
Los agentes no comparten una memoria global. Servicios autorizados les entregan datos del caso y herramientas. La BD conserva resultados versionados que otros modos pueden consumir después de confirmaciones humanas.

~~~mermaid
flowchart LR
    A01[A01 contenido] --> P[Propuesta con fuente]
    P --> H1[Empresa o centro revisa]
    H1 --> V[Vacante o mapa confirmado]
    V --> A03[A03 explica comparación]
    V --> A02B[A02 propone banco]
    A02P[A02 propone perfil] --> H2[Joven confirma]
    H2 --> R[Perfil y evidencia versionados]
    R --> A03
    R --> C[C01 compara y planifica]
    V --> C
    C --> A05[A05 explica ruta]
    C --> A03
    A03 --> H3[Joven decide]
    A05 --> H3
    H3 --> O[Servicios de postulación o reserva]
~~~

El diagrama resume dependencias de datos; no afirma que todas esas llamadas se hayan ejecutado juntas. El centro revisa el banco antes de ofrecerlo. El intento del joven es privado; C01 corrige respuestas objetivas y el joven confirma por separado asociar el resultado. Esa asociación no acredita automáticamente todo el curso.

A05 puede planificar leyendo requisitos de la vacante directamente. No se representa una llamada automática A03 → A05 que el servicio no hace. La evidencia correlacionada de tres agentes en un caso sigue pendiente.

## Fronteras de responsabilidad
- Extraer/proponer no confirma datos: su dueño revisa fuente y versión.
- Catálogo común es acotado/versionado; una propuesta no crea equivalencias globales.
- Un curso esperado no es habilidad adquirida; una reserva no es finalización/certificado.
- Empresa recibe solo candidatura consentida y datos minimizados; el centro no recibe respuestas privadas por administrar cursos.
- Orientador accede al ámbito autorizado y propone correcciones; el joven conserva sus datos y acciones.
- Tratar CV/temario/vacante como datos no confiables; el texto no otorga permisos.
- Cálculos, cupos, permisos y efectos se resuelven en código. La explicación LLM no puede conceder acceso ni alterar C01.
- Persistir fuentes, versiones, aprobaciones, actor y recibos; no guardar razonamiento interno ni secretos en evidencias públicas.

## Código, contratos y validación
[Colaboración, prompts y herramientas](COLABORACION_AGENTES.md) contiene los enlaces al código y los pasos de intercambio. [Mapa CU/agentes](MAPEO_CASOS_AGENTES.md) conserva la asignación de diseño; sus ampliaciones no se cuentan como implementadas.

[Metodología](METODOLOGIA.md) describe las tres capas lógicas y su operación en frontend/API/datos. [Catálogo](CASOS_DE_USO.md) y [especificación](ESPECIFICACION_CASOS_USO.md) señalan estado de cada CU. Evidencia: [verificación integral](VERIFICACION_INTEGRAL_D1_D8.md), [corrección A05](CORRECCION_A05_EVIDENCIA_LOGISTICA.md) y [revisión focal D8 histórica](REVISION_D8_CIERRE_FOCAL.md), seguida de [D8 corregido](D8_ENTREGA.md) y [migración aplicada/verificada](CIERRE_MIGRACIONES_REPOSITORIO.md). No se atribuye a MAGI ni a los desarrolladores el cumplimiento del mínimo de agentes del producto.
