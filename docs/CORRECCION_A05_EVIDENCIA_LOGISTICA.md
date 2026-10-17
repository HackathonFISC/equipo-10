# Corrección acotada A05 y C01

Fecha: 2026-10-17. Implementación y pruebas: Codex, autorizado por el usuario mientras otro trabajo completa D8. Se aplicaron las skills de desarrollo equipo-10 y Ponytail. Sin cambio de modelo, proveedor, dependencia, UI, contratos, migraciones ni archivos de D8.

## Cambios

- `agent-a05.service.ts`: calcular_rutas consulta los vínculos de evidencia y deja de marcar todas las declaraciones como demostradas. Aplica el mismo criterio que la vista previa de planificación: decisión aceptada y evidencia vinculada.
- `c01-planner.ts`: una propuesta que necesita cursos queda PENDING si falta disponibilidad, supuesto de traslado o sesiones estructuradas del curso. Cero minutos sigue siendo un valor explícito válido; no se supone al faltar el dato. Los incumplimientos conocidos de presupuesto, horario o prerrequisitos siguen descartando combinaciones. Un plan sin cursos por requisitos ya demostrados no exige logística ficticia.
- `agent-a05.service.ts`: si el modelo no entrega entregar_explicacion, falla con 502/AGENT_INCOMPLETE recuperable y no persiste una explicación completed fabricada en código. El plan C01 queda intacto y la interfaz existente puede mostrar el mensaje y permitir reintentar.
- Pruebas unitarias anteriores de planner ahora indican traslado cero explícito en sus entradas, en lugar de depender de una suposición oculta. Se mantienen sus expectativas de restricciones y precedencias.

## Verificación ejecutada

Primero se añadieron nueve regresiones: cinco fallaban antes de corregir y cuatro controles pasaban. Después pasan las nueve. Cubren declaración sin evidencia, evidencia existente, traslado desconocido, disponibilidad ausente, curso sin sesiones, logística conocida, presupuesto incumplido, entrega incompleta sin escritura y entrega estructurada con factibilidad C01 protegida.

`bun test tests/api/a05-regression.test.ts tests/api/c01-planner.test.ts tests/api/c01-matcher.test.ts`: **36 PASS, 0 FAIL, 189 aserciones**. Tras ajustar las anotaciones de tipos de los mocks se repitieron las nueve regresiones: PASS.

`bun run build`: exit 0, aviso de bundle de aproximadamente 823 kB.

`bun run typecheck`: exit 1 por siete diagnósticos de `modules/orientation/orientation.service.ts` del D8 en desarrollo: specialty frente a specialties, campos de plan outdated/version/created_at ausentes y acceso a reasons que no existe en LearningPlanExplanation. No quedan diagnósticos en los archivos de esta corrección en la segunda ejecución. No se repararon ni sobrescribieron archivos del otro trabajo.

Datos y transporte Vertex simulados en memoria; no es una prueba real de calidad Gemini ni validación de credenciales. Sin fixtures que reinicien BD, SQL remoto, llamadas pagadas, commit o push.

## Límites e integración

Esta corrección resuelve H01, H03 y la falsa certeza logística de H02 de REVISION_ENTREGA_D1_D7.md. **No incorpora cálculo de tarifas ni presupuesto real de transporte**: esa parte del hallazgo H02 y la conciliación de documentación siguen pendientes. No convierte todo A05 ni D4 en entrega validada.

Los planes ya persistidos no se modificaron ni recalcularon automáticamente. Recalcular las rutas anteriores para obtener el nuevo diagnóstico y renovar cualquier revisión dependiente de su versión conforme a D8. No usar estos cambios como evidencia de aceptación de D8: el otro trabajo debe cerrar su comprobación de tipos y su regresión de integración.
