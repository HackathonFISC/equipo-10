import { randomUUID } from "node:crypto";
import {
  type OpportunityDraftView,
  type OpportunityDraftRequirement,
  type DiscriminatoryWarning,
  type WorkplaceType,
  type MoneyPeriod,
} from "@equipo10/contracts";
import { AppError } from "../../errors";
import { VertexAuth, type VertexConfig } from "../profile/vertex-auth";
import type { Prisma } from "../../../../../generated/prisma/client.js";
import type { ActorTransactionOptions } from "../../infrastructure/database";

export interface RecruitmentDatabase {
  resolveAuthSubject(subject: string, bootstrap: boolean): Promise<string | null>;
  withActor<T>(id: string, fn: (tx: Prisma.TransactionClient) => Promise<T>, options?: ActorTransactionOptions): Promise<T>;
}

export interface A01ProposalResult {
  catalog_version_id?: string;
  title?: string;
  occupation_id?: string;
  occupation_name?: string;
  proposed_requirements: OpportunityDraftRequirement[];
  clarification_questions: string[];
  discriminatory_warnings: DiscriminatoryWarning[];
  has_blocking_issues: boolean;
  provider: string;
  toolsInvoked?: string[];
}

export type AgentA01Runner = (input: { rawText: string; actorUserId: string;catalogVersionId?:string }) => Promise<A01ProposalResult>;

export interface IAgentA01Service {
  analyzeVacancy(input: { rawText: string; actorUserId: string;catalogVersionId?:string }): Promise<A01ProposalResult>;
  detectDiscriminatoryTerms(text: string): DiscriminatoryWarning[];
}

// Patrones deterministas de sesgos y términos discriminatorios prohibidos
const DISCRIMINATORY_PATTERNS: { regex: RegExp; field: string; explanation: string }[] = [
  {
    regex: /\b(edad\s*(máxima|entre|de|menor|mínima)|años\s*máximo|máximo\s*\d+\s*años|menor\s*de\s*\d+|menores\s*de|recién\s*graduado\s*joven)\b/i,
    field: "description",
    explanation: "Restricción de edad injustificada. La legislación laboral prohíbe excluir candidatos por edad salvo disposición legal expresa.",
  },
  {
    regex: /\b(buena\s*presencia|buena\s*presentación\s*física|foto\s*indispensable|estatura\s*(mínima|de)|tez\s*clara|delgada|aspecto\s*físico)\b/i,
    field: "description",
    explanation: "Requisitos de apariencia física o fotografía obligatoria constituyen sesgos discriminatorios.",
  },
  {
    regex: /\b(femenino|masculino|mujer|hombre|varón|señorita|damas|caballeros|solo\s*mujeres|solo\s*hombres)\b/i,
    field: "description",
    explanation: "Preferencia o restricción por sexo/género. Las oportunidades deben ser accesibles a cualquier persona calificada.",
  },
  {
    regex: /\b(soltero|soltera|sin\s*hijos|sin\s*cargas\s*familiares|estado\s*civil\s*soltero)\b/i,
    field: "description",
    explanation: "Condición familiar o estado civil exigido de forma discriminatoria.",
  },
  {
    regex: /\b(solo\s*panameños|no\s*extranjeros|nacionalidad\s*específica)\b/i,
    field: "description",
    explanation: "Cláusulas de exclusión por nacionalidad sin justificación regulatoria directa.",
  },
];

export class AgentA01Service implements IAgentA01Service {
  constructor(
    private readonly db: RecruitmentDatabase,
    private readonly testRunner?: AgentA01Runner
  ) {}

  detectDiscriminatoryTerms(text: string): DiscriminatoryWarning[] {
    const warnings: DiscriminatoryWarning[] = [];
    for (const pattern of DISCRIMINATORY_PATTERNS) {
      if (pattern.regex.test(text)) {
        warnings.push({
          field: pattern.field,
          issue: "DISCRIMINATORY_CRITERIA",
          severity: "BLOCKING",
          explanation: pattern.explanation,
        });
      }
    }
    return warnings;
  }

  async analyzeVacancy(input: { rawText: string; actorUserId: string;catalogVersionId?:string }): Promise<A01ProposalResult> {
    const catalogVersionId=input.catalogVersionId ?? await this.db.withActor(input.actorUserId,async tx=>(await tx.catalogVersion.findFirst({orderBy:[{createdAt:"desc"},{id:"desc"}]}))?.id);
    if(!catalogVersionId)throw new AppError(409,"CATALOG_NOT_FOUND","No hay catálogo disponible");
    const deterministicWarnings = this.detectDiscriminatoryTerms(input.rawText);

    // 1. Si hay test runner inyectado para pruebas unitarias / offline
    if (this.testRunner) {
      try {
        const result = await this.testRunner(input);
        // Asegurar que las advertencias deterministas no se pierdan
        const combinedWarnings = [...result.discriminatory_warnings];
        for (const dw of deterministicWarnings) {
          if (!combinedWarnings.some((w) => w.explanation === dw.explanation)) {
            combinedWarnings.push(dw);
          }
        }
        return {
          ...result,
          catalog_version_id:catalogVersionId,
          discriminatory_warnings: combinedWarnings,
          has_blocking_issues: combinedWarnings.length > 0,
        };
      } catch (err: any) {
        if (err instanceof AppError) throw err;
        throw new AppError(503, "VERTEX_UNAVAILABLE", `Error en ejecución de A01: ${err.message || String(err)}`);
      }
    }

    // 2. Vertex AI directo con ADC y ubicación global
    const vertexConfig = await VertexAuth.getVertexConfig();
    if (!vertexConfig) {
      throw new AppError(
        503,
        "VERTEX_UNAVAILABLE",
        "No se encontraron credenciales válidas de Vertex AI (ADC). Configure Google Cloud ADC o VERTEX_PROJECT_ID."
      );
    }

    const endpoint = `https://aiplatform.googleapis.com/v1/projects/${vertexConfig.projectId}/locations/${vertexConfig.location}/publishers/google/models/${vertexConfig.model}:generateContent`;

    const systemInstruction = {
      role: "system",
      parts: [
        {
          text: `Eres el Agente A01 de AImpulsa, especialista en normalización de vacantes de empleo y vinculación al catálogo ocupacional versionado.
Tu misión:
1. Analizar el texto libre de la vacante provisto por el reclutador.
2. Usar 'buscar_catalogo_ocupaciones' para encontrar la ocupación más adecuada en el catálogo oficial.
3. Usar 'buscar_catalogo_competencias' para vincular las tareas mencionadas a competencias reales del catálogo versionado.
4. Identificar requisitos esenciales vs deseables, y de entrada vs entrenables.
5. Preguntar únicamente por información faltante esencial o ambigua (máximo 3 preguntas concretas).
6. Identificar alertas discriminatorias (edad, género, estado civil, aspecto físico) y reportarlas.
7. Finalizar invocando 'proponer_vacante' con la propuesta estructurada.
REGLA ESTRICTA: No inventes equivalencias ni crees competencias que no existan en el catálogo.`,
        },
      ],
    };

    const toolDeclarations = [
      {
        name: "buscar_catalogo_ocupaciones",
        description: "Busca ocupaciones disponibles en el catálogo versionado según una consulta de texto.",
        parameters: {
          type: "OBJECT",
          properties: {
            query: { type: "STRING", description: "Texto de búsqueda de puesto u ocupación" },
          },
          required: ["query"],
        },
      },
      {
        name: "buscar_catalogo_competencias",
        description: "Busca competencias y habilidades en el catálogo oficial para vincular a la vacante.",
        parameters: {
          type: "OBJECT",
          properties: {
            query: { type: "STRING", description: "Habilidad, conocimiento o tarea a buscar" },
          },
          required: ["query"],
        },
      },
      {
        name: "proponer_vacante",
        description: "Entrega la propuesta estructurada de puesto, competencias y preguntas de aclaración.",
        parameters: {
          type: "OBJECT",
          properties: {
            title: { type: "STRING", description: "Título normalizado de la vacante" },
            occupation_id: { type: "STRING", description: "UUID de la ocupación del catálogo encontrada" },
            requirements: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  competency_id: { type: "STRING", description: "UUID de la competencia del catálogo" },
                  requirement_type: { type: "STRING", enum: ["ESSENTIAL", "DESIRABLE"] },
                  stage: { type: "STRING", enum: ["ENTRY", "TRAINABLE"] },
                  description: { type: "STRING", description: "Descripción del requisito" },
                },
                required: ["competency_id", "requirement_type", "stage", "description"],
              },
            },
            questions: {
              type: "ARRAY",
              items: { type: "STRING" },
              description: "Preguntas aclaratorias necesarias sobre ambigüedades",
            },
            discriminatory_warnings: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  field: { type: "STRING" },
                  issue: { type: "STRING" },
                  severity: { type: "STRING", enum: ["BLOCKING"] },
                  explanation: { type: "STRING" },
                },
                required: ["field", "issue", "severity", "explanation"],
              },
            },
          },
          required: ["title", "occupation_id", "requirements"],
        },
      },
    ];

    const messages: any[] = [
      {
        role: "user",
        parts: [
          {
            text: `Por favor normaliza la siguiente vacante descrita por la empresa:
"""
${input.rawText}
"""
Busca en el catálogo y propón el puesto y habilidades con 'proponer_vacante'.`,
          },
        ],
      },
    ];

    const toolsInvoked: string[] = [];
    let finalProposal: A01ProposalResult | null = null;
    let round = 0;
    const maxRounds = 5;
    const startTime = Date.now();
    const signal=AbortSignal.timeout(90000);

    while (round < maxRounds && !finalProposal) {
      if (Date.now() - startTime > 90000) {
        throw new AppError(504, "VERTEX_TIMEOUT", "Tiempo máximo excedido (90s) en normalización A01 Vertex AI");
      }
      round++;

      const payload = {
        contents: messages,
        systemInstruction,
        tools: [{ functionDeclarations: toolDeclarations }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 8192,
          thinkingConfig:{thinkingLevel:"LOW"},
        },
      };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${vertexConfig.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal,
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
      if(candidateObj?.finishReason==="MAX_TOKENS")throw new AppError(502,"VERTEX_TRUNCATED","La propuesta quedó incompleta; no se ejecutó ninguna herramienta parcial. Puedes reintentar.",true);
      const modelContent = candidateObj?.content;

      if (!modelContent || !modelContent.parts) {
        throw new AppError(503, "VERTEX_UNAVAILABLE", "Respuesta vacía o malformada de Vertex AI");
      }

      messages.push(modelContent);
      const functionCalls = modelContent.parts.filter((p: any) => p.functionCall);

      if (functionCalls.length === 0) {
        break;
      }

      const functionResponseParts: any[] = [];

      for (const callPart of functionCalls) {
        const call = callPart.functionCall;
        const name = call.name;
        const args = call.args || {};
        toolsInvoked.push(name);

        let callResult: any = null;

        if (name === "buscar_catalogo_ocupaciones") {
          callResult = await this.db.withActor(input.actorUserId, async (tx) => {
            const queryText = String(args.query || "").trim();
            const results = await tx.occupationEntry.findMany({
              where: {
                catalogVersionId,active:true,
                OR: [
                  { name: { contains: queryText, mode: "insensitive" } },
                  { description: { contains: queryText, mode: "insensitive" } },
                ],
              },
              take: 5,
              select: { id: true, code: true, name: true, description: true },
            });
            return { occupations: results };
          });
        } else if (name === "buscar_catalogo_competencias") {
          callResult = await this.db.withActor(input.actorUserId, async (tx) => {
            const queryText = String(args.query || "").trim();
            const results = await tx.competencyEntry.findMany({
              where: {
                catalogVersionId,
                OR: [
                  { name: { contains: queryText, mode: "insensitive" } },
                  { description: { contains: queryText, mode: "insensitive" } },
                ],
              },
              take: 8,
              select: { id: true, code: true, name: true, kind: true, description: true },
            });
            return { competencies: results };
          });
        } else if (name === "proponer_vacante") {
          // Obtener nombre de la ocupación y de las competencias
          const proposalDetails = await this.db.withActor(input.actorUserId, async (tx) => {
            const occ = await tx.occupationEntry.findFirst({
              where: { id: args.occupation_id,catalogVersionId,active:true },
              select: { id: true, name: true },
            });

            const reqs: OpportunityDraftRequirement[] = [];
            for (const r of args.requirements || []) {
              const comp = await tx.competencyEntry.findFirst({
                where: { id: r.competency_id,catalogVersionId },
                select: { id: true, name: true },
              });
              if (comp) {
                reqs.push({
                  competency_id: comp.id,
                  competency_name: comp.name,
                  requirement_type: r.requirement_type || "ESSENTIAL",
                  stage: r.stage || "ENTRY",
                  description: r.description || comp.name,
                });
              }
            }

            return { occ, reqs };
          });

          const warnings: DiscriminatoryWarning[] = [...(args.discriminatory_warnings || [])];
          for (const dw of deterministicWarnings) {
            if (!warnings.some((w) => w.explanation === dw.explanation)) {
              warnings.push(dw);
            }
          }

          finalProposal = {
            catalog_version_id:catalogVersionId,
            title: args.title || proposalDetails.occ?.name || "Vacante",
            occupation_id: proposalDetails.occ?.id,
            occupation_name: proposalDetails.occ?.name,
            proposed_requirements: proposalDetails.reqs,
            clarification_questions: args.questions || [],
            discriminatory_warnings: warnings,
            has_blocking_issues: warnings.length > 0,
            provider: "gemini-3.8-flash:global",
            toolsInvoked,
          };

          callResult = { status: "received" };
        } else {
          callResult = { error: `Herramienta desconocida ${name}` };
        }

        functionResponseParts.push({
          functionResponse: {
            name,
            response: callResult,
          },
        });
      }

      messages.push({
        role: "user",
        parts: functionResponseParts,
      });
    }

    if (!finalProposal) {
      throw new AppError(503, "VERTEX_UNAVAILABLE", "A01 no generó una propuesta estructurada válida para la vacante");
    }

    return finalProposal;
  }
}
