/**
 * Certificate Domain - Composed Service Instance
 * Wires infrastructure adapters into the application service
 */

import { CertificateApplicationService } from './application/certificate-service';
import {
  certificateRepository,
  certificateEventRepository,
} from './infrastructure/certificate-repository-adapter';

export const certificateService = new CertificateApplicationService(
  certificateRepository,
  certificateEventRepository
);
