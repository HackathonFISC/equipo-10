import {createTrainingAssessmentsController} from "./training-assessments.controller";
import {TrainingAssessmentsService} from "./training-assessments.service";
export function createTrainingAssessmentsModule(service:TrainingAssessmentsService){return createTrainingAssessmentsController(service);}
