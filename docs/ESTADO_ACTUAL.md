# Estado actual de AImpulsa

Corte documental: 2026-10-17. Equipo humano: Mainor Villarreal y Giovanny Arpaia. Base de código entregada en main: 509a2b6; esta conciliación modifica documentación y no acredita una ejecución nueva del producto.

## Cómo resolver estados contradictorios

El enunciado oficial y las decisiones humanas conservan su autoridad. Para conocer implementación y pendientes, usar este estado, la matriz de [casos de uso](CASOS_DE_USO.md) y las evidencias posteriores de cada bloque. Una propuesta antigua no se convierte en requisito nuevo. Un informe de pruebas conserva lo ocurrido en su versión; una corrección posterior debe citarse aparte.

## Implementación y verificación disponibles

| Área | Estado y evidencia |
|---|---|
| D1–D4 | Base, perfil, oportunidades y formación implementados con límites; pruebas técnicas en [verificación integral histórica](VERIFICACION_INTEGRAL_D1_D8.md). |
| D5/D6 reducido y D7 | Empresa/candidaturas consentidas y núcleo de centros integrados; [integración](INTEGRACION_D5_D7.md) y [núcleo D7](D7_NUCLEO_VERIFICADO.md). Copia D7 conservada como respaldo. |
| D8 | Orientador independiente, consentimiento, aclaraciones, dictamen y revocación. Antigravity registra corregidas las fronteras y suites locales en [entrega D8](D8_ENTREGA.md). |
| Supabase | Migración 0010 aplicada por Codex y verificada con runtime, sin pendientes del helper D8. [Ejecución de despliegue](CIERRE_MIGRACIONES_REPOSITORIO.md). No equivale a aceptación manual de todos los recorridos. |
| Código publicado | Main remoto 509a2b6 comprobado en la revisión de entrega. No consta tag final-24h en aquella consulta. |
| Agentes del producto | A01, A02, A03 y A05 implementados por modos; A04 aplazado. Vertex mediante REST y ADC del servidor. La IA de desarrollo/MAGI no cuenta como agente del producto. |

Secuencia de evidencia D8: [revisión integral con fallos](VERIFICACION_INTEGRAL_D1_D8.md) → [revisión focal con una frontera restante](REVISION_D8_CIERRE_FOCAL.md) → [corrección local registrada por Antigravity](D8_ENTREGA.md) → [migración aplicada y verificada por Codex](CIERRE_MIGRACIONES_REPOSITORIO.md). Se conservan los resultados de cada ejecución; no se reescriben los fallos históricos como PASS ni se suman suites repetidas como casos únicos.

## Alcance vigente

- Texto escrito/pegado y PDF con capa de texto. Audio, fotos/imágenes y OCR propio excluidos.
- Postulación y reservas internas consentidas; orientador independiente del empleador y centro.
- Comparación determinística individual y planificación acotada; no solver global de asignación laboral ni integración automática de tarifas/rutas de transporte.
- Catálogos acotados y datos DEMO identificados; no equivalencia completa ESCO ni estadísticas nacionales.
- A04, CV/carta adaptados, práctica de entrevista, agenda empresarial bilateral y tendencias aplazados.
- Almacenamiento privado local del servidor, incluidos certificados. Supabase Storage y persistencia multiinstancia no se declaran implementados.

## Pendientes que siguen abiertos

1. Evidencia de al menos tres agentes colaborando en un mismo caso, con artefactos/versiones y herramientas observadas.
2. Al menos 15 evals con métricas y resultados publicados. El CSV mantiene 20 casos diseñados sin resultados: no se aprobaron durante esta conciliación. Se pueden combinar reglas, permisos, guardrails y calidad del modelo; no se exigen 15 llamadas LLM.
3. Aceptación/ensayo con cuentas reales Supabase, membresías y roles habilitados; atención a latencia y al timeout histórico de A02 banco.
4. Instalación desde clon limpio y acceso de demo para evaluación.
5. Archivo PPT real, ensayo, registro/ventana oficial y congelamiento final-24h cuando corresponda.

El equipo descartó video y eligió demo/PPT; no se afirma dispensa organizadora. Netlify no es requisito identificado y no se declara desplegado. [Plan de cierre y detalles](PENDIENTES_ENTREGA_FINAL.md).

## Documentación conciliada

Se actualizaron estados operativos de CU12/CU14, requisitos O01–O08, metodología, stack, guion y colaboración. Los planes y verificaciones anteriores se identifican como históricos o de diseño. Los enlaces a documentos internos excluidos y referencias históricas ausentes se presentan como tales, sin fingir que forman parte del repositorio público.

La autoría humana y los aportes de Codex, Antigravity/Gemini y MAGI se mantienen en [colaboración humana e IA](COLABORACION_HUMANO_IA.md) y [bitácora](BITACORA_IA.csv). Esta conciliación no modifica código, esquema, datos ni resultados de pruebas.
