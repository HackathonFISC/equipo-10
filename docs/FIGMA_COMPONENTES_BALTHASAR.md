# Especificación de Biblioteca Mínima Figma — Handoff UI

> **Diseño/plan de su etapa — conciliación 2026-10-17:** los pasos futuros y alternativas siguientes conservan su contexto original; no son una lista de todo lo que falta hoy. Implementación y pendientes vigentes en [ESTADO_ACTUAL.md](ESTADO_ACTUAL.md) y [cobertura CU](CASOS_DE_USO.md#cobertura-actual-por-caso). Los casos diseñados no se presentan como ejecutados.

Estado actual (2026-10-16): diseño v1 construido en Figma con la cuenta Mainor. Ver entrega, enlaces de nodos y validación (`ENTREGA_FIGMA_V1.md`, referencia histórica no incluida). Las limitaciones de acceso descritas abajo son antecedentes, superadas mediante el servidor remoto oficial. Aplicación y pruebas funcionales todavía pendientes.

Fecha: 2026-10-16  
Estado: Paquete de diseño contractual para handoff. Endpoint MCP local opera en modo solo lectura; no dar por creados frames ni variables en archivo remoto.

---

## 1. Fundamentos y Modos Semánticos

- **Geometría y Espaciado:** Radios rectangulares de 6–8px en botones, tarjetas y campos. Espaciados: 4, 8, 16, 24, 32px. Tipografía: Source Sans 3 (cuerpo 16px, metadatos 14px).
- **Modos Semánticos (Light / Dark):** Propuestos para implementar mediante variables de Figma sin duplicar componentes ni vistas.
  - *Fondo:* Claro `#F6F3EB` | Oscuro `#20231E`
  - *Superficie:* Claro `#FFFDF8` | Oscuro `#292D26`
  - *Texto principal:* Claro `#252A25` | Oscuro `#F3F1E9`
  - *Texto secundario:* Claro `#61665D` | Oscuro `#BFC4B5`
  - *Acento terracota (Acción):* Claro `#B45E3D` (texto `#FFFFFF`) | Oscuro `#DF9876` (texto `#2D2017`)
  - *Acento oliva (Positivo):* Claro `#E9EDDF` (texto `#485632`) | Oscuro `#35412A` (texto `#C4D1A7`)

---

## 2. Inventario propuesto de componentes para 17 CU y 4 perfiles

| Componente | Propiedades / Variantes Necesarias | CU Cubiertos | Reglas de Privacidad y Confirmación Humana |
|---|---|---|---|
| **Botón de Acción** | Variante (`Terracotta`, `Secondary`, `Danger`, `Ghost`) × Tamaño (`Md`, `Sm`) × Estado (`Default`, `Hover`, `Focus`, `Disabled`, `Loading`) | CU01–CU17 | Guardar un borrador privado no requiere un modal adicional. Publicar, compartir, reservar y cancelar deben explicar su efecto y requerir la confirmación correspondiente al CU; no toda escritura es irreversible. |
| **Navegación, Sesión y Membresía** | Perfil activo, organización, invitación y permiso denegado | CU08 y navegación transversal | El cambio visual de perfil no concede permisos; cuentas y membresías verificadas al implementar. |
| **Lista, Tabla y Diálogo** | Vacío, carga, error, datos; confirmación según efecto | CU01–CU17 según vista | Mostrar únicamente objetos autorizados; paginar listas y explicar consecuencias de la acción. |
| **Control de Formulario** | Tipo (`Text`, `Textarea`, `Select`, `Checkbox`) × Estado (`Default`, `Focus`, `Error`, `Disabled`) | CU01, CU02, CU05, CU07, CU08, CU11, CU15 | Validación local. No envía borradores ni inferencias de IA sin consentimiento del usuario. |
| **Ficha de Brecha y Requisito** | Nivel (`Cubierto`, `Brecha_Parcial`, `Desconocido`) × Evidencia (`Visible`, `Oculta`) | CU01, CU03, CU04, CU07, CU14 | «Desconocido» no equivale a incompetencia; no atribuye resultados futuros al perfil sin evidencia verificada. |
| **Ficha de Vacante y Oferta** | Modo (`Candidato_Vista`, `Reclutador_Edicion`) × Estado (`Borrador`, `Publicada`, `Cerrada`) | CU03, CU07, CU09, CU17 | Exploración privada del candidato no se revela a la empresa; reclutador solo accede a perfiles consentidos (CU09). |
| **Bloque Temario, Etiqueta y Banco** | Flujo (`Temario_Original`, `Etiqueta_Competencia`, `Pregunta_Banco`) × Rol (`Centro`, `Candidato`) | CU02, CU11 | Centro confirma temario y banco propio. Evidencia de ejercicio limitada al intento específico; candidato no expone historial global. |
| **Panel de Microevaluación (Curso)** | Estado (`Instruccion`, `En_Progreso`, `Revision_Objetiva`, `Resultado`) | CU02 | Separado de práctica. Consentimiento previo; evaluación objetiva determinística (C01); nunca genera certificación por IA. |
| **Panel de Práctica Privada (Entrevista)** | Estado (`Preparacion`, `Grabacion`, `Transcripcion`, `Guardada_Privada`) | CU06 | Práctica privada del candidato; transcripción y respuestas no se comparten con empresas ni orientadores por defecto. |
| **Módulo de Reserva Inmediata** | Estado (`Disponible`, `Confirmada`, `Cancelada`, `Sin_Cupo`) | CU12, CU15 | Reserva inmediata de cupo confirmada directamente por el joven (no solicitud en espera). Operación indivisible e idempotente. |
| **Módulo de Entrevista Laboral** | Modo (`Propuesta_Horario`, `Confirmada`, `Reagendada`) | CU10, CU15 | Doble confirmación obligatoria (candidato y empresa). Orientador no interviene ni gestiona entrevistas de empresa. |
| **Registro de Certificado Adjunto** | Estado (`Finalizado_Pendiente`, `Documento_Adjunto`, `Vinculado_Perfil`) | CU13 | Centro certifica manualmente finalización; adjunto documental humano, no generado por IA. Joven decide si lo vincula. |
| **Ficha de Ruta y Plan Formativo** | Ciclo (`Propuesta`, `Aceptada`, `En_Curso`, `Cerrada`); revisión del orientador y viabilidad en ejes separados, sujetos al contrato definitivo | CU04, CU14 | Orientador solo accede si existe autorización explícita de acompañamiento; puede consultar ofertas publicadas y el caso autorizado del joven, sin acceso general a procesos privados de la empresa. |
| **Visor de Trazas y Alertas C02** | Nivel (`Auditoria_OK`, `Advertencia`, `Bloqueo_Seguridad`) | CU16, CU17 | Explicaciones sanitizadas de agentes; datos agregados de tendencias (CU17) excluyen identidades y personas. |

---

## 3. Orden de Construcción de la Biblioteca

1. **Tokens y Primitivas:** Definir variables semánticas terracota/oliva/carbón/marfil, modos claro/oscuro, radios 6–8px y escalas de texto.
2. **Átomos y Controles Base:** Botones, inputs, selects, textareas, checkboxes y etiquetas de brecha/estado.
3. **Módulos de Dominio:** Fichas de vacante, desglose de requisitos, bloque temario→etiqueta→pregunta con revisión de centro.
4. **Módulos de Flujo Crítico:** Paneles desacoplados de microevaluación (CU02) y práctica privada (CU06); ficha de reserva inmediata (CU12) y agenda bilateral (CU10).
5. **Estructuras de Acompañamiento y Auditoría:** Ficha de ruta versionada (CU04/CU14), adjuntos de certificación (CU13) y trazas C02 (CU16/CU17).
6. **Vistas e Integración:** Composición en páginas `03 Candidato`, `04 Reclutador`, `05 Centro` y `06 Orientador`.

---

## 4. Cinco Estados Críticos por Perfil

1. **Candidato — Confirmación de Reserva Inmediata (CU12):** Selección de edición con cupo verificado; confirmación instantánea por el joven sin depender de aprobación posterior del centro.
2. **Candidato — Práctica Privada Aislada (CU06):** Grabación y transcripción con indicador visible de privacidad estricta; prohibición de compartir hacia reclutadores u orientadores sin acción expresa.
3. **Centro — Aprobación de Temario y Banco (CU11):** Transición explícita temario → etiqueta → pregunta; centro valida y firma banco propio antes de publicar microevaluaciones (CU02).
4. **Reclutador — Convocatoria y Doble Confirmación de Cita (CU10):** Coordinación de entrevista sobre versión inalterada; requiere aceptación simétrica de empresa y candidato.
5. **Orientador — Revisión Acompañada Sin Ámbito Empresarial (CU14):** Orientador revisa el caso y plan formativo dentro de la autorización del joven; puede consultar ofertas publicadas y datos expresamente compartidos. No gestiona procesos de la empresa ni accede a sus vacantes privadas por ese rol.
## Revisión e integración de Codex

BALTHASAR produjo el borrador mediante `google-vertex/gemini-3.8-flash`, con evidencia local de lecturas y escritura verificadas. Codex corrigió afirmaciones de implementación, permisos del orientador, persistencia privada, confirmaciones y separación de estados. El original se conserva fuera del repositorio de producto. Las variantes enumeran necesidades: no construir automáticamente el producto cartesiano de todas sus propiedades. No se han creado componentes ni variables en Figma. La privacidad no implica almacenamiento exclusivamente en el navegador.
