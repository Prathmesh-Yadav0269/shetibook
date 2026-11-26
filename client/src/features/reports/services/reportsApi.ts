import { api } from '../../../services/api/apiClient';
import {
  FarmReportItem,
  CropReportItem,
  MonthlyTrendItem,
  CategoryBreakdownItem,
} from '../types';

export interface ReportOptions {
  type: 'farms' | 'crops' | 'monthly' | 'categories';
  farmId?: string;
  cropId?: string;
  startDate?: string;
  endDate?: string;
}

export const reportsApi = {
  getFarmReports: (groupId: string, farmId?: string) => {
    const q = farmId ? `?type=farms&farmId=${farmId}` : '?type=farms';
    return api.get<FarmReportItem[]>(`/groups/${groupId}/reports${q}`);
  },

  getCropReports: (groupId: string, farmId?: string) => {
    const q = farmId ? `?type=crops&farmId=${farmId}` : '?type=crops';
    return api.get<CropReportItem[]>(`/groups/${groupId}/reports${q}`);
  },

  getMonthlyTrends: (groupId: string, farmId?: string) => {
    const q = farmId ? `?type=monthly&farmId=${farmId}` : '?type=monthly';
    return api.get<MonthlyTrendItem[]>(`/groups/${groupId}/reports${q}`);
  },

  getCategoryBreakdown: (groupId: string, farmId?: string) => {
    const q = farmId ? `?type=categories&farmId=${farmId}` : '?type=categories';
    return api.get<CategoryBreakdownItem[]>(`/groups/${groupId}/reports${q}`);
  },

  exportCsv: async (groupId: string, dataset: 'expenses' | 'sales' | 'harvests' | 'farms') => {
    const url = `/api/v1/groups/${groupId}/reports/export?dataset=${dataset}`;
    // Fetch with credentials and anti-CSRF headers
    const res = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
      },
    });
    if (!res.ok) {
      throw new Error('CSV अहवाल डाउनलोड करताना त्रुटी आली.');
    }
    const blob = await res.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `shetibook_${dataset}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);
  },
};
