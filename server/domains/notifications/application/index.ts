/**
 * Notifications Application Layer - Dependency Injection Composition Root
 */

import { NotificationsApplicationService } from "./notifications-service";
import { notificationRepository } from "../infrastructure/notification-repository-adapter";

export const notificationsAppService = new NotificationsApplicationService(notificationRepository);

export { NotificationsApplicationService } from "./notifications-service";
