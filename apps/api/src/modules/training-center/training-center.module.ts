import { createTrainingCenterController } from "./training-center.controller";
import { TrainingCenterService } from "./training-center.service";
export function createTrainingCenterModule(service:TrainingCenterService){return createTrainingCenterController(service);}
