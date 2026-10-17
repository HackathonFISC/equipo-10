import type { TrainingCertificatesService } from './training-certificates.service';
import { createTrainingCertificatesController } from './training-certificates.controller';
export function createTrainingCertificatesModule(service:TrainingCertificatesService){
  return createTrainingCertificatesController(service);
}
