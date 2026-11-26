export interface AreaBreakdown {
  acre: number;
  acres?: number;
  guntha: number;
  gunthas?: number;
  hectare: number;
  hectares?: number;
  sqm: number;
}

export interface FarmOverviewItem {
  id: string;
  farmName: string;
  village: string;
  taluka: string;
  district: string;
  areaValue: number;
  areaUnit: string;
  areaSqm: number;
  activeCropCount: number;
  plotCount: number;
}

export interface CropOverviewItem {
  id: string;
  farmId: string;
  farmName: string;
  plotId: string;
  plotName: string;
  cropNameMr: string;
  cropNameEn: string;
  seasonNameMr: string;
  seasonNameEn: string;
  variety: string | null;
  sowingDate: string;
  expectedHarvestDate: string | null;
  status: string;
}

export interface ActivityOverviewItem {
  id: string;
  farmId: string;
  farmName: string;
  plotId: string;
  plotName: string;
  cropId: string | null;
  cropNameMr: string | null;
  activityTypeMr: string;
  activityTypeEn: string;
  customName: string | null;
  status: 'pending' | 'in_progress' | 'paused' | 'completed';
  createdAt: string;
  createdByPhone: string;
}

export interface DashboardFinancialMetrics {
  totalExpensesPaise: number;
  totalSalesPaise: number;
  netProfitPaise: number;
  totalExpensesPaidPaise: number;
  totalSalesReceivedPaise: number;
  netCashFlowPaise: number;
  pendingReceivablesPaise: number;
  pendingPayablesPaise: number;
}

export interface DashboardData {
  farms: {
    total: number;
    totalAreaSqm: number;
    totalAreaBreakdown: AreaBreakdown;
    cultivatedAreaSqm: number;
    cultivatedAreaBreakdown: AreaBreakdown;
    list: FarmOverviewItem[];
  };
  crops: {
    activeCount: number;
    plannedCount: number;
    harvestedCount: number;
    list: CropOverviewItem[];
  };
  activities: {
    counts: {
      inProgress: number;
      pending: number;
      paused: number;
      completed: number;
    };
    recent: ActivityOverviewItem[];
  };
  financial: DashboardFinancialMetrics;
  generatedAt: string;
}
