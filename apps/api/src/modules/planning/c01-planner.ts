import type {
  PlanFeasibility,
  PlanStepType,
} from "@equipo10/contracts";

export interface CandidateSkillClaim {
  competencyId: string;
  competencyCode?: string;
  decision?: string;
  hasEvidence?: boolean;
}

export interface WeeklyTimeSlot {
  weekday: number; // 1 = Lunes, 7 = Domingo
  startMinute: number;
  endMinute: number;
}

export interface CandidatePlannerProfile {
  id: string;
  profileId: string;
  revisionId: string;
  claims: CandidateSkillClaim[];
  trainingBudget?: number | null;
  transportBudget?: number | null;
  availabilityWindows?: WeeklyTimeSlot[];
  activeReservations?: {
    editionId: string;
    startDate: Date;
    endDate: Date;
    sessions: WeeklyTimeSlot[];
  }[];
}

export interface TargetRequirement {
  id: string;
  competencyId: string;
  competencyName: string;
  competencyCode?: string;
  essential: boolean;
}

export interface PlannerEditionSession extends WeeklyTimeSlot {
  timezone?: string;
  location?: string | null;
}

export interface PlannerCourseEdition {
  id: string;
  courseId: string;
  courseTitle: string;
  code: string;
  startDate: Date;
  endDate: Date;
  totalSlots: number;
  availableSlots: number;
  costAmount: number;
  costCurrency: string;
  costPeriod?: string | null;
  scheduleSummary: string;
  sessions: PlannerEditionSession[];
  learningOutcomes: {
    competencyId: string;
    competencyName?: string;
  }[];
  prerequisites: {
    competencyId: string;
    competencyName?: string;
    essential: boolean;
  }[];
}

export interface PlannerStepResult {
  stepOrder: number;
  editionId: string;
  courseTitle: string;
  stepType: PlanStepType;
  conditionalPrerequisiteDescription?: string | null;
  scheduleSummary: string;
  costAmount: string;
  currency: string;
  startDate: string;
  endDate: string;
}

export interface C01PlanningResult {
  feasibility: PlanFeasibility;
  coverageNumerator: number;
  coverageDenominator: number;
  totalCostAmount: string;
  currency: string;
  residualGap: string[];
  reasons: string[];
  steps: PlannerStepResult[];
  calculationTrace: Record<string, any>;
}

export interface PlannerAssumptions {
  commuteMinutes?: number;
  maxBudgetAmount?: number;
  horizonDays?: number;
}

/**
 * Comprueba si dos rangos de fechas se solapan en el calendario.
 */
function datesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

/**
 * Comprueba si dos sesiones semanales chocan (mismo día de semana y franja horaria que se cruza con traslado).
 */
function sessionsCollide(s1: WeeklyTimeSlot, s2: WeeklyTimeSlot, commuteMinutes = 0): boolean {
  if (s1.weekday !== s2.weekday) return false;
  const start1 = Math.max(0, s1.startMinute - commuteMinutes);
  const end1 = Math.min(1440, s1.endMinute + commuteMinutes);
  const start2 = s2.startMinute;
  const end2 = s2.endMinute;
  return start1 < end2 && start2 < end1;
}

/**
 * Verifica si una sesión semanal cabe en las ventanas de disponibilidad del candidato.
 */
function sessionFitsAvailability(session: WeeklyTimeSlot, windows: WeeklyTimeSlot[], commuteMinutes = 0): boolean {
  if (!windows || windows.length === 0) return true; // Sin restricciones declaradas
  const requiredStart = Math.max(0, session.startMinute - commuteMinutes);
  const requiredEnd = Math.min(1440, session.endMinute + commuteMinutes);

  return windows.some(
    (w) => w.weekday === session.weekday && w.startMinute <= requiredStart && w.endMinute >= requiredEnd
  );
}

/**
 * Planificador combinatorio C01 de rutas formativas.
 * Cumple con RGN01-RGN14 y las restricciones fijadas en CONTRATOS_D4.
 */
export function calculateLearningRouteC01(
  candidate: CandidatePlannerProfile,
  targetRequirements: TargetRequirement[],
  availableEditions: PlannerCourseEdition[],
  assumptions: PlannerAssumptions = {}
): C01PlanningResult {
  const commuteMinutes = assumptions.commuteMinutes ?? 0;
  const maxBudget = assumptions.maxBudgetAmount ?? candidate.trainingBudget ?? null;

  // 1. Identificar brecha de competencias (competencias no demostradas con evidencia y aceptadas)
  const demonstratedCompetencies = new Set<string>();
  for (const claim of candidate.claims) {
    if (claim.decision === "ACCEPTED" && claim.hasEvidence === true) {
      demonstratedCompetencies.add(claim.competencyId);
    }
  }

  const gapRequirements = targetRequirements.filter(
    (req) => !demonstratedCompetencies.has(req.competencyId)
  );

  const coverageDenominator = targetRequirements.length > 0 ? targetRequirements.length : 1;

  // Si no hay brecha, el candidato ya cubre todos los requisitos
  if (gapRequirements.length === 0 && targetRequirements.length > 0) {
    return {
      feasibility: "VIABLE",
      coverageNumerator: coverageDenominator,
      coverageDenominator,
      totalCostAmount: "0.00",
      currency: "USD",
      residualGap: [],
      reasons: [
        "El perfil confirmado del candidato ya cuenta con todas las competencias requeridas demostradas.",
        "No se requieren cursos adicionales para esta meta.",
      ],
      steps: [],
      calculationTrace: {
        allRequirementsMet: true,
        gapCount: 0,
        candidateDemonstratedCount: demonstratedCompetencies.size,
      },
    };
  }

  // 2. Control de límite del catálogo acotado (máximo 12 ediciones)
  if (availableEditions.length > 12) {
    return {
      feasibility: "PENDING",
      coverageNumerator: 0,
      coverageDenominator,
      totalCostAmount: "0.00",
      currency: "USD",
      residualGap: gapRequirements.map((g) => g.competencyName),
      reasons: [
        `El conjunto de convocatorias disponibles (${availableEditions.length}) supera el límite de cálculo del catálogo (12 ediciones).`,
        "Por favor aplica filtros de búsqueda por modalidad o fecha para acotar el cálculo combinatorio.",
      ],
      steps: [],
      calculationTrace: {
        error: "POOL_EXCEEDS_LIMIT",
        editionsCount: availableEditions.length,
      },
    };
  }

  // Filtrar ediciones con cupo y vigentes
  const viablePool = availableEditions.filter((ed) => ed.availableSlots > 0);

  if (viablePool.length === 0) {
    return {
      feasibility: "INVIABLE",
      coverageNumerator: 0,
      coverageDenominator,
      totalCostAmount: "0.00",
      currency: "USD",
      residualGap: gapRequirements.map((g) => g.competencyName),
      reasons: [
        "No se encontraron ediciones con plazas disponibles en el horizonte de búsqueda de 30 días.",
      ],
      steps: [],
      calculationTrace: {
        viableEditionsCount: 0,
      },
    };
  }

  // 3. Generar combinaciones de 1, 2 y 3 ediciones
  const combinations: PlannerCourseEdition[][] = [];

  // Tamaño 1
  for (let i = 0; i < viablePool.length; i++) {
    combinations.push([viablePool[i]]);
  }

  // Tamaño 2
  for (let i = 0; i < viablePool.length; i++) {
    for (let j = i + 1; j < viablePool.length; j++) {
      combinations.push([viablePool[i], viablePool[j]]);
    }
  }

  // Tamaño 3
  for (let i = 0; i < viablePool.length; i++) {
    for (let j = i + 1; j < viablePool.length; j++) {
      for (let k = j + 1; k < viablePool.length; k++) {
        combinations.push([viablePool[i], viablePool[j], viablePool[k]]);
      }
    }
  }

  // 4. Evaluar cada combinación
  interface EvaluatedRoute {
    editions: PlannerCourseEdition[];
    steps: PlannerStepResult[];
    feasibility: PlanFeasibility;
    coveredCount: number;
    totalCost: number;
    currency: string;
    durationDays: number;
    reasons: string[];
    residualGap: string[];
    isPendingCost: boolean;
  }

  const evaluatedRoutes: EvaluatedRoute[] = [];
  let budgetExceededCount = 0;

  for (const combo of combinations) {
    // Ordenar ediciones cronológicamente por startDate
    const sorted = [...combo].sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

    // A. Verificar solapamiento interno entre ediciones de la combinación
    let internalConflict = false;
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        if (datesOverlap(sorted[i].startDate, sorted[i].endDate, sorted[j].startDate, sorted[j].endDate)) {
          for (const s1 of sorted[i].sessions) {
            for (const s2 of sorted[j].sessions) {
              if (sessionsCollide(s1, s2, commuteMinutes)) {
                internalConflict = true;
                break;
              }
            }
            if (internalConflict) break;
          }
        }
        if (internalConflict) break;
      }
      if (internalConflict) break;
    }

    if (internalConflict) {
      continue; // Descartar combinación que choca internamente
    }

    // B. Verificar colisión con reservas existentes activas del candidato
    let reservationCollision = false;
    if (candidate.activeReservations && candidate.activeReservations.length > 0) {
      for (const ed of sorted) {
        for (const res of candidate.activeReservations) {
          if (datesOverlap(ed.startDate, ed.endDate, res.startDate, res.endDate)) {
            for (const s1 of ed.sessions) {
              for (const s2 of res.sessions) {
                if (sessionsCollide(s1, s2, commuteMinutes)) {
                  reservationCollision = true;
                  break;
                }
              }
              if (reservationCollision) break;
            }
          }
          if (reservationCollision) break;
        }
        if (reservationCollision) break;
      }
    }

    if (reservationCollision) {
      continue; // Descartar combinación incompatible con agenda confirmada
    }

    // C. Verificar compatibilidad con disponibilidad del candidato
    let availabilityConflict = false;
    if (candidate.availabilityWindows && candidate.availabilityWindows.length > 0) {
      for (const ed of sorted) {
        for (const session of ed.sessions) {
          if (!sessionFitsAvailability(session, candidate.availabilityWindows, commuteMinutes)) {
            availabilityConflict = true;
            break;
          }
        }
        if (availabilityConflict) break;
      }
    }

    if (availabilityConflict) {
      continue; // Descartar combinación que choca con disponibilidad semanal
    }

    // D. Evaluar prerrequisitos y precedencias secuenciales
    const acquiredSkillsSoFar = new Set<string>(demonstratedCompetencies);
    let routeFeasibility: PlanFeasibility = "VIABLE";
    const routeReasons: string[] = [];
    const steps: PlannerStepResult[] = [];
    let hasUnmetMandatory = false;

    for (let idx = 0; idx < sorted.length; idx++) {
      const ed = sorted[idx];
      let stepType: PlanStepType = "DIRECT";
      let condPrereqDesc: string | null = null;

      for (const prereq of ed.prerequisites) {
        if (!acquiredSkillsSoFar.has(prereq.competencyId)) {
          if (prereq.essential) {
            // Prerrequisito esencial no cumplido en este punto
            hasUnmetMandatory = true;
            routeFeasibility = "INVIABLE";
            routeReasons.push(
              `La edición ${ed.code} requiere la competencia previa obligatoria "${prereq.competencyName || prereq.competencyId}" que aún no está acreditada.`
            );
          } else {
            // Prerrequisito recomendado / no esencial
            if (routeFeasibility === "VIABLE") {
              routeFeasibility = "CONDITIONAL";
            }
            condPrereqDesc = `Requiere afianzar prerrequisito recomendado: ${prereq.competencyName || prereq.competencyId}`;
          }
        } else {
          // Si fue adquirido gracias a una edición anterior del plan, este paso es CONDITIONAL
          if (!demonstratedCompetencies.has(prereq.competencyId)) {
            stepType = "CONDITIONAL";
            if (routeFeasibility === "VIABLE") {
              routeFeasibility = "CONDITIONAL";
            }
            condPrereqDesc = `Condicionado a completar previamente el resultado formativo: ${prereq.competencyName || prereq.competencyId}`;
          }
        }
      }

      // Añadir aprendizajes de este curso al acumulador de la ruta
      for (const outcome of ed.learningOutcomes) {
        acquiredSkillsSoFar.add(outcome.competencyId);
      }

      steps.push({
        stepOrder: idx + 1,
        editionId: ed.id,
        courseTitle: ed.courseTitle,
        stepType,
        conditionalPrerequisiteDescription: condPrereqDesc,
        scheduleSummary: ed.scheduleSummary,
        costAmount: ed.costAmount.toFixed(2),
        currency: ed.costCurrency || "USD",
        startDate: ed.startDate.toISOString().split("T")[0],
        endDate: ed.endDate.toISOString().split("T")[0],
      });
    }

    if (hasUnmetMandatory) {
      continue; // Descartar combinación inviable por prerrequisito obligatorio no salvable
    }

    // E. Calcular costos y presupuestos
    let totalCost = 0;
    let isPendingCost = false;
    const currency = sorted[0]?.costCurrency || "USD";

    for (const ed of sorted) {
      if (ed.costCurrency && ed.costCurrency !== currency) {
        isPendingCost = true;
      }
      totalCost += ed.costAmount;
    }

    if (isPendingCost) {
      routeFeasibility = "PENDING";
      routeReasons.push("Existen cursos con monedas no comparables directamente; revisión de aranceles pendiente.");
    } else if (maxBudget !== null && totalCost > maxBudget) {
      budgetExceededCount++;
      continue; // Descarte inmediato: presupuesto superado
    }

    // F. Calcular cobertura de la brecha
    const coveredGap = gapRequirements.filter((g) => acquiredSkillsSoFar.has(g.competencyId));
    const residualGap = gapRequirements
      .filter((g) => !acquiredSkillsSoFar.has(g.competencyId))
      .map((g) => g.competencyName);

    const earliestStart = sorted[0].startDate;
    const latestEnd = sorted[sorted.length - 1].endDate;
    const durationDays = Math.max(1, Math.round((latestEnd.getTime() - earliestStart.getTime()) / (1000 * 60 * 60 * 24)));

    const missingLogistics: string[] = [];
    if (!candidate.availabilityWindows?.length) {
      missingLogistics.push("Falta confirmar tu disponibilidad semanal.");
    }
    if (assumptions.commuteMinutes === undefined) {
      missingLogistics.push("Falta confirmar el tiempo de traslado; no se presupone que sea cero.");
    }
    if (sorted.some((ed) => ed.sessions.length === 0)) {
      missingLogistics.push("Falta confirmar el horario de las sesiones del curso.");
    }
    if (missingLogistics.length > 0) {
      routeFeasibility = "PENDING";
      routeReasons.push(...missingLogistics);
    }

    if (routeFeasibility === "VIABLE") {
      if (residualGap.length === 0) {
        routeReasons.push("El plan cubre el 100% de las competencias requeridas pendientes.");
      } else {
        routeReasons.push(
          `El plan cubre ${coveredGap.length} de ${gapRequirements.length} brechas de competencias identificadas.`
        );
      }
      routeReasons.push("Horarios plenamente compatibles con tu disponibilidad semanal y traslados.");
      routeReasons.push(`Costo total ($${totalCost.toFixed(2)} ${currency}) dentro de los parámetros evaluados.`);
    }

    evaluatedRoutes.push({
      editions: sorted,
      steps,
      feasibility: routeFeasibility,
      coveredCount: coveredGap.length,
      totalCost,
      currency,
      durationDays,
      reasons: routeReasons,
      residualGap,
      isPendingCost,
    });
  }

  // 5. Ranking de rutas según criterios C01
  // Prioridades:
  // 1. Mayor cobertura de brechas (coveredCount descendente)
  // 2. Viabilidad (VIABLE > CONDITIONAL > PENDING > INVIABLE)
  // 3. Menor costo total
  // 4. Menor duración en días
  // 5. Desempate estable por IDs concatenados
  const feasibilityWeight: Record<PlanFeasibility, number> = {
    VIABLE: 4,
    CONDITIONAL: 3,
    PENDING: 2,
    INVIABLE: 1,
  };

  evaluatedRoutes.sort((a, b) => {
    // 1. Cobertura de brechas
    if (b.coveredCount !== a.coveredCount) {
      return b.coveredCount - a.coveredCount;
    }
    // 2. Viabilidad
    const weightA = feasibilityWeight[a.feasibility];
    const weightB = feasibilityWeight[b.feasibility];
    if (weightA !== weightB) {
      return weightB - weightA;
    }
    // 3. Costo
    if (a.totalCost !== b.totalCost) {
      return a.totalCost - b.totalCost;
    }
    // 4. Duración
    if (a.durationDays !== b.durationDays) {
      return a.durationDays - b.durationDays;
    }
    // 5. Desempate alfabético estable
    const keyA = a.editions.map((e) => e.id).join("_");
    const keyB = b.editions.map((e) => e.id).join("_");
    return keyA.localeCompare(keyB);
  });

  const bestRoute = evaluatedRoutes[0];

  if (!bestRoute || bestRoute.coveredCount === 0) {
    const reasons: string[] = [];
    if (budgetExceededCount > 0) {
      reasons.push("El costo de las convocatorias disponibles supera tu presupuesto declarado para capacitación.");
    } else {
      reasons.push(
        "Ninguna de las convocatorias disponibles permite cerrar las competencias pendientes sin conflicto de horario, traslados o restricciones de presupuesto."
      );
    }

    return {
      feasibility: "INVIABLE",
      coverageNumerator: 0,
      coverageDenominator,
      totalCostAmount: "0.00",
      currency: "USD",
      residualGap: gapRequirements.map((g) => g.competencyName),
      reasons,
      steps: [],
      calculationTrace: {
        evaluatedCount: evaluatedRoutes.length,
        budgetExceededCount,
        noMatchingCoverages: true,
      },
    };
  }

  const finalCoverageNumerator = targetRequirements.length - bestRoute.residualGap.length;

  return {
    feasibility: bestRoute.feasibility,
    coverageNumerator: Math.max(0, finalCoverageNumerator),
    coverageDenominator,
    totalCostAmount: bestRoute.totalCost.toFixed(2),
    currency: bestRoute.currency,
    residualGap: bestRoute.residualGap,
    reasons: bestRoute.reasons,
    steps: bestRoute.steps,
    calculationTrace: {
      evaluatedCombinationsCount: evaluatedRoutes.length,
      bestRouteEditions: bestRoute.editions.map((e) => e.id),
      durationDays: bestRoute.durationDays,
      isOptimalInSample: true,
    },
  };
}
