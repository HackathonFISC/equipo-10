import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { evaluateC01Compatibility } from "../../apps/api/src/modules/opportunities/c01-matcher";

describe("D3-2 Deterministic Matching Engine C01", () => {
  const fixturesPath = resolve(import.meta.dir, "../fixtures/d3/expected.json");
  const testMatrix = JSON.parse(readFileSync(fixturesPath, "utf-8")) as any[];

  it("loads 15 synthetic cases from tests/fixtures/d3/expected.json", () => {
    expect(testMatrix.length).toBeGreaterThanOrEqual(15);
  });

  for (const tc of testMatrix) {
    if (tc.id === "CASE-D3-13-VERSION-CHANGE-OUTDATED" || tc.id === "CASE-D3-14-CROSS-TENANT-ACCESS-DENIED") {
      // These are tested in the API integration test
      continue;
    }

    if (tc.id === "CASE-D3-15-COUNTERFACTUAL-FAIRNESS") {
      it(`evaluates ${tc.id}: ${tc.name}`, () => {
        const reqs = [
          {
            id: "req-1",
            competencyId: "c-1",
            competencyCode: "COMP-INV-01",
            competencyName: "Inventario",
            requirementType: "ESSENTIAL" as const,
            stage: "ENTRY" as const,
          },
        ];
        const vacA = {
          id: "vac-1",
          version: 1,
          title: "Auxiliar",
          salaryAmount: "650.00",
          salaryCurrency: "USD",
          salaryPeriod: "MONTH" as const,
          requirements: reqs,
        };

        const candA = {
          id: "cand-a",
          revisionId: "rev-1",
          displayName: tc.input.scenario_a.display_name,
          claims: tc.input.scenario_a.claims.map((c: any) => ({
            competencyId: "c-1",
            competencyCode: c.competency_code,
            hasEvidence: c.has_evidence,
          })),
          constraints: {
            salaryState: "KNOWN",
            minimumSalary: tc.input.scenario_a.constraints.minimum_salary,
            salaryCurrency: tc.input.scenario_a.constraints.salary_currency,
            salaryPeriod: tc.input.scenario_a.constraints.salary_period,
            travelLimitState: "KNOWN",
            maxOneWayMinutes: tc.input.scenario_a.constraints.max_one_way_minutes,
          },
        };

        const candB = {
          id: "cand-b",
          revisionId: "rev-2",
          displayName: tc.input.scenario_b.display_name,
          claims: tc.input.scenario_b.claims.map((c: any) => ({
            competencyId: "c-1",
            competencyCode: c.competency_code,
            hasEvidence: c.has_evidence,
          })),
          constraints: {
            salaryState: "KNOWN",
            minimumSalary: tc.input.scenario_b.constraints.minimum_salary,
            salaryCurrency: tc.input.scenario_b.constraints.salary_currency,
            salaryPeriod: tc.input.scenario_b.constraints.salary_period,
            travelLimitState: "KNOWN",
            maxOneWayMinutes: tc.input.scenario_b.constraints.max_one_way_minutes,
          },
        };

        const resA = evaluateC01Compatibility(candA, vacA, { commute_minutes: tc.input.scenario_a.commute_minutes });
        const resB = evaluateC01Compatibility(candB, vacA, { commute_minutes: tc.input.scenario_b.commute_minutes });

        expect(resA.status).toBe(resB.status);
        expect(resA.coverageNumerator).toBe(resB.coverageNumerator);
        expect(resA.coverageDenominator).toBe(resB.coverageDenominator);
        expect(resA.coveragePercent).toBe(resB.coveragePercent);
      });
      continue;
    }

    it(`evaluates ${tc.id}: ${tc.name}`, () => {
      const candidateInput = {
        id: "cand-test-id",
        revisionId: "rev-test-id",
        displayName: tc.input.candidate.display_name,
        claims: (tc.input.candidate.claims || []).map((c: any, idx: number) => ({
          competencyId: c.competency_id || `comp-id-${idx}`,
          competencyCode: c.competency_code,
          decision: c.decision,
          hasEvidence: c.has_evidence,
        })),
        constraints: {
          salaryState: tc.input.candidate.constraints?.salary_state,
          minimumSalary: tc.input.candidate.constraints?.minimum_salary,
          salaryCurrency: tc.input.candidate.constraints?.salary_currency,
          salaryPeriod: tc.input.candidate.constraints?.salary_period,
          travelLimitState: tc.input.candidate.constraints?.travel_limit_state,
          maxOneWayMinutes: tc.input.candidate.constraints?.max_one_way_minutes,
          availabilityState: tc.input.candidate.constraints?.availability_state,
        },
        windows: (tc.input.candidate.windows || []).map((w: any) => ({
          weekday: w.weekday,
          startMinute: w.start_minute,
          endMinute: w.end_minute,
        })),
      };

      const vacancyInput = {
        id: "vac-test-id",
        version: 1,
        title: tc.input.vacancy.title,
        salaryAmount: tc.input.vacancy.salary_amount,
        salaryCurrency: tc.input.vacancy.salary_currency,
        salaryPeriod: tc.input.vacancy.salary_period,
        scheduleSummary: tc.input.vacancy.schedule_summary,
        scheduleWindows: (tc.input.vacancy.schedule_windows || []).map((w: any) => ({
          weekday: w.weekday,
          startMinute: w.start_minute,
          endMinute: w.end_minute,
        })),
        requirements: (tc.input.vacancy.requirements || []).map((r: any, idx: number) => ({
          id: `req-id-${idx}`,
          competencyId: `comp-id-${r.competency_code}`,
          competencyCode: r.competency_code,
          competencyName: r.competency_name,
          requirementType: r.requirement_type,
          stage: r.stage,
        })),
      };

      const result = evaluateC01Compatibility(candidateInput, vacancyInput, tc.input.assumptions);

      expect(result.status).toBe(tc.expected.status);
      expect(result.coverageNumerator).toBe(tc.expected.coverage_numerator);
      expect(result.coverageDenominator).toBe(tc.expected.coverage_denominator);
      expect(result.coveragePercent).toBe(tc.expected.coverage_percent);

      expect(result.breakdown.logistics.salary.status).toBe(tc.expected.logistics.salary_status);
      expect(result.breakdown.logistics.commute.status).toBe(tc.expected.logistics.commute_status);
      expect(result.breakdown.logistics.schedule.status).toBe(tc.expected.logistics.schedule_status);

      expect(result.essentialEntryGaps).toEqual(tc.expected.essential_entry_gaps);
      expect(result.trainableGaps).toEqual(tc.expected.trainable_gaps);
      expect(result.unknowns).toEqual(tc.expected.unknowns);
    });
  }

  describe("C01 Negative Tests reproducing D3 Audit Findings", () => {
    it("Finding 2: Absent skill remains DESCONOCIDO and PENDIENTE even when candidate has other claims", () => {
      const candidate = {
        id: "cand-1",
        revisionId: "rev-1",
        displayName: "Candidato Con Otra Habilidad",
        claims: [
          { competencyId: "comp-office", competencyCode: "COMP-OFFICE-01", decision: "ACCEPTED", hasEvidence: true },
        ],
        constraints: {
          salaryState: "KNOWN",
          minimumSalary: 600,
          salaryCurrency: "USD",
          salaryPeriod: "MONTH" as const,
          travelLimitState: "KNOWN",
          maxOneWayMinutes: 60,
          availabilityState: "KNOWN",
        },
        windows: [{ weekday: 1, startMinute: 480, endMinute: 1020 }],
      };

      const vacancy = {
        id: "vac-1",
        version: 1,
        title: "Vacante con requisito ausente",
        salaryAmount: 700,
        salaryCurrency: "USD",
        salaryPeriod: "MONTH" as const,
        scheduleWindows: [{ weekday: 1, startMinute: 480, endMinute: 1020 }],
        requirements: [
          {
            id: "req-fork",
            competencyId: "comp-fork",
            competencyCode: "COMP-FORK-02",
            competencyName: "Operador de montacargas",
            requirementType: "ESSENTIAL" as const,
            stage: "ENTRY" as const,
          },
        ],
      };

      const result = evaluateC01Compatibility(candidate, vacancy, { commute_minutes: 30 });
      // Absent skill MUST NOT be NO_CUMPLE or cause INVIABLE; must be DESCONOCIDO and PENDIENTE
      expect(result.status).toBe("PENDIENTE");
      expect(result.breakdown.requirements[0].status).toBe("DESCONOCIDO");
      expect(result.unknowns).toContain("COMP-FORK-02");
      expect(result.essentialEntryGaps).toHaveLength(0);
    });

    it("Finding 3: REJECTED claim with hasEvidence=false must NOT be accredited as CUMPLE; results in NO_CUMPLE and INVIABLE", () => {
      const candidate = {
        id: "cand-2",
        revisionId: "rev-2",
        claims: [
          { competencyId: "comp-fork", competencyCode: "COMP-FORK-02", decision: "REJECTED", hasEvidence: false },
        ],
        constraints: {
          salaryState: "KNOWN",
          minimumSalary: 600,
          salaryCurrency: "USD",
          salaryPeriod: "MONTH" as const,
          travelLimitState: "KNOWN",
          maxOneWayMinutes: 60,
          availabilityState: "KNOWN",
        },
        windows: [{ weekday: 1, startMinute: 480, endMinute: 1020 }],
      };

      const vacancy = {
        id: "vac-2",
        version: 1,
        title: "Vacante con requisito esencial",
        salaryAmount: 700,
        salaryCurrency: "USD",
        salaryPeriod: "MONTH" as const,
        scheduleWindows: [{ weekday: 1, startMinute: 480, endMinute: 1020 }],
        requirements: [
          {
            id: "req-fork",
            competencyId: "comp-fork",
            competencyCode: "COMP-FORK-02",
            competencyName: "Operador de montacargas",
            requirementType: "ESSENTIAL" as const,
            stage: "ENTRY" as const,
          },
        ],
      };

      const result = evaluateC01Compatibility(candidate, vacancy, { commute_minutes: 30 });
      expect(result.status).toBe("INVIABLE");
      expect(result.breakdown.requirements[0].status).toBe("NO_CUMPLE");
      expect(result.essentialEntryGaps).toContain("COMP-FORK-02");
    });

    it("Finding 3: PROPOSED claim or claim without evidence (hasEvidence=false) must remain DESCONOCIDO", () => {
      const candidate = {
        id: "cand-3",
        revisionId: "rev-3",
        claims: [
          { competencyId: "comp-fork", competencyCode: "COMP-FORK-02", decision: "PROPOSED", hasEvidence: false },
        ],
        constraints: {
          salaryState: "KNOWN",
          minimumSalary: 600,
          salaryCurrency: "USD",
          salaryPeriod: "MONTH" as const,
          travelLimitState: "KNOWN",
          maxOneWayMinutes: 60,
          availabilityState: "KNOWN",
        },
        windows: [{ weekday: 1, startMinute: 480, endMinute: 1020 }],
      };

      const vacancy = {
        id: "vac-3",
        version: 1,
        title: "Vacante con requisito esencial",
        salaryAmount: 700,
        salaryCurrency: "USD",
        salaryPeriod: "MONTH" as const,
        scheduleWindows: [{ weekday: 1, startMinute: 480, endMinute: 1020 }],
        requirements: [
          {
            id: "req-fork",
            competencyId: "comp-fork",
            competencyCode: "COMP-FORK-02",
            competencyName: "Operador de montacargas",
            requirementType: "ESSENTIAL" as const,
            stage: "ENTRY" as const,
          },
        ],
      };

      const result = evaluateC01Compatibility(candidate, vacancy, { commute_minutes: 30 });
      expect(result.status).toBe("PENDIENTE");
      expect(result.breakdown.requirements[0].status).toBe("DESCONOCIDO");
      expect(result.unknowns).toContain("COMP-FORK-02");
    });

    it("Finding 3: Catalog version mismatch must NOT accredit claim", () => {
      const candidate = {
        id: "cand-cat",
        revisionId: "rev-cat",
        claims: [
          {
            competencyId: "comp-1",
            competencyCode: "COMP-1",
            catalogVersionId: "cat-version-v1",
            decision: "ACCEPTED",
            hasEvidence: true,
          },
        ],
        constraints: {
          salaryState: "KNOWN",
          minimumSalary: 600,
          salaryCurrency: "USD",
          salaryPeriod: "MONTH" as const,
          travelLimitState: "KNOWN",
          maxOneWayMinutes: 60,
          availabilityState: "KNOWN",
        },
        windows: [{ weekday: 1, startMinute: 480, endMinute: 1020 }],
      };

      const vacancy = {
        id: "vac-cat",
        version: 1,
        title: "Vacante catálogo v2",
        salaryAmount: 700,
        salaryCurrency: "USD",
        salaryPeriod: "MONTH" as const,
        scheduleWindows: [{ weekday: 1, startMinute: 480, endMinute: 1020 }],
        requirements: [
          {
            id: "req-1",
            competencyId: "comp-1",
            competencyCode: "COMP-1",
            catalogVersionId: "cat-version-v2", // Different catalog version
            competencyName: "Competencia",
            requirementType: "ESSENTIAL" as const,
            stage: "ENTRY" as const,
          },
        ],
      };

      const result = evaluateC01Compatibility(candidate, vacancy, { commute_minutes: 30 });
      expect(result.breakdown.requirements[0].status).toBe("DESCONOCIDO");
      expect(result.status).toBe("PENDIENTE");
    });

    it("Finding 4: Candidate without constraints, windows or claims against vacancy without requirements must NOT return VIABLE", () => {
      const emptyCandidate = {
        id: "cand-empty",
        revisionId: "rev-empty",
        claims: [],
        constraints: null,
        windows: [],
      };

      const emptyVacancy = {
        id: "vac-empty",
        version: 1,
        title: "Vacante Básica",
        requirements: [],
      };

      const result = evaluateC01Compatibility(emptyCandidate, emptyVacancy);
      expect(result.status).not.toBe("VIABLE");
      expect(result.status).toBe("PENDIENTE");
      expect(result.unknowns.length).toBeGreaterThan(0);
    });
  });
});

