import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";
import { AgentA05Service, type PlanningDatabase } from "../../apps/api/src/modules/planning/agent-a05.service";
import { calculateLearningRouteC01, type CandidatePlannerProfile, type PlannerCourseEdition } from "../../apps/api/src/modules/planning/c01-planner";
import { VertexAuth } from "../../apps/api/src/modules/profile/vertex-auth";

const target = [{ id: "req", competencyId: "skill", competencyName: "Habilidad", essential: true }];
const profile: CandidatePlannerProfile = {
  id: "actor", profileId: "profile", revisionId: "revision", claims: [], trainingBudget: 100,
  availabilityWindows: [{ weekday: 1, startMinute: 420, endMinute: 780 }], activeReservations: [],
};
const edition: PlannerCourseEdition = {
  id: "edition", courseId: "course", courseTitle: "Curso", code: "CURSO",
  startDate: new Date("2026-11-01"), endDate: new Date("2026-11-10"),
  totalSlots: 1, availableSlots: 1, costAmount: 0, costCurrency: "USD", scheduleSummary: "Lunes",
  sessions: [{ weekday: 1, startMinute: 480, endMinute: 600 }],
  learningOutcomes: [{ competencyId: "skill" }], prerequisites: [],
};

function agentFixture(hasEvidence = false) {
  const saved: unknown[] = [];
  const record = {
    id: "plan", profileId: "profile", revisionId: "revision", status: "CALCULATED", feasibility: "VIABLE",
    coverageNumerator: 1, coverageDenominator: 1, totalCostAmount: null, currency: "USD",
    residualGap: [], reasons: ["Resultado determinístico"], steps: [], outdated: false, version: 1,
    confirmedAt: null, createdAt: new Date("2026-10-17"), targetOpportunityId: null, targetOccupationId: null,
    profile: {
      currentVersion: {
        id: "revision", claims: [{ competencyId: "skill", decision: "ACCEPTED", evidenceLinks: hasEvidence ? [{ id: "evidence" }] : [] }],
        constraints: {}, windows: profile.availabilityWindows,
      }, courseReservations: [],
    },
    targetOpportunity: { requirements: [{ id: "req", competencyId: "skill", requirementType: "ESSENTIAL", competency: { name: "Habilidad" } }] },
  };
  const tx = {
    learningPlan: { findFirst: async () => record }, courseEdition: { findMany: async () => [] },
    learningPlanExplanation: { create: async (data: unknown) => { saved.push(data); return data; } },
  };
  const db = {
    resolveAuthSubject: async () => "actor",
    withActor: async (_actor: string, fn: (client: typeof tx) => Promise<unknown>) => fn(tx),
  } as unknown as PlanningDatabase;
  return { agent: new AgentA05Service(db), saved };
}

afterEach(() => mock.restore());

describe("A05 regressions: evidence, unknown logistics and completed delivery", () => {
  it("does not accredit an accepted claim with no evidence through the agent tool", async () => {
    const { agent } = agentFixture();
    const result = await agent.toolCalcularRutas("plan", "actor", { commute_minutes: 0 });
    expect(result.calculationTrace.allRequirementsMet).not.toBe(true);
    expect(result.coverageNumerator).toBe(0);
  });

  it("preserves accreditation when evidence really exists", async () => {
    const { agent } = agentFixture(true);
    const result = await agent.toolCalcularRutas("plan", "actor");
    expect(result.calculationTrace.allRequirementsMet).toBe(true);
    expect(result.coverageNumerator).toBe(1);
  });

  it("requires commute clarification rather than silently assuming zero", () => {
    const result = calculateLearningRouteC01(profile, target, [edition]);
    expect(result.feasibility).toBe("PENDING");
    expect(result.reasons.join(" ")).toContain("traslado");
    expect(result.reasons.join(" ")).not.toContain("plenamente compatibles");
  });

  it("requires availability clarification even when zero commute is explicit", () => {
    const result = calculateLearningRouteC01({ ...profile, availabilityWindows: [] }, target, [edition], { commuteMinutes: 0 });
    expect(result.feasibility).toBe("PENDING");
    expect(result.reasons.join(" ")).toContain("disponibilidad");
  });

  it("does not treat a course without structured sessions as a verified schedule", () => {
    const result = calculateLearningRouteC01(profile, target, [{ ...edition, sessions: [] }], { commuteMinutes: 0 });
    expect(result.feasibility).toBe("PENDING");
  });

  it("preserves viable plans with explicit compatible logistics", () => {
    const result = calculateLearningRouteC01(profile, target, [edition], { commuteMinutes: 0 });
    expect(result.feasibility).toBe("VIABLE");
  });

  it("does not turn a known budget violation into pending for unknown logistics", () => {
    const result = calculateLearningRouteC01({ ...profile, trainingBudget: 0 }, target, [{ ...edition, costAmount: 5 }]);
    expect(result.feasibility).toBe("INVIABLE");
    expect(result.steps).toHaveLength(0);
  });

  it("does not persist a successful explanation when Vertex fails to deliver a tool result", async () => {
    spyOn(VertexAuth, "getVertexConfig").mockResolvedValue({ projectId: "test", location: "global", model: "test", accessToken: "synthetic" });
    spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ candidates: [{ content: { role: "model", parts: [{ text: "No entregué explicación." }] } }] }));
    const { agent, saved } = agentFixture();
    await expect(agent.explainPlan({ planId: "plan", actorUserId: "actor", consent: true })).rejects.toMatchObject({ code: "AGENT_INCOMPLETE" });
    expect(saved).toHaveLength(0);
  });

  it("persists a genuine structured model delivery while preserving C01 feasibility", async () => {
    spyOn(VertexAuth, "getVertexConfig").mockResolvedValue({ projectId: "test", location: "global", model: "test", accessToken: "synthetic" });
    spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ candidates: [{ content: { role: "model", parts: [{ functionCall: {
      name: "entregar_explicacion", args: { summary: "Consulta tu ruta y confirma cada reserva por separado.", decision: { code: "EXPLAINED", feasibility: "INVIABLE", reasons: [] } },
    } }] } }] }));
    const { agent, saved } = agentFixture();
    const result = await agent.explainPlan({ planId: "plan", actorUserId: "actor", consent: true });
    expect(result.explanation.status).toBe("completed");
    expect(result.explanation.decision.feasibility).toBe("VIABLE");
    expect(result.toolsInvoked).toContain("entregar_explicacion");
    expect(saved).toHaveLength(1);
  });
});
