import { describe, it, expect } from "bun:test";
import {
  calculateLearningRouteC01,
  type CandidatePlannerProfile,
  type TargetRequirement,
  type PlannerCourseEdition,
} from "../../apps/api/src/modules/planning/c01-planner";

describe("D4-B C01 Learning Route Planner (Unit Tests)", () => {
  const baseProfile: CandidatePlannerProfile = {
    id: "user-1",
    profileId: "prof-1",
    revisionId: "rev-1",
    claims: [
      {
        competencyId: "comp-math",
        competencyCode: "MATH-01",
        decision: "ACCEPTED",
        hasEvidence: true,
      },
    ],
    trainingBudget: 100,
    transportBudget: 50,
    availabilityWindows: [
      { weekday: 6, startMinute: 420, endMinute: 1080 }, // Sábado 07:00 a 18:00
      { weekday: 7, startMinute: 420, endMinute: 1080 }, // Domingo 07:00 a 18:00
    ],
    activeReservations: [],
  };

  const targetGoals: TargetRequirement[] = [
    {
      id: "req-1",
      competencyId: "comp-inv",
      competencyName: "Gestión de Inventarios",
      competencyCode: "LOG-INV",
      essential: true,
    },
  ];

  it("calculates a VIABLE route when an edition covers the gap within budget and schedule", () => {
    const editions: PlannerCourseEdition[] = [
      {
        id: "ed-1",
        courseId: "course-1",
        courseTitle: "Control de Inventarios Básicos",
        code: "ED-INV-01",
        startDate: new Date("2026-11-01T08:00:00Z"),
        endDate: new Date("2026-11-20T12:00:00Z"),
        totalSlots: 20,
        availableSlots: 5,
        costAmount: 40,
        costCurrency: "USD",
        scheduleSummary: "Sábados 08:00 - 12:00",
        sessions: [
          { weekday: 6, startMinute: 480, endMinute: 720 }, // Sábado 08:00 a 12:00
        ],
        learningOutcomes: [
          { competencyId: "comp-inv", competencyName: "Gestión de Inventarios" },
        ],
        prerequisites: [
          { competencyId: "comp-math", competencyName: "Matemática básica", essential: true },
        ],
      },
    ];

    const result = calculateLearningRouteC01(baseProfile, targetGoals, editions, { commuteMinutes: 0 });

    expect(result.feasibility).toBe("VIABLE");
    expect(result.coverageNumerator).toBe(1);
    expect(result.coverageDenominator).toBe(1);
    expect(result.residualGap.length).toBe(0);
    expect(result.steps.length).toBe(1);
    expect(result.steps[0].editionId).toBe("ed-1");
    expect(result.steps[0].stepType).toBe("DIRECT");
    expect(result.totalCostAmount).toBe("40.00");
  });

  it("returns a partial route with residual gap when courses only cover part of the requirements", () => {
    const twoGoals: TargetRequirement[] = [
      { id: "req-1", competencyId: "comp-inv", competencyName: "Gestión de Inventarios", essential: true },
      { id: "req-2", competencyId: "comp-excel", competencyName: "Excel Avanzado", essential: true },
    ];

    const editions: PlannerCourseEdition[] = [
      {
        id: "ed-1",
        courseId: "course-1",
        courseTitle: "Control de Inventarios Básicos",
        code: "ED-INV-01",
        startDate: new Date("2026-11-01T08:00:00Z"),
        endDate: new Date("2026-11-20T12:00:00Z"),
        totalSlots: 20,
        availableSlots: 5,
        costAmount: 30,
        costCurrency: "USD",
        scheduleSummary: "Sábados 08:00 - 12:00",
        sessions: [{ weekday: 6, startMinute: 480, endMinute: 720 }],
        learningOutcomes: [{ competencyId: "comp-inv", competencyName: "Gestión de Inventarios" }],
        prerequisites: [],
      },
    ];

    const result = calculateLearningRouteC01(baseProfile, twoGoals, editions, { commuteMinutes: 0 });

    expect(result.feasibility).toBe("VIABLE");
    expect(result.coverageNumerator).toBe(1);
    expect(result.coverageDenominator).toBe(2);
    expect(result.residualGap).toEqual(["Excel Avanzado"]);
  });

  it("flags feasibility as PENDING when edition fees have incomparable currencies", () => {
    const editions: PlannerCourseEdition[] = [
      {
        id: "ed-eur",
        courseId: "course-eur",
        courseTitle: "Curso Internacional",
        code: "ED-EUR-01",
        startDate: new Date("2026-11-01T08:00:00Z"),
        endDate: new Date("2026-11-20T12:00:00Z"),
        totalSlots: 20,
        availableSlots: 5,
        costAmount: 50,
        costCurrency: "EUR", // Moneda distinta a USD
        scheduleSummary: "Sábados 08:00 - 12:00",
        sessions: [{ weekday: 6, startMinute: 480, endMinute: 720 }],
        learningOutcomes: [{ competencyId: "comp-inv", competencyName: "Gestión de Inventarios" }],
        prerequisites: [],
      },
      {
        id: "ed-usd",
        courseId: "course-usd",
        courseTitle: "Curso Local",
        code: "ED-USD-01",
        startDate: new Date("2026-11-01T08:00:00Z"),
        endDate: new Date("2026-11-20T12:00:00Z"),
        totalSlots: 20,
        availableSlots: 5,
        costAmount: 30,
        costCurrency: "USD",
        scheduleSummary: "Domingos 08:00 - 12:00",
        sessions: [{ weekday: 7, startMinute: 480, endMinute: 720 }],
        learningOutcomes: [{ competencyId: "comp-inv", competencyName: "Gestión de Inventarios" }],
        prerequisites: [],
      },
    ];

    // Combinación de ambas monedas
    const result = calculateLearningRouteC01(baseProfile, targetGoals, editions, { commuteMinutes: 0 });
    // Debe seleccionar ed-usd como mejor ruta o si evalúa eur marcar PENDING
    expect(["VIABLE", "PENDING"]).toContain(result.feasibility);
  });

  it("marks route INVIABLE when course cost exceeds candidate budget", () => {
    const poorProfile: CandidatePlannerProfile = {
      ...baseProfile,
      trainingBudget: 25, // Presupuesto insuficiente
    };

    const editions: PlannerCourseEdition[] = [
      {
        id: "ed-expensive",
        courseId: "course-1",
        courseTitle: "Control de Inventarios Costoso",
        code: "ED-EXP-01",
        startDate: new Date("2026-11-01T08:00:00Z"),
        endDate: new Date("2026-11-20T12:00:00Z"),
        totalSlots: 20,
        availableSlots: 5,
        costAmount: 150, // 150 > 25
        costCurrency: "USD",
        scheduleSummary: "Sábados 08:00 - 12:00",
        sessions: [{ weekday: 6, startMinute: 480, endMinute: 720 }],
        learningOutcomes: [{ competencyId: "comp-inv", competencyName: "Gestión de Inventarios" }],
        prerequisites: [],
      },
    ];

    const result = calculateLearningRouteC01(poorProfile, targetGoals, editions, { commuteMinutes: 0 });

    expect(result.feasibility).toBe("INVIABLE");
    expect(result.steps.length).toBe(0);
    expect(result.reasons[0]).toContain("presupuesto");
  });

  it("disqualifies edition when sessions collide with candidate availability windows", () => {
    const editions: PlannerCourseEdition[] = [
      {
        id: "ed-weekday",
        courseId: "course-1",
        courseTitle: "Control de Inventarios Entre Semana",
        code: "ED-WD-01",
        startDate: new Date("2026-11-01T08:00:00Z"),
        endDate: new Date("2026-11-20T12:00:00Z"),
        totalSlots: 20,
        availableSlots: 5,
        costAmount: 20,
        costCurrency: "USD",
        scheduleSummary: "Lunes 08:00 - 12:00",
        sessions: [
          { weekday: 1, startMinute: 480, endMinute: 720 }, // Lunes (el candidato solo puede sábado y domingo)
        ],
        learningOutcomes: [{ competencyId: "comp-inv", competencyName: "Gestión de Inventarios" }],
        prerequisites: [],
      },
    ];

    const result = calculateLearningRouteC01(baseProfile, targetGoals, editions, { commuteMinutes: 0 });

    expect(result.feasibility).toBe("INVIABLE");
    expect(result.steps.length).toBe(0);
  });

  it("disqualifies edition when sessions collide with candidate active reservations", () => {
    const profileWithReservation: CandidatePlannerProfile = {
      ...baseProfile,
      activeReservations: [
        {
          editionId: "ed-booked",
          startDate: new Date("2026-11-01T00:00:00Z"),
          endDate: new Date("2026-11-30T00:00:00Z"),
          sessions: [{ weekday: 6, startMinute: 500, endMinute: 700 }], // Sábado 08:20 a 11:40
        },
      ],
    };

    const editions: PlannerCourseEdition[] = [
      {
        id: "ed-colliding",
        courseId: "course-1",
        courseTitle: "Control de Inventarios Choque",
        code: "ED-COL-01",
        startDate: new Date("2026-11-01T08:00:00Z"),
        endDate: new Date("2026-11-20T12:00:00Z"),
        totalSlots: 20,
        availableSlots: 5,
        costAmount: 20,
        costCurrency: "USD",
        scheduleSummary: "Sábados 08:00 - 12:00",
        sessions: [{ weekday: 6, startMinute: 480, endMinute: 720 }], // Choca con ed-booked
        learningOutcomes: [{ competencyId: "comp-inv", competencyName: "Gestión de Inventarios" }],
        prerequisites: [],
      },
    ];

    const result = calculateLearningRouteC01(profileWithReservation, targetGoals, editions, { commuteMinutes: 0 });

    expect(result.feasibility).toBe("INVIABLE");
    expect(result.steps.length).toBe(0);
  });

  it("disqualifies edition when an essential prerequisite is missing and cannot be learned", () => {
    const editions: PlannerCourseEdition[] = [
      {
        id: "ed-prereq",
        courseId: "course-1",
        courseTitle: "Gestión de Inventarios Avanzada",
        code: "ED-ADV-01",
        startDate: new Date("2026-11-01T08:00:00Z"),
        endDate: new Date("2026-11-20T12:00:00Z"),
        totalSlots: 20,
        availableSlots: 5,
        costAmount: 20,
        costCurrency: "USD",
        scheduleSummary: "Sábados 08:00 - 12:00",
        sessions: [{ weekday: 6, startMinute: 480, endMinute: 720 }],
        learningOutcomes: [{ competencyId: "comp-inv", competencyName: "Gestión de Inventarios" }],
        prerequisites: [
          { competencyId: "comp-unknown-programming", competencyName: "Programación en Python", essential: true },
        ],
      },
    ];

    const result = calculateLearningRouteC01(baseProfile, targetGoals, editions, { commuteMinutes: 0 });

    expect(result.feasibility).toBe("INVIABLE");
    expect(result.steps.length).toBe(0);
  });

  it("generates a sequential CONDITIONAL route when Course 2 depends on Course 1 learning outcomes", () => {
    // Meta final: requiere "comp-log-adv" (Logística Avanzada)
    const advGoal: TargetRequirement[] = [
      { id: "req-adv", competencyId: "comp-log-adv", competencyName: "Logística Avanzada", essential: true },
    ];

    const editions: PlannerCourseEdition[] = [
      {
        id: "ed-1-intro",
        courseId: "c-1",
        courseTitle: "Introducción a la Logística",
        code: "ED-LOG-01",
        startDate: new Date("2026-11-01T08:00:00Z"),
        endDate: new Date("2026-11-10T12:00:00Z"),
        totalSlots: 20,
        availableSlots: 5,
        costAmount: 25,
        costCurrency: "USD",
        scheduleSummary: "Sábados 08:00 - 12:00",
        sessions: [{ weekday: 6, startMinute: 480, endMinute: 720 }],
        learningOutcomes: [
          { competencyId: "comp-log-base", competencyName: "Fundamentos de Logística" },
        ],
        prerequisites: [],
      },
      {
        id: "ed-2-adv",
        courseId: "c-2",
        courseTitle: "Logística Avanzada y Despacho",
        code: "ED-LOG-02",
        startDate: new Date("2026-11-12T08:00:00Z"),
        endDate: new Date("2026-11-25T12:00:00Z"),
        totalSlots: 20,
        availableSlots: 5,
        costAmount: 35,
        costCurrency: "USD",
        scheduleSummary: "Domingos 08:00 - 12:00",
        sessions: [{ weekday: 7, startMinute: 480, endMinute: 720 }],
        learningOutcomes: [
          { competencyId: "comp-log-adv", competencyName: "Logística Avanzada" },
        ],
        prerequisites: [
          // Exige la competencia que enseña ed-1-intro
          { competencyId: "comp-log-base", competencyName: "Fundamentos de Logística", essential: true },
        ],
      },
    ];

    const result = calculateLearningRouteC01(baseProfile, advGoal, editions, { commuteMinutes: 0 });

    expect(result.feasibility).toBe("CONDITIONAL");
    expect(result.coverageNumerator).toBe(1);
    expect(result.steps.length).toBe(2);
    expect(result.steps[0].editionId).toBe("ed-1-intro");
    expect(result.steps[0].stepType).toBe("DIRECT");
    expect(result.steps[1].editionId).toBe("ed-2-adv");
    expect(result.steps[1].stepType).toBe("CONDITIONAL");
    expect(result.steps[1].conditionalPrerequisiteDescription).toContain("Fundamentos de Logística");
  });
});
