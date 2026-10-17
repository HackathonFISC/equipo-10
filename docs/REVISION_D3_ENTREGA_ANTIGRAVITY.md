# Revisión de entrega D3 — 2026-10-17

> **Lectura histórica — conciliación 2026-10-17:** se conservan el alcance, resultados y autoría de la ejecución original. Los pendientes de aquel momento no describen automáticamente la entrega actual. Consultar [estado vigente](ESTADO_ACTUAL.md), [D8 corregido](D8_ENTREGA.md) y [despliegue aplicado/verificado](CIERRE_MIGRACIONES_REPOSITORIO.md). Esta nota no repite pruebas ni cambia resultados anteriores.

Resultado: NO APROBAR CIERRE D3 todavía. Inspección y reproducción por Codex; sin modificar código de producto. El informe de Antigravity es evidencia declarada, no ejecución independiente de todas sus pruebas.

Verificado ahora: `bun test tests/api/c01-matcher.test.ts` 14 PASS; `bun run typecheck` exit0. No se ejecutaron suites BD/E2E ni Vertex en esta revisión. Los tests verdes actuales no detectan los siguientes fallos.

## Hallazgos prioritarios

1. **P1 — Horario no llega al cálculo desde la API.** `opportunities.service.ts` construye vacancyInput con scheduleSummary pero sin scheduleWindows. C01 solo evalúa horario si recibe scheduleWindows, e inicia la condición como CUMPLE. Los tests puros con ventanas no prueban la conexión API. Guardar y transportar horario estructurado con vigencia/timezone, o devolver desconocido; probar por endpoint una incompatibilidad real.

2. **P1 — Ausencia de habilidad se convierte en incumplimiento por existir otra habilidad.** `c01-matcher.ts` usa candidateHasAnyClaims: sin claims da desconocido; con uno ajeno da NO_CUMPLE/INVIABLE. Reproducción ejecutada: mismo requisito ausente, perfil vacío→PENDIENTE; agregar claim no relacionado→INVIABLE. La ausencia de evidencia debe seguir desconocida sin evaluación negativa expresa.

3. **P1 — Claims se acreditan sin comprobar decisión/evidencia.** C01 encuentra por ID o código y marca CUMPLE ignorando decision y hasEvidence. Reproducción ejecutada con decision=REJECTED y hasEvidence=false devuelve CUMPLE y «Competencia acreditada». El camino API filtra algunos claims, pero eso no demuestra acreditación; separar declaración, evidencia y demostración, y catálogo/versiones. Pruebas negativas explícitas en motor y adaptador.

4. **P1 — Logística sin datos puede resultar viable.** Salario/traslado empiezan como CUMPLE si el estado del perfil no es KNOWN y no se comprueba horario ausente. Reproducción ejecutada: candidato sin constraints, ventanas ni claims y vacante sin requisitos devuelve VIABLE. Exigir desconocidos esenciales; no convertir falta de restricciones conocidas en compatibilidad verificada.

5. **P1 — A03 real no demuestra autonomía exigida.** Existe toolEvaluateCompatibility, pero executeVertexLoop declara/atiende solo read_comparison_trace, read_vacancy, read_confirmed_profile y submit_explanation. El modelo no puede invocar evaluate_compatibility. Además input.answers se recibe pero no se incorpora al bucle. Registrar y despachar herramienta C01 real, usar aclaraciones validadas y probar I03 con herramientas observadas.

6. **P1 — Sustitución silenciosa del proveedor.** Cualquier fallo Vertex termina en buildDeterministicExplanation; opportunities.service descarta provider y la UI presenta orientación A03. Los tests A03 fuerzan VERTEX_DISABLED y verifican fallback, no bucle real. Ante caída mostrar error recuperable y conservar C01; un resumen por reglas debe identificarse explícitamente y no contar como ejecución A03. No cambiar silenciosamente lo pactado.

7. **P1 — Bucle Vertex repite límites ya corregidos en A02.** fetch no tiene AbortSignal/plazo total; usa salida2048, no comprueba MAX_TOKENS y no controla pensamiento LOW. Copiar patrones comprobados sin duplicar el módulo completo. El informe afirma SDK oficial, pero la implementación inspeccionada usa fetch; corregir documentación sin cambiar dependencia por estética.

8. **P2 — Persistencia de explicación y recibo separadas.** Agente guarda explicación/auditoría y servicio escribe recibo después en otra transacción. Fallo intermedio deja efecto sin recibo; concurrencia puede duplicar llamadas/efectos. Separar generación LLM de guardado; persistir explicación, auditoría y recibo en transacción corta con unicidad y relectura de resultado. No mantener transacción durante Vertex.

La asignación forzada de decision.feasibility a C01 no comprueba que summary/reasons no contradigan los datos. Añadir salida contradictoria y refs ajenas a las pruebas del adaptador; no afirmar guardrail completo por corregir un campo.

## Orden de corrección eficiente

1. Motor y adaptadores: desconocidos, evidencias, versiones de catálogo y horario. Casos de regresión que fallen antes de corregir; probar el camino API, no solo funciones puras.
2. A03: herramientas accesibles, respuestas incorporadas, plazo/salida, sin sustitución silenciosa, integridad de explicación/recibo.
3. Pruebas dirigidas offline y typecheck. Después una ejecución real sintética A03 con traza de herramientas. No ejecutar A02 live para acreditar A03 ni volver a todas las suites tras cada cambio.
4. Regresión final D2/D3 una vez, actualizando informe y bitácora con ejecuciones observadas y limitaciones. Sin despliegue remoto, commit ni push.

No atribuir la duración de Antigravity a una causa medida: no se dispone de cronología de herramientas/latencias de su ejecución.
