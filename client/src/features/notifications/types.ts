export interface InAppNotification {
  id: string;
  groupId: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  entityType: string | null;
  entityId: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationPreferences {
  activityReminders: boolean;
  familyEscalations: boolean;
  financialAlerts: boolean;
  pushEnabled: boolean;
}
