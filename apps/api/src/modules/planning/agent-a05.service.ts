import { randomUUID } from "node:crypto";
import {
  LearningPlanExplanationViewSchema,
  type LearningPlanExplanationView,
  type LearningPlanView,
  type PlanFeasibility,
} from "@equipo10/contracts";
import { AppError } from "../../errors";
import { VertexAuth, type VertexConfig } from "../profile/vertex-auth";
import type { Prisma } from "../../../../../generated/prisma/client.js";
import type { ActorTransactionOptions } from "../../infrastructure/database";
import {
  calculateLearningRouteC01,
  type CandidatePlannerProfile,
  type TargetRequirement,
  type PlannerCourseEdition,
  type C01PlanningResult,
} from "./c01-planner";

export interface PlanningDatabase {
  resolveAuthSubject(subject: string, bootstrap: boolean): Promise<string | null>;
  withActor<T>(id: string, fn: (tx: Prisma.TransactionClient) => Promise<T>, options?: ActorTransactionOptions): Promise<T>;
}

export interface AgentA05Input {
  planId: string;
  actorUserId: string;
  consent: boolean;
  answers?: { field: string; text: string }[];
}

export interface AgentA05Result {
  explanation: LearningPlanExplanationView;
  provider: string;
  toolsInvoked?: string[];
}

export type AgentA05Runner = (input: AgentA05Input) => Promise<LearningPlanExplanationView>;

export interface IAgentA05Service {
  explainPlan(input: AgentA05Input): Promise<AgentA05Result>;
}

export class AgentA05Service implements IAgentA05Service {
  constructor(
    private readonly db: PlanningDatabase,
    private readonly testRunner?: AgentA05Runner
  ) {}

  async explainPlan(input: AgentA05Input): Promise<AgentA05Result> {
    if (!input.consent) {
      throw new AppError(400, "CONSENT_REQUIRED", "El consentimiento explícito es obligatorio para la orientación formativa con IA");
    }

    // 1. Si hay test runner inyectado, ejecutarlo directamente (pruebas unitarias / simulación controlada)
    if (this.testRunner) {
      try {
        const explanation = await this.testRunner(input);
        return {
          explanation,
          provider: "test-mock-runner",
          toolsInvoked: ["leer_resultado", "leer_meta_perfil", "entregar_explicacion"],
        };
      } catch (err: any) {
        if (err instanceof AppError) throw err;
        throw new AppError(503, "VERTEX_UNAVAILABLE", `Error simulado de Vertex AI: ${err.message || String(err)}`);
      }
    }

    // 2. Verificar existencia del plan y permisos del actor
    const plan = await this.getPlanRecord(input.planId, input.actorUserId);
    if (!plan) {
      throw new AppError(404, "PLAN_NOT_FOUND", "Plan formativo no encontrado");
    }

    // 3. Ejecución obligatoria con Vertex AI (Gemini 3.8 Flash con ADC, ubicación global)
    if (process.env.VERTEX_DISABLED === "true") {
      throw new AppError(
        503,
        "VERTEX_UNAVAILABLE",
        "El servicio de orientación inteligente Vertex AI no está disponible (VERTEX_DISABLED). El plan C01 se conserva intacto; puedes reintentar."
      );
    }

    const vertexConfig = await VertexAuth.getVertexConfig();
    if (!vertexConfig) {
      throw new AppError(
        503,
        "VERTEX_UNAVAILABLE",
        "No se encontraron credenciales válidas de Vertex AI (ADC). Configure Google Cloud ADC o VERTEX_PROJECT_ID."
      );
    }

    try {
      const loopResult = await this.executeVertexLoop(input, plan, vertexConfig);
      return {
        explanation: loopResult.explanation,
        provider: `vertex-${vertexConfig.model}`,
        toolsInvoked: loopResult.toolsInvoked,
      };
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      console.error("[AgentA05] Error invocando Vertex AI:", err);
      throw new AppError(
        503,
        "VERTEX_UNAVAILABLE",
        `Fallo al comunicar con Vertex AI: ${err.message || String(err)}. El plan C01 se conserva intacto.`
      );
    }
  }

  // Tool 1: leer_meta_perfil
  async toolLeerMetaPerfil(profileId: string, actorUserId: string): Promise<any> {
    return this.db.withActor(actorUserId, async (tx) => {
      const profile = await tx.candidateProfile.findFirst({
        where: { id: profileId, ownerUserId: actorUserId },
        include: {
          currentVersion: {
            include: {
              claims: {
                where: { decision: "ACCEPTED" },
                include: { competency: true, evidenceLinks: true },
              },
              constraints: true,
              windows: true,
            },
          },
        },
      });

      if (!profile || !profile.currentVersion) {
        return { error: "Perfil confirmado no encontrado" };
      }

      const rev = profile.currentVersion;
      return {
        profile_id: profile.id,
        display_name: rev.displayName,
        demonstrated_competencies: rev.claims.map((c) => ({
          id: c.competencyId,
          code: c.competency.code,
          name: c.competency.name,
          has_evidence: c.evidenceLinks.length > 0,
        })),
        training_budget: rev.constraints?.trainingBudget ? Number(rev.constraints.trainingBudget) : null,
        transport_budget: rev.constraints?.transportBudget ? Number(rev.constraints.transportBudget) : null,
        availability_windows_count: rev.windows.length,
      };
    });
  }

  // Tool 2: buscar_ediciones
  async toolBuscarEdiciones(
    actorUserId: string,
    params: { competency_ids?: string[]; modality?: string; max_cost?: number }
  ): Promise<any> {
    return this.db.withActor(actorUserId, async (tx) => {
      const where: any = { active: true };
      if (params.modality) {
        where.modality = params.modality;
      }
      if (params.max_cost !== undefined) {
        where.costAmount = { lte: params.max_cost };
      }

      const editions = await tx.courseEdition.findMany({
        where,
        take: 12,
        include: {
          courseVersion: {
            include: {
              course: { select: { title: true, code: true } },
              learningOutcomes: { include: { competency: { select: { name: true, code: true } } } },
              prerequisites: { include: { competency: { select: { name: true, code: true } } } },
            },
          },
          sessions: true,
          reservations: { where: { status: "CONFIRMED" }, select: { id: true } },
        },
      });

      return editions.map((ed) => {
        const availableSlots = Math.max(0, ed.totalSlots - ed.reservations.length);
        return {
          id: ed.id,
          code: ed.courseVersion.course.code,
          course_title: ed.courseVersion.course.title,
          modality: ed.modality,
          available_slots: availableSlots,
          total_slots: ed.totalSlots,
          cost_amount: ed.costAmount ? Number(ed.costAmount) : 0,
          cost_currency: ed.costCurrency || "USD",
          schedule_summary: ed.scheduleSummary,
          start_date: ed.startDate.toISOString().split("T")[0],
          end_date: ed.endDate.toISOString().split("T")[0],
          learning_outcomes: ed.courseVersion.learningOutcomes.map((o) => ({
            id: o.competencyId,
            name: o.competency.name,
          })),
          prerequisites: ed.courseVersion.prerequisites.map((p) => ({
            id: p.competencyId,
            name: p.competency.name,
            essential: p.essential,
          })),
        };
      });
    });
  }

  // Tool 3: calcular_rutas
  async toolCalcularRutas(
    planId: string,
    actorUserId: string,
    assumptions?: { commute_minutes?: number; max_budget?: number }
  ): Promise<C01PlanningResult> {
    return this.db.withActor(actorUserId, async (tx) => {
      const plan = await tx.learningPlan.findFirst({
        where: { id: planId, profile: { ownerUserId: actorUserId } },
        include: {
          profile: {
            include: {
              currentVersion: {
                include: {
                  claims: { include: { evidenceLinks: true } },
                  constraints: true,
                  windows: true,
                },
              },
              courseReservations: {
                where: { status: "CONFIRMED" },
                include: { edition: { include: { sessions: true } } },
              },
            },
          },
          targetOpportunity: {
            include: { requirements: { include: { competency: true } } },
          },
        },
      });

      if (!plan || !plan.profile.currentVersion) {
        throw new AppError(404, "PLAN_DATA_NOT_FOUND", "Datos de plan no encontrados");
      }

      const rev = plan.profile.currentVersion;
      const candidate: CandidatePlannerProfile = {
        id: actorUserId,
        profileId: plan.profileId,
        revisionId: rev.id,
        claims: rev.claims.map((c) => ({
          competencyId: c.competencyId,
          decision: c.decision,
          hasEvidence: c.evidenceLinks.length > 0,
        })),
        trainingBudget: rev.constraints?.trainingBudget ? Number(rev.constraints.trainingBudget) : null,
        transportBudget: rev.constraints?.transportBudget ? Number(rev.constraints.transportBudget) : null,
        availabilityWindows: rev.windows.map((w) => ({
          weekday: w.weekday,
          startMinute: w.startMinute,
          endMinute: w.endMinute,
        })),
        activeReservations: plan.profile.courseReservations.map((r) => ({
          editionId: r.editionId,
          startDate: r.edition.startDate,
          endDate: r.edition.endDate,
          sessions: r.edition.sessions.map((s) => ({
            weekday: s.weekday,
            startMinute: s.startMinute,
            endMinute: s.endMinute,
          })),
        })),
      };

      const targetRequirements: TargetRequirement[] = plan.targetOpportunity?.requirements.map((r) => ({
        id: r.id,
        competencyId: r.competencyId,
        competencyName: r.competency?.name || "Competencia",
        competencyCode: r.competency?.code,
        essential: r.requirementType === "ESSENTIAL",
      })) || [];

      // Buscar ediciones dentro del horizonte
      const now = new Date();
      const horizonEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const editionsData = await tx.courseEdition.findMany({
        where: {
          active: true,
          startDate: { gte: now, lte: horizonEnd },
        },
        take: 12,
        include: {
          courseVersion: {
            include: {
              course: { select: { title: true, code: true } },
              learningOutcomes: { include: { competency: true } },
              prerequisites: { include: { competency: true } },
            },
          },
          sessions: true,
          reservations: { where: { status: "CONFIRMED" }, select: { id: true } },
        },
      });

      const plannerEditions: PlannerCourseEdition[] = editionsData.map((ed) => {
        const availableSlots = Math.max(0, ed.totalSlots - ed.reservations.length);
        return {
          id: ed.id,
          courseId: ed.courseVersion.courseId,
          courseTitle: ed.courseVersion.course.title,
          code: ed.courseVersion.course.code,
          startDate: ed.startDate,
          endDate: ed.endDate,
          totalSlots: ed.totalSlots,
          availableSlots,
          costAmount: ed.costAmount ? Number(ed.costAmount) : 0,
          costCurrency: ed.costCurrency || "USD",
          costPeriod: ed.costPeriod,
          scheduleSummary: ed.scheduleSummary,
          sessions: ed.sessions.map((s) => ({
            weekday: s.weekday,
            startMinute: s.startMinute,
            endMinute: s.endMinute,
            timezone: s.timezone,
            location: s.location,
          })),
          learningOutcomes: ed.courseVersion.learningOutcomes.map((o) => ({
            competencyId: o.competencyId,
            competencyName: o.competency.name,
          })),
          prerequisites: ed.courseVersion.prerequisites.map((p) => ({
            competencyId: p.competencyId,
            competencyName: p.competency.name,
            essential: p.essential,
          })),
        };
      });

      return calculateLearningRouteC01(candidate, targetRequirements, plannerEditions, {
        commuteMinutes: assumptions?.commute_minutes,
        maxBudgetAmount: assumptions?.max_budget,
      });
    });
  }

  // Tool 4: leer_resultado
  async toolLeerResultado(planId: string, actorUserId: string): Promise<any> {
    return this.getPlanRecord(planId, actorUserId);
  }

  private async getPlanRecord(planId: string, actorUserId: string): Promise<LearningPlanView | null> {
    return this.db.withActor(actorUserId, async (tx) => {
      const plan = await tx.learningPlan.findFirst({
        where: { id: planId, profile: { ownerUserId: actorUserId } },
        include: {
          steps: {
            orderBy: { stepOrder: "asc" },
            include: {
              edition: {
                include: { courseVersion: { include: { course: true } } },
              },
            },
          },
        },
      });

      if (!plan) return null;

      return {
        id: plan.id,
        target_opportunity_id: plan.targetOpportunityId,
        target_occupation_id: plan.targetOccupationId,
        status: plan.status as any,
        feasibility: plan.feasibility as any,
        coverage_numerator: plan.coverageNumerator,
        coverageDenominator: plan.coverageDenominator,
        coverage_denominator: plan.coverageDenominator,
        total_cost_amount: plan.totalCostAmount ? plan.totalCostAmount.toFixed(2) : null,
        currency: plan.currency,
        residual_gap: plan.residualGap || [],
        reasons: plan.reasons || [],
        steps: plan.steps.map((s) => ({
          id: s.id,
          step_order: s.stepOrder,
          edition_id: s.editionId,
          course_title: s.edition.courseVersion.course.title,
          step_type: s.stepType as any,
          conditional_prerequisite_description: s.conditionalPrerequisiteDescription,
          schedule_summary: s.edition.scheduleSummary,
          cost_amount: s.edition.costAmount ? s.edition.costAmount.toFixed(2) : null,
          currency: s.edition.costCurrency,
        })),
        outdated: plan.outdated,
        version: plan.version,
        confirmed_at: plan.confirmedAt ? plan.confirmedAt.toISOString() : null,
        created_at: plan.createdAt.toISOString(),
      };
    });
  }

  private async executeVertexLoop(
    input: AgentA05Input,
    plan: LearningPlanView,
    config: VertexConfig
  ): Promise<{ explanation: LearningPlanExplanationView; toolsInvoked: string[] }> {
    const host = config.location === "global" ? "aiplatform.googleapis.com" : `${config.location}-aiplatform.googleapis.com`;
    const endpoint = `https://${host}/v1/projects/${config.projectId}/locations/${config.location}/publishers/google/models/${config.model}:generateContent`;

    const systemInstruction = {
      role: "user",
      parts: [
        {
          text: `Eres el orientador formativo A05 en el sistema de intermediación para jóvenes postulantes.
DIRECTRICES ESENCIALES:
1. El motor de rutas determinista C01 ya realizó los cálculos cuantitativos del itinerario formativo. TÚ NO CALCULAS CIFRAS NI RESERVAS POR TU CUENTA, SINO QUE CONSULTAS HERRAMIENTAS Y TRANSMITES EL RESULTADO CON CLARIDAD, EMPATÍA Y PRECISIÓN.
2. NUNCA inventes cursos, certificados otorgados, horas, costos ni competencias adquiridas.
3. El estado de viabilidad entregado en "decision.feasibility" DEBE COINCIDIR EXACTAMENTE con el resultado determinista ("${plan.feasibility}"). NO contradigas en el resumen ni en los motivos la viabilidad de la ruta.
4. No uses acrónimos técnicos como "C01" o "A05" en el texto final para el candidato.
5. Recordatorio crucial de negocio: "Guardar o confirmar un plan formativo NO reserva automáticamente cupo en ninguna edición". Debes aclarar al candidato que la reserva de plaza se realiza por separado de forma consciente y confirmada.
6. Utiliza las herramientas autorizadas:
   - "leer_resultado": Consulta el detalle del plan formativo calculado, sus pasos y razones.
   - "leer_meta_perfil": Consulta las competencias confirmadas y restricciones del candidato.
   - "buscar_ediciones": Consulta convocatorias de cursos disponibles en el catálogo.
   - "calcular_rutas": Ejecuta una reevaluación con el motor determinista C01 si el candidato aporta aclaraciones.
   - "entregar_explicacion": Entrega la orientación final estructurada.`,
        },
      ],
    };

    const toolDeclarations = [
      {
        name: "leer_resultado",
        description: "Consulta el plan formativo calculado, sus pasos ordenados y razones cuantitativas.",
        parameters: {
          type: "OBJECT",
          properties: {
            plan_id: { type: "STRING", description: "ID del plan formativo" },
          },
          required: ["plan_id"],
        },
      },
      {
        name: "leer_meta_perfil",
        description: "Consulta el perfil y competencias confirmadas del candidato.",
        parameters: {
          type: "OBJECT",
          properties: {
            profile_id: { type: "STRING", description: "ID del perfil" },
          },
          required: ["profile_id"],
        },
      },
      {
        name: "buscar_ediciones",
        description: "Consulta convocatorias abiertas de cursos en el catálogo según competencias o modalidad.",
        parameters: {
          type: "OBJECT",
          properties: {
            modality: { type: "STRING", enum: ["ON_SITE", "REMOTE", "HYBRID"] },
            max_cost: { type: "NUMBER" },
          },
        },
      },
      {
        name: "calcular_rutas",
        description: "Ejecuta una reevaluación con el motor determinista C01 con aclaraciones o nuevos supuestos.",
        parameters: {
          type: "OBJECT",
          properties: {
            commute_minutes: { type: "NUMBER", description: "Minutos de traslado declarados" },
            max_budget: { type: "NUMBER", description: "Presupuesto máximo disponible" },
          },
        },
      },
      {
        name: "entregar_explicacion",
        description: "Entrega la explicación estructurada final de la ruta para el candidato.",
        parameters: {
          type: "OBJECT",
          properties: {
            summary: { type: "STRING", description: "Explicación clara en lenguaje natural para el postulante" },
            decision: {
              type: "OBJECT",
              properties: {
                code: { type: "STRING", description: "Código de decisión" },
                feasibility: { type: "STRING", enum: ["VIABLE", "CONDITIONAL", "PENDING", "INVIABLE"] },
                reasons: { type: "ARRAY", items: { type: "STRING" } },
              },
              required: ["code", "feasibility", "reasons"],
            },
            missing_fields: { type: "ARRAY", items: { type: "STRING" } },
            questions: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  field: { type: "STRING" },
                  text: { type: "STRING" },
                },
                required: ["field", "text"],
              },
            },
          },
          required: ["summary", "decision"],
        },
      },
    ];

    const messages: any[] = [
      {
        role: "user",
        parts: [
          {
            text: `Por favor orienta al candidato sobre su plan formativo calculado (ID: ${plan.id}).
Estado de viabilidad determinista: ${plan.feasibility}.
Cobertura de competencias: ${plan.coverage_numerator} de ${plan.coverage_denominator}.
Costo total: $${plan.total_cost_amount ?? "0.00"} ${plan.currency ?? "USD"}.
Pasos incluidos en la ruta: ${plan.steps.length}.
Brecha residual no cubierta: ${plan.residual_gap.join(", ") || "Ninguna"}.
${input.answers && input.answers.length > 0 ? `Aclaraciones del candidato: ${JSON.stringify(input.answers)}` : ""}
Consulta las herramientas correspondientes y entrega la orientación final con entregar_explicacion.`,
          },
        ],
      },
    ];

    const toolsInvoked: string[] = [];
    let finalExplanation: LearningPlanExplanationView | null = null;
    let round = 0;
    const maxRounds = 6;
    const startTime = Date.now();

    while (round < maxRounds && !finalExplanation) {
      if (Date.now() - startTime > 120000) {
        throw new AppError(504, "VERTEX_TIMEOUT", "Tiempo máximo excedido (120s) en orientación Vertex AI");
      }
      round++;

      const payload = {
        contents: messages,
        systemInstruction,
        tools: [{ functionDeclarations: toolDeclarations }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 8192,
        },
      };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorText = await res.text();
        if (res.status === 429) {
          throw new AppError(503, "VERTEX_UNAVAILABLE", "Límite de cuota excedido temporalmente en Vertex AI");
        }
        throw new AppError(503, "VERTEX_UNAVAILABLE", `Error devuelto por Vertex AI (${res.status}): ${errorText}`);
      }

      const data: any = await res.json();
      const candidateObj = data?.candidates?.[0];
      const modelContent = candidateObj?.content;

      if (!modelContent || !modelContent.parts) {
        throw new AppError(503, "VERTEX_UNAVAILABLE", "Respuesta vacía o malformada de Vertex AI");
      }

      messages.push(modelContent);

      const functionCalls = modelContent.parts.filter((p: any) => p.functionCall);

      if (functionCalls.length === 0) {
        // El modelo no invocó ninguna función; forzar entrega si ya tiene información
        break;
      }

      const functionResponseParts: any[] = [];

      for (const callPart of functionCalls) {
        const call = callPart.functionCall;
        const name = call.name;
        const args = call.args || {};
        toolsInvoked.push(name);

        let callResult: any = null;

        if (name === "leer_resultado") {
          callResult = await this.toolLeerResultado(args.plan_id || plan.id, input.actorUserId);
        } else if (name === "leer_meta_perfil") {
          callResult = await this.toolLeerMetaPerfil(args.profile_id || plan.id, input.actorUserId);
        } else if (name === "buscar_ediciones") {
          callResult = await this.toolBuscarEdiciones(input.actorUserId, args);
        } else if (name === "calcular_rutas") {
          callResult = await this.toolCalcularRutas(plan.id, input.actorUserId, args);
        } else if (name === "entregar_explicacion") {
          // Guardrail determinista: la viabilidad entregada no puede contradecir a C01
          const returnedFeasibility = (args.decision?.feasibility as PlanFeasibility) || plan.feasibility;
          const enforcedFeasibility = returnedFeasibility === plan.feasibility ? returnedFeasibility : plan.feasibility;

          finalExplanation = {
            id: randomUUID(),
            plan_id: plan.id,
            agent_id: "A05",
            contract_version: "agent-result/1",
            status: "completed",
            summary: args.summary || "Orientación formativa completada.",
            decision: {
              code: args.decision?.code || "FEASIBILITY_EXPLAINED",
              feasibility: enforcedFeasibility,
              reasons: args.decision?.reasons || plan.reasons,
            },
            missing_fields: args.missing_fields || [],
            questions: args.questions || [],
            created_at: new Date().toISOString(),
          };

          callResult = { success: true };
        } else {
          callResult = { error: `Herramienta desconocida: ${name}` };
        }

        functionResponseParts.push({
          functionResponse: {
            name,
            response: { content: callResult },
          },
        });
      }

      messages.push({
        role: "user",
        parts: functionResponseParts,
      });
    }

    if (!finalExplanation) {
      throw new AppError(
        502,
        "AGENT_INCOMPLETE",
        "El asistente no terminó su explicación. Tu plan sigue guardado; puedes reintentar.",
        true
      );
    }

    // Persistir explicación en la base de datos
    await this.db.withActor(input.actorUserId, async (tx) => {
      await tx.learningPlanExplanation.create({
        data: {
          id: finalExplanation!.id,
          planId: plan.id,
          actorUserId: input.actorUserId,
          agentId: "A05",
          contractVersion: "agent-result/1",
          status: finalExplanation!.status,
          summary: finalExplanation!.summary,
          decisionJson: finalExplanation!.decision as any,
          missingFieldsJson: finalExplanation!.missing_fields as any,
          questionsJson: finalExplanation!.questions as any,
          consentGranted: true,
        },
      });
    });

    return {
      explanation: finalExplanation,
      toolsInvoked,
    };
  }
}
