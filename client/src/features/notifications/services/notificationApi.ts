import { api } from '../../../services/api/apiClient';
import { InAppNotification, NotificationPreferences } from '../types';

export const notificationApi = {
  getNotifications: (groupId: string, unreadOnly = false) => {
    const q = unreadOnly ? '?unreadOnly=true' : '';
    return api.get<{ notifications: InAppNotification[]; unreadCount: number }>(
      `/groups/${groupId}/notifications${q}`
    );
  },

  markAsRead: (groupId: string, notificationId: string) => {
    return api.patch<{ success: boolean }>(
      `/groups/${groupId}/notifications/${notificationId}/read`
    );
  },

  markAllAsRead: (groupId: string) => {
    return api.post<{ success: boolean }>(
      `/groups/${groupId}/notifications/mark-all-read`
    );
  },

  getPreferences: (groupId: string) => {
    return api.get<NotificationPreferences>(
      `/groups/${groupId}/notifications/preferences`
    );
  },

  updatePreferences: (groupId: string, prefs: Partial<NotificationPreferences>) => {
    return api.put<NotificationPreferences>(
      `/groups/${groupId}/notifications/preferences`,
      prefs
    );
  },
};
