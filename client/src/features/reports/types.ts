import { AreaBreakdown } from '../dashboard/types';

export interface FarmReportItem {
  id: string;
  farmName: string;
  village: string;
  taluka: string;
  district: string;
  surveyNumber: string | null;
  areaBreakdown: AreaBreakdown;
  activeCrops: number;
  totalExpensePaise: number;
  totalSalesPaise: number;
  netProfitPaise: number;
}

export interface CropReportItem {
  id: string;
  farmId: string;
  farmName: string;
  plotId: string;
  plotName: string;
  cultivationMode: string;
  cropNameMr: string;
  cropNameEn: string;
  seasonNameMr: string;
  seasonNameEn: string;
  variety: string | null;
  sowingDate: string;
  status: string;
  allocatedExpensePaise: number;
  salesRevenuePaise: number;
  totalHarvestQty: number;
  totalSoldQty: number;
  netProfitPaise: number;
}

export interface MonthlyTrendItem {
  month: string;
  expensePaise: number;
  salesPaise: number;
  netProfitPaise: number;
}

export interface CategoryBreakdownItem {
  categoryId: string;
  categoryNameMr: string;
  categoryNameEn: string;
  totalAmountPaise: number;
  count: number;
}
