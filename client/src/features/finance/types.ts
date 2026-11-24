import { HarvestUnit, PaymentMethod, PaymentStatus } from '../../utils/finance';

export interface ExpenseCategory {
  id: string;
  groupId: string | null;
  nameMr: string;
  nameEn: string;
  isSystem: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface ExpenseAllocation {
  id: string;
  cropId: string;
  cropName: string;
  plotName: string;
  amountPaise: number;
  createdAt: string;
}

export interface Payment {
  id: string;
  amountPaise: number;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  referenceNumber: string | null;
  notes: string | null;
  createdAt: string;
  createdByName: string;
}

export interface Expense {
  id: string;
  groupId: string;
  farmId: string;
  farmName: string;
  categoryId: string;
  categoryNameMr: string;
  categoryNameEn: string;
  amountPaise: number;
  expenseDate: string;
  description: string | null;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt?: string;
  paidPaise: number;
  balancePaise: number;
  allocatedPaise: number;
  unallocatedPaise: number;
  paymentStatus: PaymentStatus;
  allocations?: ExpenseAllocation[];
  payments?: Payment[];
}

export interface Harvest {
  id: string;
  groupId: string;
  farmId: string;
  farmName: string;
  cropId: string;
  cropName: string;
  plotName: string;
  harvestDate: string;
  quantity: number;
  unit: HarvestUnit;
  notes: string | null;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt?: string;
  soldQuantity: number;
  remainingQuantity: number;
  linkedSales?: Array<{
    id: string;
    saleDate: string;
    quantity: number;
    unit: HarvestUnit;
    ratePaise: number;
    totalAmountPaise: number;
    buyerName: string | null;
    createdAt: string;
  }>;
}

export interface Sale {
  id: string;
  groupId: string;
  farmId: string;
  farmName: string;
  cropId: string;
  cropName: string;
  plotName: string;
  harvestId: string | null;
  saleDate: string;
  quantity: number;
  unit: HarvestUnit;
  ratePaise: number;
  totalAmountPaise: number;
  paidPaise: number;
  balancePaise: number;
  paymentStatus: PaymentStatus;
  buyerName: string | null;
  notes: string | null;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt?: string;
  payments?: Payment[];
}

export interface FinancialSummary {
  totalSalesPaise: number;
  totalExpensesPaise: number;
  netProfitPaise: number;
  cashInflowPaise: number;
  cashOutflowPaise: number;
  netCashFlowPaise: number;
  receivablesPaise: number;
  payablesPaise: number;
  categoryBreakdown: Array<{
    categoryId: string;
    nameMr: string;
    nameEn: string;
    totalPaise: number;
    count: number;
  }>;
}
