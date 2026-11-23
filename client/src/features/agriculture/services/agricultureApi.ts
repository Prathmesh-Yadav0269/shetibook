import { api } from '../../../services/api/apiClient';
import { Farm, Plot, Crop, CropType, CropSeason, Activity, ActivityType } from '../types';
import { AreaUnit } from '../../../utils/area';

export const agricultureApi = {
  // Farms
  getFarms: (groupId: string) => api.get<Farm[]>(`/groups/${groupId}/farms`),
  getFarm: (groupId: string, farmId: string) => api.get<Farm>(`/groups/${groupId}/farms/${farmId}`),
  createFarm: (
    groupId: string,
    data: {
      farmName: string;
      village: string;
      taluka?: string | null;
      district?: string | null;
      areaValue: number;
      areaUnit: AreaUnit;
      surveyNumber?: string | null;
      notes?: string | null;
    }
  ) => api.post<Farm>(`/groups/${groupId}/farms`, data),
  updateFarm: (
    groupId: string,
    farmId: string,
    data: {
      farmName?: string;
      village?: string;
      taluka?: string | null;
      district?: string | null;
      areaValue?: number;
      areaUnit?: AreaUnit;
      surveyNumber?: string | null;
      notes?: string | null;
    }
  ) => api.put<Farm>(`/groups/${groupId}/farms/${farmId}`, data),
  archiveFarm: (groupId: string, farmId: string) =>
    api.delete<{ success: boolean; farmId: string }>(`/groups/${groupId}/farms/${farmId}`),

  // Plots
  getPlots: (groupId: string, farmId: string) =>
    api.get<Plot[]>(`/groups/${groupId}/farms/${farmId}/plots`),
  getPlot: (groupId: string, plotId: string) =>
    api.get<Plot>(`/groups/${groupId}/plots/${plotId}`),
  createPlot: (
    groupId: string,
    farmId: string,
    data: {
      plotName: string;
      areaValue: number;
      areaUnit: AreaUnit;
      cultivationMode: 'separate' | 'intercropping';
      notes?: string | null;
    }
  ) => api.post<Plot>(`/groups/${groupId}/farms/${farmId}/plots`, data),
  updatePlot: (
    groupId: string,
    plotId: string,
    data: {
      plotName?: string;
      areaValue?: number;
      areaUnit?: AreaUnit;
      notes?: string | null;
    }
  ) => api.put<Plot>(`/groups/${groupId}/plots/${plotId}`, data),
  archivePlot: (groupId: string, plotId: string) =>
    api.delete<{ success: boolean; plotId: string }>(`/groups/${groupId}/plots/${plotId}`),
  changeCultivationMode: (
    groupId: string,
    plotId: string,
    cultivationMode: 'separate' | 'intercropping'
  ) => api.patch<{ success: boolean; plotId: string; cultivationMode: string }>(`/groups/${groupId}/plots/${plotId}/mode`, { cultivationMode }),

  // Crops
  getCropMetadata: (groupId: string) =>
    api.get<{ cropTypes: CropType[]; cropSeasons: CropSeason[] }>(`/groups/${groupId}/crops/metadata`),
  getCrops: (groupId: string, filters?: { farmId?: string; plotId?: string; status?: string }) => {
    const params = new URLSearchParams();
    if (filters?.farmId) params.append('farmId', filters.farmId);
    if (filters?.plotId) params.append('plotId', filters.plotId);
    if (filters?.status) params.append('status', filters.status);
    const query = params.toString() ? `?${params.toString()}` : '';
    return api.get<Crop[]>(`/groups/${groupId}/crops${query}`);
  },
  getCrop: (groupId: string, cropId: string) =>
    api.get<Crop>(`/groups/${groupId}/crops/${cropId}`),
  createCrop: (
    groupId: string,
    data: {
      farmId: string;
      plotId: string;
      cropTypeId: string;
      cropSeasonId: string;
      cropNameCustom?: string | null;
      sowingDate: string;
      expectedHarvestDate?: string | null;
      notes?: string | null;
    }
  ) => api.post<Crop>(`/groups/${groupId}/crops`, data),
  updateCrop: (
    groupId: string,
    cropId: string,
    data: {
      cropNameCustom?: string | null;
      sowingDate?: string;
      expectedHarvestDate?: string | null;
      actualHarvestDate?: string | null;
      notes?: string | null;
    }
  ) => api.put<Crop>(`/groups/${groupId}/crops/${cropId}`, data),
  changeCropStatus: (
    groupId: string,
    cropId: string,
    status: 'planned' | 'active' | 'harvested' | 'cancelled',
    actualHarvestDate?: string | null
  ) => api.patch<Crop>(`/groups/${groupId}/crops/${cropId}/status`, { status, actualHarvestDate }),

  // Activities
  getActivityTypes: (groupId: string) =>
    api.get<ActivityType[]>(`/groups/${groupId}/activities/types`),
  getActivities: (groupId: string, filters?: { farmId?: string; cropId?: string; status?: string }) => {
    const params = new URLSearchParams();
    if (filters?.farmId) params.append('farmId', filters.farmId);
    if (filters?.cropId) params.append('cropId', filters.cropId);
    if (filters?.status) params.append('status', filters.status);
    const query = params.toString() ? `?${params.toString()}` : '';
    return api.get<Activity[]>(`/groups/${groupId}/activities${query}`);
  },
  getActivity: (groupId: string, activityId: string) =>
    api.get<Activity>(`/groups/${groupId}/activities/${activityId}`),
  createActivity: (
    groupId: string,
    data: {
      farmId: string;
      plotId?: string | null;
      cropId?: string | null;
      activityTypeId: string;
      customActivityName?: string | null;
      description?: string | null;
    }
  ) => api.post<Activity>(`/groups/${groupId}/activities`, data),
  transitionActivity: (
    groupId: string,
    activityId: string,
    transition: 'start' | 'pause' | 'resume' | 'complete' | 'cancel',
    notes?: string | null
  ) => api.post<Activity>(`/groups/${groupId}/activities/${activityId}/transition`, { transition, notes }),
};
