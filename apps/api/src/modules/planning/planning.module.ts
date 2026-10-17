import { PlanningService, type PlanningDatabase } from "./planning.service";
import { AgentA05Service, type AgentA05Runner } from "./agent-a05.service";
import { createPlanningController } from "./planning.controller";

export function createPlanningModule(
  db: PlanningDatabase,
  testRunner?: AgentA05Runner
) {
  const agentA05 = new AgentA05Service(db, testRunner);
  const service = new PlanningService(db, agentA05);
  const router = createPlanningController(service);

  return {
    service,
    agentA05,
    router,
  };
}
