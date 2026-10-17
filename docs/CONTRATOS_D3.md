# Contratos D3 — Explorar Oportunidades y Entender Brechas

Fecha: 2026-10-17.
Estado: CONTRATOS FIJADOS PARA IMPLEMENTACIÓN D3.
Alcance: Endpoints REST para exploración y comparación determinística (C01), y herramientas del agente A03 (Vertex AI Gemini 3.8 Flash).

---

## 1. Endpoints HTTP API (apps/api)

Todos los endpoints devuelven el sobre de respuesta estándar:
```json
{
  "data": { ... },
  "request_id": "uuid"
}
```
En caso de error:
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Descripción en español",
    "field_errors": [],
    "retryable": false
  },
  "request_id": "uuid"
}
```

### 1.1 `GET /api/v1/opportunities`
Consulta catálogo de vacantes activas (demo).

- **Headers**:
  - `Authorization: Bearer <token>` (opcional si es exploración pública, o requerido por sesión activa).
- **Query Parameters**:
  - `q` (string, max 100, opcional): Búsqueda por texto en título o descripción.
  - `occupation_id` (uuid, opcional): Filtro por ocupación canónica.
  - `workplace_type` (`REMOTE` | `ON_SITE` | `HYBRID`, opcional).
  - `limit` (integer, min 1, max 50, default 20).
  - `offset` (integer, min 0, default 0).
- **Respuesta 200**:
  ```json
  {
    "data": {
      "items": [
        {
          "id": "uuid",
          "organization": {
            "id": "uuid",
            "name": "Supermercados El Ahorro S.A."
          },
          "title": "Auxiliar de Bodega e Inventario",
          "occupation": {
            "id": "uuid",
            "code": "9333",
            "name": "Auxiliar de bodega"
          },
          "workplace_type": "ON_SITE",
          "location": "Ciudad de Panamá, Betania",
          "salary_amount": "650.00",
          "salary_currency": "USD",
          "salary_period": "MONTH",
          "schedule_summary": "Lunes a Viernes 08:00 - 17:00",
          "available_slots": 2,
          "is_demo": true,
          "version": 1,
          "published_at": "2026-10-17T00:00:00.000Z"
        }
      ],
      "pagination": {
        "total": 1,
        "limit": 20,
        "offset": 0
      }
    },
    "request_id": "uuid"
  }
  ```

---

### 1.2 `GET /api/v1/opportunities/:id`
Consulta detalle completo de una oportunidad y sus requisitos.

- **Headers**:
  - `Authorization: Bearer <token>`
- **Respuesta 200**:
  ```json
  {
    "data": {
      "id": "uuid",
      "organization": {
        "id": "uuid",
        "name": "Supermercados El Ahorro S.A."
      },
      "title": "Auxiliar de Bodega e Inventario",
      "description": "Responsable de recepción de mercancía y conteo físico.",
      "occupation": {
        "id": "uuid",
        "code": "9333",
        "name": "Auxiliar de bodega",
        "description": "Labores de almacenamiento y control de inventario."
      },
      "workplace_type": "ON_SITE",
      "location": "Ciudad de Panamá, Betania",
      "salary_amount": "650.00",
      "salary_currency": "USD",
      "salary_period": "MONTH",
      "schedule_summary": "Lunes a Viernes 08:00 - 17:00",
      "available_slots": 2,
      "is_demo": true,
      "version": 1,
      "published_at": "2026-10-17T00:00:00.000Z",
      "requirements": [
        {
          "id": "uuid",
          "competency_id": "uuid",
          "competency_name": "Registro de entradas y salidas de almacén",
          "competency_kind": "SKILL",
          "requirement_type": "ESSENTIAL",
          "stage": "ENTRY",
          "description": "Manejo de hojas de inventario físico o digital"
        },
        {
          "id": "uuid",
          "competency_id": "uuid",
          "competency_name": "Operación de transpaleta manual",
          "competency_kind": "SKILL",
          "requirement_type": "DESIRABLE",
          "stage": "TRAINABLE",
          "description": "Deseable pero se capacita en la primera semana"
        }
      ]
    },
    "request_id": "uuid"
  }
  ```
- **Errores**:
  - `404 OPPORTUNITY_NOT_FOUND`: Oportunidad inexistente o inactiva.

---

### 1.3 `POST /api/v1/me/opportunity-comparisons`
Ejecuta y persiste la comparación determinística C01 entre el perfil confirmado vigente del candidato y la oportunidad.

- **Headers**:
  - `Authorization: Bearer <token>`
  - `Idempotency-Key: <cadena de 16 a 128 caracteres>` (requerido)
- **Body**:
  ```json
  {
    "opportunity_id": "uuid",
    "assumptions": {
      "commute_minutes": 35,
      "transport_mode": "BUS"
    }
  }
  ```
  *Nota*: `assumptions` son supuestos específicos para esta consulta y nunca modifican el perfil guardado.
- **Respuesta 201 (Creado) / 200 (Replay Idempotente)**:
  ```json
  {
    "data": {
      "id": "uuid",
      "profile_id": "uuid",
      "revision_id": "uuid",
      "opportunity_id": "uuid",
      "opportunity_version": 1,
      "status": "VIABLE",
      "coverage_numerator": 1,
      "coverage_denominator": 2,
      "coverage_percent": 50.0,
      "assumptions": {
        "commute_minutes": 35,
        "transport_mode": "BUS"
      },
      "breakdown": {
        "logistics": {
          "salary": {
            "status": "CUMPLE",
            "candidate_minimum": "600.00",
            "opportunity_offered": "650.00",
            "currency": "USD",
            "period": "MONTH",
            "reason": "El salario ofrecido (650.00 USD/MONTH) cubre o supera la expectativa mínima del candidato (600.00 USD/MONTH)."
          },
          "commute": {
            "status": "CUMPLE",
            "candidate_max_minutes": 60,
            "assumed_minutes": 35,
            "reason": "El trayecto estimado (35 min) no excede el límite de traslado del candidato (60 min)."
          },
          "schedule": {
            "status": "CUMPLE",
            "reason": "La jornada laboral coincide con las ventanas de disponibilidad confirmadas del candidato."
          }
        },
        "requirements": [
          {
            "requirement_id": "uuid",
            "competency_id": "uuid",
            "competency_name": "Registro de entradas y salidas de almacén",
            "requirement_type": "ESSENTIAL",
            "stage": "ENTRY",
            "status": "CUMPLE",
            "evidence_reason": "Acreditado en perfil mediante experiencia de inventario familiar con evidencia revisada."
          },
          {
            "requirement_id": "uuid",
            "competency_id": "uuid",
            "competency_name": "Operación de transpaleta manual",
            "requirement_type": "DESIRABLE",
            "stage": "TRAINABLE",
            "status": "NO_CUMPLE",
            "evidence_reason": "No se registra evidencia previa en el perfil confirmado. Es un requisito deseable y entrenable en el puesto."
          }
        ]
      },
      "reasons": [
        "Cumple los requisitos esenciales de entrada.",
        "Logística de salario y traslado compatible con el perfil."
      ],
      "outdated": false,
      "created_at": "2026-10-17T05:00:00.000Z"
    },
    "request_id": "uuid"
  }
  ```
- **Errores**:
  - `400 CONFIRMED_PROFILE_REQUIRED`: El candidato no tiene un perfil confirmado (solo tiene borrador o ninguno).
  - `400 OPPORTUNITY_INACTIVE`: La oportunidad no está activa.
  - `404 OPPORTUNITY_NOT_FOUND`: Oportunidad inexistente.
  - `409 IDEMPOTENCY_CONFLICT`: Misma Idempotency-Key pero con cuerpo diferente.

---

### 1.4 `GET /api/v1/me/opportunity-comparisons/:id`
Consulta una comparación realizada por el candidato autenticado.

- **Headers**:
  - `Authorization: Bearer <token>`
- **Respuesta 200**:
  Misma estructura que `POST /api/v1/me/opportunity-comparisons`, con el campo dinámico `outdated: true` si la versión del perfil o de la oportunidad ha cambiado desde que se calculó.
- **Errores**:
  - `404 COMPARISON_NOT_FOUND`: No existe o pertenece a otro usuario.

---

### 1.5 `POST /api/v1/me/opportunity-comparisons/:id/explanations`
Invoca al agente autónomo A03 (Vertex AI) para interpretar la brecha, resolver dudas y generar un resumen explicativo comprensible bajo el contrato `agent-result/1`.

- **Headers**:
  - `Authorization: Bearer <token>`
  - `Idempotency-Key: <cadena de 16 a 128 caracteres>` (requerido)
- **Body**:
  ```json
  {
    "consent": true,
    "answers": [
      {
        "field": "commute.mode",
        "text": "Uso transporte público (Metro y Metrobús)"
      }
    ]
  }
  ```
- **Respuesta 201 / 200**:
  ```json
  {
    "data": {
      "id": "uuid",
      "comparison_id": "uuid",
      "agent_id": "A03",
      "contract_version": "agent-result/1",
      "status": "completed",
      "summary": "Eres un candidato altamente compatible para este puesto de Auxiliar de Bodega. Cumples con el requisito esencial de inventario y la ubicación está dentro de tu rango de traslado. Como aspecto entrenable, aprenderás el manejo de transpaleta directamente en el trabajo.",
      "decision": {
        "code": "COMPATIBLE_WITH_TRAINABLE_GAP",
        "feasibility": "VIABLE",
        "reasons": [
          "Cumple requisito esencial de entrada (Inventario)",
          "Logística viable (salario y tiempo de viaje)",
          "Requisito faltante es deseable y entrenable"
        ]
      },
      "missing_fields": [],
      "questions": [],
      "created_at": "2026-10-17T05:01:00.000Z"
    },
    "request_id": "uuid"
  }
  ```
- **Errores**:
  - `400 CONSENT_REQUIRED`: Si `consent` es `false` o no se proporcionó.
  - `404 COMPARISON_NOT_FOUND`: Comparación inexistente o de otro usuario.
  - `502 AGENT_INVOCATION_FAILED`: Fallo irrecuperable en Vertex AI (el cliente conserva el cálculo C01 y puede reintentar).

---

## 2. Herramientas del Agente A03 (Function Calling)

A03 se comunica con el runtime a través de herramientas estrictas. El runtime valida identidad, pertenencia y RLS antes de ejecutar cualquier herramienta. El LLM **nunca** calcula cifras ni porcentajes; solo las consulta.

### Herramienta 1: `read_confirmed_profile`
- **Descripción**: Obtiene los datos del perfil confirmado del candidato (experiencia, formación, competencias demostradas y restricciones logísticas).
- **Parámetros**:
  - `profile_id` (string, uuid)
  - `revision_id` (string, uuid)
- **Salida**: Objeto con `displayName`, `headline`, `experiences`, `trainings`, `claims`, `constraints`, `availabilityWindows`.

### Herramienta 2: `read_vacancy`
- **Descripción**: Obtiene los datos de la oportunidad (título, ocupación, organización, modalidad, salario, horarios, requisitos).
- **Parámetros**:
  - `opportunity_id` (string, uuid)
- **Salida**: Objeto con `title`, `description`, `organizationName`, `workplaceType`, `location`, `salary`, `schedule`, `requirements`.

### Herramienta 3: `evaluate_compatibility`
- **Descripción**: Ejecuta el motor determinístico C01 para calcular la factibilidad (`VIABLE`, `INVIABLE`, `PENDIENTE`), cobertura porcentual y desglose de requisitos.
- **Parámetros**:
  - `opportunity_id` (string, uuid)
  - `assumptions` (object, opcional)
- **Salida**: Objeto de resultado C01 con `status`, `coverageNumerator`, `coverageDenominator`, `coveragePercent`, `breakdown`.

### Herramienta 4: `read_comparison_trace`
- **Descripción**: Lee la traza de auditoría y reglas aplicadas en la comparación existente.
- **Parámetros**:
  - `comparison_id` (string, uuid)
- **Salida**: Objeto con `rulesApplied`, `logisticsEvaluation`, `reasons`.

### Herramienta 5: `submit_explanation`
- **Descripción**: Envía la explicación estructurada final conforme a `agent-result/1`.
- **Parámetros**:
  - `status` ("completed" | "needs_input" | "blocked")
  - `summary` (string, max 1000)
  - `decision_code` (string)
  - `reasons` (array de strings)
  - `missing_fields` (array de strings)
  - `questions` (array de hasta 3 objetos `{ field: string, text: string }`)

---

## 3. Reglas Determinísticas de Negocio C01

1. **Ejes de Requisitos**:
   - Eje 1 (Importancia): `ESSENTIAL` vs `DESIRABLE`.
   - Eje 2 (Momento de Adquisición): `ENTRY` vs `TRAINABLE`.
2. **Evaluación de Requisito**:
   - `CUMPLE`: El candidato tiene un claim en su perfil confirmado correspondiente al `competencyId` de la vacante, con estado `ACCEPTED` y con evidencia asociada o confirmada.
   - `NO_CUMPLE`: Se cuenta con información suficiente para determinar que no lo tiene, o es un requisito de entrada que no posee.
   - `DESCONOCIDO`: Falta información o el candidato no ha declarado ni demostrado dicha competencia.
3. **Fórmula de Cobertura**:
   - `coverage_numerator`: Cantidad de requisitos con estado `CUMPLE`.
   - `coverage_denominator`: Cantidad de requisitos evaluables (con estado `CUMPLE` o `NO_CUMPLE`).
   - `coverage_percent`: `(numerator / denominator) * 100` redondeado a 1 decimal.
   - **Regla crítica**: Si `denominator === 0`, `coverage_percent` es estrictamente `null` (nunca se inventa 0% ni 100%).
4. **Determinación de Factibilidad (`status`)**:
   - `INVIABLE`:
     - Violación logística dura comprobada:
       - Salario de la vacante inferior al mínimo exigido por el candidato (con misma moneda y periodo).
       - Tiempo de traslado estimado superior al `maxOneWayMinutes` confirmado.
       - Conflicto directo de horario laboral con indisponibilidad del candidato.
     - O cualquier requisito `ESSENTIAL` con stage `ENTRY` evaluado como `NO_CUMPLE`.
   - `PENDIENTE`:
     - No hay violaciones duras comprobadas, PERO existen requisitos `ESSENTIAL` con estado `DESCONOCIDO`, o la logística esencial (salario/traslado/horario) tiene estado `UNKNOWN` y no se han aportado supuestos.
   - `VIABLE`:
     - Todas las restricciones logísticas esenciales se cumplen o son compatibles.
     - Todos los requisitos `ESSENTIAL` con stage `ENTRY` tienen estado `CUMPLE`.
     - *Nota*: Un requisito `ESSENTIAL` pero `TRAINABLE` que esté `NO_CUMPLE` **no** vuelve inviable la vacante; se marca como brecha entrenable en el puesto.
