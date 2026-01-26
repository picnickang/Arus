/**
 * Event Publisher Adapter
 * Publishes domain events for scheduled reports
 */

import type { IEventPublisher } from '../domain/ports.js';
import type { ScheduledReportEvent } from '../domain/events.js';
import { logger } from '../../../utils/logger.js';

const LOG_CTX = 'ReportEventPublisher';

export class ReportEventPublisherAdapter implements IEventPublisher {
  async publish(event: ScheduledReportEvent): Promise<void> {
    logger.info(
      LOG_CTX,
      `Event: ${event.eventType}`,
      JSON.stringify({
        eventId: event.eventId,
        orgId: event.orgId,
        ...event.payload,
      })
    );
  }
}
