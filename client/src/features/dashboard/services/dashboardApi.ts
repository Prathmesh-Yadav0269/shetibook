import { api } from '../../../services/api/apiClient';
import { DashboardData } from '../types';

export interface DashboardFilters {
  farmId?: string;
  cropId?: string;
  startDate?: string;
  endDate?: string;
}

export const dashboardApi = {
  getDashboard: (groupId: string, filters?: DashboardFilters) => {
    const params = new URLSearchParams();
    if (filters?.farmId) params.append('farmId', filters.farmId);
    if (filters?.cropId) params.append('cropId', filters.cropId);
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    const q = params.toString() ? `?${params.toString()}` : '';
    return api.get<DashboardData>(`/groups/${groupId}/dashboard${q}`);
  },
};
