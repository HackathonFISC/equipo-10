process.noDeprecation = true;

import { readConfig } from "./config";
import { Database } from "./infrastructure/database";
import { createVerifyToken } from "./security/auth";
import { IdentityService } from "./modules/identity/identity.service";
import { ProfileService } from "./modules/profile/profile.service";
import { OpportunitiesService } from "./modules/opportunities/opportunities.service";
import { CoursesService } from "./modules/courses/courses.service";
import { createPlanningModule } from "./modules/planning/planning.module";
import { createReservationsModule } from "./modules/reservations/reservations.module";
import { AgentA01Service } from "./modules/recruitment/agent-a01.service";
import { RecruitmentService } from "./modules/recruitment/recruitment.service";
import { ApplicationsService } from "./modules/recruitment/applications.service";
import { createApp } from "./app";
import { TrainingCenterService } from './modules/training-center/training-center.service';
import { TrainingParticipantsService } from './modules/training-participants/training-participants.service';
import { TrainingAssessmentsService } from './modules/training-assessments/training-assessments.service';
import { TrainingCertificatesService } from './modules/training-certificates/training-certificates.service';
import { OrientationService } from "./modules/orientation/orientation.service";

async function main() {
  let db: Database | null = null;
  try {
    const config = readConfig(process.env);
    db = new Database(config);
    const verifyToken = createVerifyToken(config);
    const identityService = new IdentityService(db);
    const profileService = new ProfileService(db);
    const opportunitiesService = new OpportunitiesService(db);
    const coursesService = new CoursesService(db);
    const planningModule = createPlanningModule(db);
    const reservationsModule = createReservationsModule(db);
    const a01Service = new AgentA01Service(db);
    const recruitmentService = new RecruitmentService(db, a01Service);
    const applicationsService = new ApplicationsService(db);
    const orientationService = new OrientationService(db);

    const app = createApp({
      trainingCenterService: new TrainingCenterService(db),
      trainingParticipantsService: new TrainingParticipantsService(db),
      trainingAssessmentsService: new TrainingAssessmentsService(db),
      trainingCertificatesService: new TrainingCertificatesService(db),
      identityService,
      profileService,
      opportunitiesService,
      coursesService,
      planningService: planningModule.service,
      reservationsService: reservationsModule.service,
      recruitmentService,
      applicationsService,
      orientationService,
      verifyToken,
      allowedOrigins: config.allowedOrigins,
    });

    const server = Bun.serve({
      port: config.port,
      hostname: config.host,
      maxRequestBodySize: 12 * 1024 * 1024,
      idleTimeout: 130, // A02 has a 120-second total provider deadline.
      fetch: app.fetch,
    });

    const shutdown = async () => {
      server.stop();
      if (db) {
        await db.close();
      }
      process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (err: unknown) {
    const className = (err as Error)?.name ?? "Error";
    const code = (err as { code?: string })?.code ?? "STARTUP_ERROR";
    console.error(`API startup failure: [${className}] ${code}`);
    if (db) {
      await db.close().catch(() => {});
    }
    process.exit(1);
  }
}

if (import.meta.main) {
  main();
}
