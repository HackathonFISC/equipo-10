# D5/D6 reducido — decisión humana 2026-10-17

Estado posterior: implementado, corregido e integrado con el núcleo D7; pruebas y migraciones verificadas. Consultar [INTEGRACION_D5_D7.md](INTEGRACION_D5_D7.md). El alcance excluido sigue aplazado.

Objetivo: terminar el recorrido empresa–joven y continuar después con D7 (centros de formación), evitando ampliar este bloque. Esta decisión reemplaza el alcance completo de D5/D6 para la entrega inmediata, sin declarar satisfechos los requisitos aplazados.

## Incluido

1. Reclutador de empresa autorizada describe una vacante en texto.
2. A01 por Vertex interpreta tareas y propone puesto y habilidades del catálogo versionado existente. Pregunta por datos faltantes y alias ambiguos. No inventa equivalencias ni crea etiquetas globales automáticamente.
3. Reclutador revisa/corrige puesto, habilidades, requisitos esenciales/deseables y de entrada/entrenables, salario y horario; confirma y publica una versión. Alertas discriminatorias bloquean publicación hasta corrección y nueva comprobación; no basta un checkbox de aprobación.
4. Joven consulta esa vacante y autoriza expresamente compartir una versión concreta de su perfil con esa empresa para ella. Se registra candidatura consentida, consultable y retirable; no basta estar registrado para aparecer ante empresas.
5. Empresa ve solo candidaturas consentidas de sus vacantes. Revisión inicial por identificador de candidato, habilidades, evidencias pertinentes y brechas; sin sexo/género, foto, nombre ni datos personales innecesarios. No enviar estos atributos a A01/C01 para selección.
6. Distinguir habilidad declarada/documentada/demostrada; ausencia de evidencia sigue desconocida. Reutilizar comparación C01 de D3 sin recalcular mediante LLM ni tratar porcentajes como probabilidad de contratación.

## Fuera de esta entrega

CV adaptado/generado por A04, práctica de entrevistas, agenda bilateral de entrevistas, contratación, selección global avanzada, importación adicional de documentos y filtros sofisticados. No contar A04 como implementado por este bloque.

## Condiciones mínimas para pasar a D7

- Vacante publicada visible al joven y recuperable tras recarga.
- A01 real decide aclaraciones y usa herramientas de catálogo; fallo Vertex conserva borrador y permite corrección manual, sin sustitución silenciosa ni falso éxito.
- Candidatura con consentimiento/versiones y recibo; reintento no duplica ni consume plazas laborales.
- Empresa ajena y empresa sin consentimiento no acceden al perfil; retirada corta acceso futuro. Aplicar minimización también en DTO/API, no solo ocultar campos visualmente.
- Verificar mapeo de membresía empresarial real; un selector de perfil demo no concede permisos.
- Pruebas dirigidas y un E2E empresa publica → joven autoriza → empresa consulta habilidades → joven retira → acceso bloqueado.
- D2/D3/D4 conservados, bitácora actualizada y activación de migración diferenciada de pruebas locales. No declarar etapa completa por pantallas o tablas sin probar el recorrido.

Siguiente bloque: D7, gestión del centro con cursos, mapas de habilidades, ediciones y participantes reutilizando D4. No desarrollar D7 dentro de esta entrega ni esperar funciones aplazadas de D5/D6 para comenzar después.
