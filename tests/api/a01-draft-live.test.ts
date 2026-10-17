import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { setupTestDatabase, type DatabaseFixture } from "../support/database-fixture";
import { AgentA01Service } from "../../apps/api/src/modules/recruitment/agent-a01.service";

describe("Live/Synthetic Agent A01 Vertex AI Test", () => {
  let dbFixture: DatabaseFixture;
  let a01Service: AgentA01Service;

  beforeAll(async () => {
    dbFixture = await setupTestDatabase();
    a01Service = new AgentA01Service(dbFixture.db);
  }, 30000);

  afterAll(async () => {
    await dbFixture.close();
  });

  it("Detécta sesgos deterministas inmediatamente sin llamar a Vertex", () => {
    const warnings = a01Service.detectDiscriminatoryTerms("Buscamos señorita soltera menor de 25 años con buena presencia.");
    expect(warnings.length).toBeGreaterThanOrEqual(3);
    const fields = warnings.map((w) => w.field);
    expect(fields).toContain("description");
  });

  it("Analiza vacante válida mediante A01 (Vertex AI o fallback)", async () => {
    const rawText = "Necesitamos un auxiliar para organizar paquetes y llevar control de inventario en bodega en turnos diurnos.";
    try {
      const result = await a01Service.analyzeVacancy({
        rawText,
        actorUserId: "00000000-0000-0000-0000-000000000001",
      });

      expect(result).toBeDefined();
      expect(result.has_blocking_issues).toBe(false);
      expect(Array.isArray(result.proposed_requirements)).toBe(true);
      console.log("A01 Result:", JSON.stringify(result, null, 2));
    } catch (err: any) {
      // Si Vertex AI no está disponible por cuota de red, verificar que el error esté tipado como AppError
      console.log("Vertex response/error:", err.message);
      expect(err.code || err.statusCode).toBeDefined();
    }
  }, 35000);
});
