import { AreaUnit, AreaBreakdown } from '../../utils/area';

export interface Farm {
  id: string;
  groupId: string;
  farmName: string;
  village: string;
  taluka?: string | null;
  district?: string | null;
  areaValue: number;
  areaUnit: AreaUnit;
  areaSqm: number;
  surveyNumber?: string | null;
  notes?: string | null;
  plotCount: number;
  activeCropCount: number;
  allocatedSqm: number;
  unallocatedSqm: number;
  allocatedInUnit: number;
  unallocatedInUnit: number;
  breakdown: AreaBreakdown;
  plots?: Plot[];
  createdAt: string;
}

export interface Plot {
  id: string;
  farmId: string;
  groupId?: string;
  farmName?: string;
  village?: string;
  plotName: string;
  areaValue: number;
  areaUnit: AreaUnit;
  areaSqm: number;
  cultivationMode: 'separate' | 'intercropping';
  notes?: string | null;
  activeCrops?: Array<{
    id: string;
    cropNameCustom?: string | null;
    cropNameMr: string;
    cropNameEn: string;
    seasonNameMr: string;
    seasonNameEn: string;
    sowingDate: string;
    status: string;
  }>;
  activeCropCount?: number;
  crops?: Crop[];
  breakdown?: AreaBreakdown;
  createdAt: string;
}

export interface CropType {
  id: string;
  nameMr: string;
  nameEn: string;
}

export interface CropSeason {
  id: string;
  nameMr: string;
  nameEn: string;
  startMonth?: number | null;
  endMonth?: number | null;
}

export interface Crop {
  id: string;
  groupId: string;
  farmId: string;
  farmName: string;
  village: string;
  plotId: string;
  plotName: string;
  cultivationMode: 'separate' | 'intercropping';
  cropTypeId: string;
  cropNameMr: string;
  cropNameEn: string;
  cropSeasonId: string;
  seasonNameMr: string;
  seasonNameEn: string;
  cropNameCustom?: string | null;
  sowingDate: string;
  expectedHarvestDate?: string | null;
  actualHarvestDate?: string | null;
  status: 'planned' | 'active' | 'harvested' | 'cancelled';
  notes?: string | null;
  createdAt: string;
}

export interface ActivityType {
  id: string;
  nameMr: string;
  nameEn: string;
}

export interface ActivityEvent {
  id: string;
  actorId: string;
  actorPhoneEnding?: string | null;
  eventType: 'created' | 'started' | 'paused' | 'resumed' | 'completed' | 'cancelled';
  eventAt: string;
  notes?: string | null;
}

export interface Activity {
  id: string;
  groupId: string;
  farmId: string;
  farmName: string;
  village: string;
  plotId?: string | null;
  plotName?: string | null;
  cropId?: string | null;
  cropNameMr?: string | null;
  cropNameEn?: string | null;
  cropNameCustom?: string | null;
  activityTypeId: string;
  activityNameMr: string;
  activityNameEn: string;
  customActivityName?: string | null;
  description?: string | null;
  status: 'pending' | 'in_progress' | 'paused' | 'completed' | 'cancelled';
  startedByPhoneEnding?: string | null;
  events?: ActivityEvent[];
  createdAt: string;
  updatedAt: string;
}
