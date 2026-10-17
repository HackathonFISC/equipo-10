import type {
  ComparisonFeasibility,
  RequirementEvaluationStatus,
  LogisticsBreakdown,
  RequirementComparisonItem,
  ComparisonBreakdown,
  OpportunityComparisonAssumptions,
  RequirementType,
  RequirementStage,
  MoneyPeriod,
} from "@equipo10/contracts";

export interface CandidateCompetencyClaimInput {
  competencyId: string;
  competencyCode?: string;
  catalogVersionId?: string;
  decision?: string;
  hasEvidence?: boolean;
}

export interface CandidateConstraintsInput {
  salaryState?: string;
  minimumSalary?: string | number | null;
  salaryCurrency?: string | null;
  salaryPeriod?: MoneyPeriod | null;
  travelLimitState?: string;
  maxOneWayMinutes?: number | null;
  availabilityState?: string;
}

export interface AvailabilityWindowInput {
  weekday: number;
  startMinute: number;
  endMinute: number;
}

export interface CandidateProfileInput {
  id: string;
  revisionId: string;
  displayName?: string | null;
  claims: CandidateCompetencyClaimInput[];
  constraints?: CandidateConstraintsInput | null;
  windows?: AvailabilityWindowInput[];
}

export interface VacancyRequirementInput {
  id: string;
  competencyId: string;
  competencyCode?: string;
  catalogVersionId?: string;
  competencyName: string;
  requirementType: RequirementType;
  stage: RequirementStage;
  description?: string;
}

export interface VacancyInput {
  id: string;
  version: number;
  title: string;
  salaryAmount?: string | number | null;
  salaryCurrency?: string | null;
  salaryPeriod?: MoneyPeriod | null;
  scheduleSummary?: string | null;
  scheduleWindows?: AvailabilityWindowInput[];
  requirements: VacancyRequirementInput[];
}

export interface C01MatchResult {
  status: ComparisonFeasibility;
  coverageNumerator: number;
  coverageDenominator: number;
  coveragePercent: number | null;
  breakdown: ComparisonBreakdown;
  reasons: string[];
  essentialEntryGaps: string[];
  trainableGaps: string[];
  unknowns: string[];
}

/**
 * Parsea un texto de resumen de horario en ventanas estructuradas por día.
 * Devuelve null si no puede estructurarse inequívocamente.
 */
export function parseScheduleSummaryToWindows(summary?: string | null): AvailabilityWindowInput[] | null {
  if (!summary || typeof summary !== "string") return null;
  const clean = summary.trim();
  if (clean.length === 0) return null;

  // Extraer horas: ej. "08:00 - 17:00", "8:00 a 17:00", "08:00 to 17:00", "8:00 - 16:30"
  const timeMatch = clean.match(/(\d{1,2}):(\d{2})\s*(?:-|a|to|–)\s*(\d{1,2}):(\d{2})/i);
  if (!timeMatch) return null;

  const h1 = parseInt(timeMatch[1], 10);
  const m1 = parseInt(timeMatch[2], 10);
  const h2 = parseInt(timeMatch[3], 10);
  const m2 = parseInt(timeMatch[4], 10);

  if (isNaN(h1) || isNaN(m1) || isNaN(h2) || isNaN(m2)) return null;
  const startMinute = h1 * 60 + m1;
  const endMinute = h2 * 60 + m2;
  if (startMinute >= endMinute) return null;

  // Extraer rangos de días de la semana
  const lower = clean.toLowerCase();
  let days: number[] = [];

  if (/lunes\s+a\s+viernes/i.test(lower)) {
    days = [1, 2, 3, 4, 5];
  } else if (/lunes\s+a\s+s[aá]bado/i.test(lower)) {
    days = [1, 2, 3, 4, 5, 6];
  } else if (/lunes\s+a\s+domingo/i.test(lower)) {
    days = [1, 2, 3, 4, 5, 6, 7];
  } else {
    // Días individuales
    if (/lunes/i.test(lower)) days.push(1);
    if (/martes/i.test(lower)) days.push(2);
    if (/mi[eé]rcoles/i.test(lower)) days.push(3);
    if (/jueves/i.test(lower)) days.push(4);
    if (/viernes/i.test(lower)) days.push(5);
    if (/s[aá]bado/i.test(lower)) days.push(6);
    if (/domingo/i.test(lower)) days.push(7);
  }

  if (days.length === 0) return null;

  return days.map((weekday) => ({
    weekday,
    startMinute,
    endMinute,
  }));
}

export function evaluateC01Compatibility(
  candidate: CandidateProfileInput,
  vacancy: VacancyInput,
  assumptions?: OpportunityComparisonAssumptions | null
): C01MatchResult {
  const reasons: string[] = [];
  const unknowns: string[] = [];
  const essentialEntryGaps: string[] = [];
  const trainableGaps: string[] = [];

  let hasHardViolation = false;
  let hasPendingUnknown = false;

  // 1. Evaluación Logística: Salario
  let salaryStatus: RequirementEvaluationStatus = "CUMPLE";
  let salaryReason = "Sin requisitos salariales conflictivos.";
  const candidateMinSalary = candidate.constraints?.minimumSalary != null
    ? Number(candidate.constraints.minimumSalary).toFixed(2)
    : null;
  const vacancyOfferedSalary = vacancy.salaryAmount != null
    ? Number(vacancy.salaryAmount).toFixed(2)
    : null;

  if (!candidate.constraints || candidate.constraints.salaryState !== "KNOWN") {
    salaryStatus = "DESCONOCIDO";
    salaryReason = "El candidato no tiene restricciones salariales confirmadas.";
    unknowns.push("logistics.salary_unknown");
    hasPendingUnknown = true;
  } else {
    if (!vacancyOfferedSalary || !vacancy.salaryCurrency || !vacancy.salaryPeriod) {
      salaryStatus = "DESCONOCIDO";
      salaryReason = "La vacante no especifica salario, moneda o periodo.";
      unknowns.push("logistics.salary_unknown");
      hasPendingUnknown = true;
    } else if (
      candidate.constraints.salaryCurrency !== vacancy.salaryCurrency ||
      candidate.constraints.salaryPeriod !== vacancy.salaryPeriod
    ) {
      salaryStatus = "DESCONOCIDO";
      salaryReason = `Moneda o periodo incomparables (${vacancy.salaryCurrency}/${vacancy.salaryPeriod} vs ${candidate.constraints.salaryCurrency}/${candidate.constraints.salaryPeriod}). No se realizan conversiones automáticas.`;
      unknowns.push("logistics.salary_period_incomparable");
      hasPendingUnknown = true;
    } else {
      const offered = Number(vacancyOfferedSalary);
      const minimum = Number(candidateMinSalary);
      if (offered >= minimum) {
        salaryStatus = "CUMPLE";
        salaryReason = `El salario ofrecido (${vacancyOfferedSalary} ${vacancy.salaryCurrency}/${vacancy.salaryPeriod}) cubre o supera la expectativa mínima (${candidateMinSalary} ${candidate.constraints.salaryCurrency}/${candidate.constraints.salaryPeriod}).`;
      } else {
        salaryStatus = "NO_CUMPLE";
        salaryReason = `El salario ofrecido (${vacancyOfferedSalary} ${vacancy.salaryCurrency}/${vacancy.salaryPeriod}) es inferior a la expectativa mínima del candidato (${candidateMinSalary} ${candidate.constraints.salaryCurrency}/${candidate.constraints.salaryPeriod}).`;
        hasHardViolation = true;
        reasons.push("Salario ofrecido inferior a la expectativa mínima confirmada.");
      }
    }
  }

  // 2. Evaluación Logística: Traslado (Commute)
  let commuteStatus: RequirementEvaluationStatus = "CUMPLE";
  let commuteReason = "Traslado compatible o sin límite estricto declarado.";
  const candidateMaxMinutes = candidate.constraints?.maxOneWayMinutes ?? null;
  const assumedMinutes = assumptions?.commute_minutes ?? null;

  if (!candidate.constraints || candidate.constraints.travelLimitState !== "KNOWN") {
    commuteStatus = "DESCONOCIDO";
    commuteReason = "El candidato no tiene límite de traslado confirmado.";
    unknowns.push("logistics.commute_limit_unknown");
    hasPendingUnknown = true;
  } else {
    if (assumedMinutes === null) {
      commuteStatus = "DESCONOCIDO";
      commuteReason = "Tiempo de traslado no estimado en supuestos.";
      unknowns.push("logistics.commute_minutes_unknown");
      hasPendingUnknown = true;
    } else if (candidateMaxMinutes !== null && assumedMinutes > candidateMaxMinutes) {
      commuteStatus = "NO_CUMPLE";
      commuteReason = `El trayecto estimado (${assumedMinutes} min) excede el límite máximo de traslado confirmado por el candidato (${candidateMaxMinutes} min).`;
      hasHardViolation = true;
      reasons.push("Tiempo de traslado excesivo respecto al límite confirmado.");
    } else {
      commuteStatus = "CUMPLE";
      commuteReason = `El trayecto estimado (${assumedMinutes} min) está dentro del límite máximo confirmado (${candidateMaxMinutes} min).`;
    }
  }

  // 3. Evaluación Logística: Horario / Disponibilidad
  let scheduleStatus: RequirementEvaluationStatus = "CUMPLE";
  let scheduleReason = "Jornada compatible con la disponibilidad del candidato.";

  // Determinar ventanas efectivas requeridas por la vacante
  const effectiveVacancyWindows =
    vacancy.scheduleWindows && vacancy.scheduleWindows.length > 0
      ? vacancy.scheduleWindows
      : parseScheduleSummaryToWindows(vacancy.scheduleSummary);

  if (effectiveVacancyWindows && effectiveVacancyWindows.length > 0) {
    if (
      !candidate.constraints ||
      candidate.constraints.availabilityState !== "KNOWN" ||
      !candidate.windows ||
      candidate.windows.length === 0
    ) {
      scheduleStatus = "DESCONOCIDO";
      scheduleReason = "El candidato no tiene ventanas de disponibilidad horaria confirmadas.";
      unknowns.push("availability.windows_unknown");
      hasPendingUnknown = true;
    } else {
      // Verificar si cada ventana requerida por la vacante está contenida en al menos una ventana del candidato
      let allWindowsFit = true;
      for (const reqWin of effectiveVacancyWindows) {
        const fits = candidate.windows.some(
          (candWin) =>
            candWin.weekday === reqWin.weekday &&
            candWin.startMinute <= reqWin.startMinute &&
            candWin.endMinute >= reqWin.endMinute
        );
        if (!fits) {
          allWindowsFit = false;
          break;
        }
      }

      if (allWindowsFit) {
        scheduleStatus = "CUMPLE";
        scheduleReason = "El horario laboral coincide con las ventanas de disponibilidad confirmadas.";
      } else {
        scheduleStatus = "NO_CUMPLE";
        scheduleReason = "El horario laboral requerido colisiona con las ventanas de disponibilidad del candidato.";
        hasHardViolation = true;
        reasons.push("Conflicto entre la jornada laboral y la disponibilidad horaria confirmada.");
      }
    }
  } else if (vacancy.scheduleSummary) {
    // La vacante declara un horario que no pudo ser estructurado
    scheduleStatus = "DESCONOCIDO";
    scheduleReason = `El horario de la vacante ("${vacancy.scheduleSummary}") no cuenta con ventanas estructuradas para validar la compatibilidad.`;
    unknowns.push("availability.schedule_unstructured");
    hasPendingUnknown = true;
  } else {
    // Vacante sin horario explícito requerido
    if (!candidate.constraints || candidate.constraints.availabilityState !== "KNOWN") {
      scheduleStatus = "DESCONOCIDO";
      scheduleReason = "El candidato no tiene disponibilidad horaria confirmada.";
      unknowns.push("availability.schedule_unknown");
      hasPendingUnknown = true;
    } else {
      scheduleStatus = "CUMPLE";
      scheduleReason = "Sin restricciones horarias requeridas por la vacante.";
    }
  }

  const logistics: LogisticsBreakdown = {
    salary: {
      status: salaryStatus,
      candidate_minimum: candidateMinSalary,
      opportunity_offered: vacancyOfferedSalary,
      currency: vacancy.salaryCurrency ?? null,
      period: vacancy.salaryPeriod ?? null,
      reason: salaryReason,
    },
    commute: {
      status: commuteStatus,
      candidate_max_minutes: candidateMaxMinutes,
      assumed_minutes: assumedMinutes,
      reason: commuteReason,
    },
    schedule: {
      status: scheduleStatus,
      reason: scheduleReason,
    },
  };

  // 4. Evaluación de Requisitos de Competencias
  const requirementItems: RequirementComparisonItem[] = [];
  let coverageNumerator = 0;
  let coverageDenominator = 0;

  const candidateClaims = candidate.claims || [];

  for (const req of vacancy.requirements) {
    const claim = candidateClaims.find((c) => {
      // Respetar catálogo / versiones si están especificados
      if (req.catalogVersionId && c.catalogVersionId && req.catalogVersionId !== c.catalogVersionId) {
        return false;
      }
      return (
        c.competencyId === req.competencyId ||
        (c.competencyCode && req.competencyCode && c.competencyCode === req.competencyCode)
      );
    });

    let status: RequirementEvaluationStatus = "DESCONOCIDO";
    let evidenceReason = "";

    if (claim) {
      if (claim.decision === "REJECTED") {
        // Evaluación negativa expresa -> NO_CUMPLE
        status = "NO_CUMPLE";
        coverageDenominator++;

        if (req.requirementType === "ESSENTIAL" && req.stage === "ENTRY") {
          evidenceReason = `Requisito esencial de entrada evaluado negativamente o rechazado en el perfil (${req.competencyName}).`;
          essentialEntryGaps.push(req.competencyCode || req.competencyId);
          hasHardViolation = true;
          reasons.push(`Requisito esencial no cumplido: ${req.competencyName}.`);
        } else if (req.stage === "TRAINABLE") {
          evidenceReason = `Requisito no acreditado previamente; puede ser entrenado o capacitado en el puesto (${req.competencyName}).`;
          trainableGaps.push(req.competencyCode || req.competencyId);
        } else {
          evidenceReason = `Requisito deseable evaluado negativamente (${req.competencyName}).`;
        }
      } else if ((claim.decision === "ACCEPTED" || claim.decision === undefined) && claim.hasEvidence === true) {
        // Demostrado y acreditado con evidencia suficiente
        status = "CUMPLE";
        evidenceReason = `Competencia acreditada en el perfil confirmado (${req.competencyName}).`;
        coverageNumerator++;
        coverageDenominator++;
      } else {
        // Declarado o propuesto pero sin evidencia verificada -> DESCONOCIDO
        status = "DESCONOCIDO";
        evidenceReason = `Competencia declarada pero sin evidencia suficiente para acreditarla (${req.competencyName}).`;
        unknowns.push(req.competencyCode || req.competencyId);
        if (req.requirementType === "ESSENTIAL" && req.stage === "ENTRY") {
          hasPendingUnknown = true;
        }
      }
    } else {
      // Requisito ausente en el perfil del candidato
      if (req.stage === "TRAINABLE") {
        // Los requisitos entrenables no adquiridos se identifican como brechas entrenables, no violación de entrada
        status = "NO_CUMPLE";
        coverageDenominator++;
        evidenceReason = `Requisito no acreditado previamente; puede ser entrenado o capacitado en el puesto (${req.competencyName}).`;
        trainableGaps.push(req.competencyCode || req.competencyId);
      } else {
        // Habilidad ausente: la ausencia de evidencia permanece DESCONOCIDA sin evaluación negativa expresa
        status = "DESCONOCIDO";
        evidenceReason = `Falta información sobre esta competencia en el perfil confirmado (${req.competencyName}).`;
        unknowns.push(req.competencyCode || req.competencyId);
        if (req.requirementType === "ESSENTIAL" && req.stage === "ENTRY") {
          hasPendingUnknown = true;
        }
      }
    }

    requirementItems.push({
      requirement_id: req.id,
      competency_id: req.competencyId,
      competency_name: req.competencyName,
      requirement_type: req.requirementType,
      stage: req.stage,
      status,
      evidence_reason: evidenceReason,
    });
  }

  // 5. Cálculo de Cobertura
  let coveragePercent: number | null = null;
  if (coverageDenominator > 0) {
    coveragePercent = Number(((coverageNumerator / coverageDenominator) * 100).toFixed(1));
  }

  // 6. Determinación de Factibilidad Final
  let status: ComparisonFeasibility = "VIABLE";
  if (hasHardViolation) {
    status = "INVIABLE";
  } else if (hasPendingUnknown) {
    status = "PENDIENTE";
  } else {
    status = "VIABLE";
    if (reasons.length === 0) {
      reasons.push("Cumple con los requisitos esenciales de entrada.");
      reasons.push("Condiciones de salario, traslado y horario compatibles.");
    }
  }

  return {
    status,
    coverageNumerator,
    coverageDenominator,
    coveragePercent,
    breakdown: {
      logistics,
      requirements: requirementItems,
    },
    reasons,
    essentialEntryGaps,
    trainableGaps,
    unknowns,
  };
}
