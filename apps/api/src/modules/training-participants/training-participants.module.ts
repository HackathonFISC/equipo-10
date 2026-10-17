import { createTrainingParticipantsController } from './training-participants.controller';
import type { TrainingParticipantsService } from './training-participants.service';

export function createTrainingParticipantsModule(service: TrainingParticipantsService) {
  return createTrainingParticipantsController(service);
}
