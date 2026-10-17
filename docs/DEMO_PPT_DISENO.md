# Guion de demo y PPT de AImpulsa
Actualizado: 2026-10-17. Decisión humana: demo en vivo alternando perfiles y PPT de módulos; video fuera del plan. No se afirma dispensa organizadora del video ni una duración obligatoria de la demo derivada de aquel límite.

El diseño Figma v2 y la aplicación existen. La presentación PPT y el ensayo final no se consideran creados por este guion. Nombre: **AImpulsa**, con AI destacado y cohete; temas claro/oscuro terracota, marfil, carbón y oliva. [Entrega visual](ENTREGA_REDISENO_FIGMA_V2.md).

## Recorrido recomendado
| Escena | Actor | Mostrar | Condición/evidencia |
|---|---|---|---|
| Preparación | Equipo | Caso sintético coherente, cuentas separadas y permisos | Identificar datos preparados; no simular una sesión real cambiando un selector |
| Perfil | Joven | Texto/PDF → propuesta A02 → revisar/confirmar → volver a consultar | Fuente y dato confirmado; sin audio/foto/OCR propio |
| Oportunidad | Empresa y joven | Empresa normaliza/publica con A01; joven explora y compara | Revisar alertas; C01 determina viabilidad; A03 explica |
| Postulación | Joven y empresa | Consentir versión concreta → empresa consulta habilidades → retirar | DTO minimizado y pérdida de acceso; no mostrar CV/carta A04 como implementados |
| Formación | Centro y joven | Mapa A01 confirmado → banco A02 revisado → intento privado → C01 → asociación voluntaria | Una pregunta no acredita todo un curso; mostrar estado real del proveedor |
| Ruta y acción | Joven | Plan calculado/explicado por A05 → confirmación → reserva y agenda | Confirmar plan no reserva; recibo y cupo corresponden al efecto real |
| Acompañamiento | Orientador y joven | Autorización → aclaración/revisión → respuesta juvenil → revocación | Usar únicamente caso D8 válido; pendiente el caso de reserva independiente de la misma edición |
| Finalización | Centro y joven | Resultado de participación y descarga de PDF existente privado | Si la reserva fue preparada como fixture, declararlo; no afirmar E2E íntegro sin ejecutarlo |

No es necesario mostrar todas las escenas si no caben; acordar duración y priorizar una historia completa y verificable. Evitar escenas de funciones aplazadas: A04, práctica, entrevistas bilaterales, tendencias, audio e imágenes.

La colaboración debe mostrarse con artefactos/versiones y decisiones humanas entre agentes. Las pruebas reales separadas no se convierten en una traza de tres agentes de un mismo caso al presentarlas juntas. [Explicación y prompts](COLABORACION_AGENTES.md).

## Preparación de cuentas y datos
Usar sesiones de navegador aisladas para joven, empresa, centro y orientador. Verificar identidad/organización activa; limpiar el contexto al cambiar sesión. Una membresía de empresa/centro no concede habilitación global de orientador.

Preparar catálogo, vacante, curso y restricciones sintéticos identificados como DEMO. Las credenciales reales se provisionan por el canal del equipo; no publicar claves/ADC ni mostrar expedientes personales. Un PDF técnico no se presenta como certificado real de una institución.

Ensayar recarga, reintento, revocación y al menos una denegación entre ámbitos. Registrar qué se ejecutó en vivo y qué estaba preparado. Revisar latencia A02-banco antes de comprometer ese paso: la última verificación integral registró timeout.

## Estructura del PPT
1. Problema y usuarios.
2. Actores y recorrido: enlaces a CU y especificaciones.
3. Arquitectura de tres capas y módulos frontend/API/datos.
4. Agentes, herramientas y datos que comparten; un ejemplo de colaboración.
5. Demo o capturas de la historia.
6. Permisos, confirmaciones, cálculo determinístico y acción real.
7. Resultados de pruebas, evals y límites.
8. Autoría/bitácora, fuentes y próximos pasos.

Incluir como respaldo una ficha por módulo/agente y referencias al código. [Guía de presentación y selección de capturas](GUIA_PRESENTACION_Y_EVIDENCIAS.md). No convertir el PPT en una lista de tecnologías ni llenar el README con capturas de código.

## Referencias de cierre
[Casos de uso](CASOS_DE_USO.md), [especificaciones](ESPECIFICACION_CASOS_USO.md), [metodología](METODOLOGIA.md), [bitácora](BITACORA_IA.csv), [entregables](ENTREGABLES.md), [verificación integral](VERIFICACION_INTEGRAL_D1_D8.md) y [observación focal D8](REVISION_D8_CIERRE_FOCAL.md). El resultado E2E posterior se incorpora solo cuando termine y se contraste su evidencia.
