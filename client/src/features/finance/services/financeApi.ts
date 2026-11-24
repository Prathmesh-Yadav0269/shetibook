import { api } from '../../../services/api/apiClient';
import {
  Expense,
  ExpenseCategory,
  Harvest,
  Sale,
  Payment,
  FinancialSummary,
} from '../types';
import { HarvestUnit, PaymentMethod } from '../../../utils/finance';

export const financeApi = {
  // Categories
  getCategories: (groupId: string) =>
    api.get<ExpenseCategory[]>(`/groups/${groupId}/expenses/categories`),

  createCategory: (groupId: string, data: { nameMr: string; nameEn: string }) =>
    api.post<ExpenseCategory>(`/groups/${groupId}/expenses/categories`, data),

  // Expenses
  getExpenses: (
    groupId: string,
    filters?: {
      farmId?: string;
      cropId?: string;
      categoryId?: string;
      startDate?: string;
      endDate?: string;
    }
  ) => {
    const params = new URLSearchParams();
    if (filters?.farmId) params.append('farmId', filters.farmId);
    if (filters?.cropId) params.append('cropId', filters.cropId);
    if (filters?.categoryId) params.append('categoryId', filters.categoryId);
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    const q = params.toString() ? `?${params.toString()}` : '';
    return api.get<Expense[]>(`/groups/${groupId}/expenses${q}`);
  },

  getExpense: (groupId: string, expenseId: string) =>
    api.get<Expense>(`/groups/${groupId}/expenses/${expenseId}`),

  createExpense: (
    groupId: string,
    data: {
      farmId: string;
      expenseCategoryId: string;
      amountPaise: number;
      expenseDate: string;
      description?: string | null;
      allocations?: Array<{ cropId: string; amountPaise: number }> | null;
    }
  ) => api.post<Expense>(`/groups/${groupId}/expenses`, data),

  updateExpense: (
    groupId: string,
    expenseId: string,
    data: {
      farmId?: string;
      expenseCategoryId?: string;
      amountPaise?: number;
      expenseDate?: string;
      description?: string | null;
      allocations?: Array<{ cropId: string; amountPaise: number }> | null;
    }
  ) => api.put<Expense>(`/groups/${groupId}/expenses/${expenseId}`, data),

  deleteExpense: (groupId: string, expenseId: string) =>
    api.delete<{ success: boolean }>(`/groups/${groupId}/expenses/${expenseId}`),

  // Harvests
  getHarvests: (
    groupId: string,
    filters?: {
      farmId?: string;
      cropId?: string;
      startDate?: string;
      endDate?: string;
    }
  ) => {
    const params = new URLSearchParams();
    if (filters?.farmId) params.append('farmId', filters.farmId);
    if (filters?.cropId) params.append('cropId', filters.cropId);
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    const q = params.toString() ? `?${params.toString()}` : '';
    return api.get<Harvest[]>(`/groups/${groupId}/harvests${q}`);
  },

  getHarvest: (groupId: string, harvestId: string) =>
    api.get<Harvest>(`/groups/${groupId}/harvests/${harvestId}`),

  createHarvest: (
    groupId: string,
    data: {
      farmId: string;
      cropId: string;
      harvestDate: string;
      quantity: number;
      unit: HarvestUnit;
      notes?: string | null;
    }
  ) => api.post<Harvest>(`/groups/${groupId}/harvests`, data),

  updateHarvest: (
    groupId: string,
    harvestId: string,
    data: {
      harvestDate?: string;
      quantity?: number;
      unit?: HarvestUnit;
      notes?: string | null;
    }
  ) => api.put<Harvest>(`/groups/${groupId}/harvests/${harvestId}`, data),

  deleteHarvest: (groupId: string, harvestId: string) =>
    api.delete<{ success: boolean }>(`/groups/${groupId}/harvests/${harvestId}`),

  // Sales
  getSales: (
    groupId: string,
    filters?: {
      farmId?: string;
      cropId?: string;
      harvestId?: string;
      startDate?: string;
      endDate?: string;
    }
  ) => {
    const params = new URLSearchParams();
    if (filters?.farmId) params.append('farmId', filters.farmId);
    if (filters?.cropId) params.append('cropId', filters.cropId);
    if (filters?.harvestId) params.append('harvestId', filters.harvestId);
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    const q = params.toString() ? `?${params.toString()}` : '';
    return api.get<Sale[]>(`/groups/${groupId}/sales${q}`);
  },

  getSale: (groupId: string, saleId: string) =>
    api.get<Sale>(`/groups/${groupId}/sales/${saleId}`),

  createSale: (
    groupId: string,
    data: {
      farmId: string;
      cropId: string;
      harvestId?: string | null;
      saleDate: string;
      quantity: number;
      unit: HarvestUnit;
      ratePaise: number;
      totalAmountPaise?: number;
      buyerName?: string | null;
      notes?: string | null;
    }
  ) => api.post<Sale>(`/groups/${groupId}/sales`, data),

  updateSale: (
    groupId: string,
    saleId: string,
    data: {
      saleDate?: string;
      quantity?: number;
      unit?: HarvestUnit;
      ratePaise?: number;
      totalAmountPaise?: number;
      buyerName?: string | null;
      notes?: string | null;
    }
  ) => api.put<Sale>(`/groups/${groupId}/sales/${saleId}`, data),

  deleteSale: (groupId: string, saleId: string) =>
    api.delete<{ success: boolean }>(`/groups/${groupId}/sales/${saleId}`),

  // Payments
  recordPayment: (
    groupId: string,
    data: {
      expenseId?: string | null;
      saleId?: string | null;
      amountPaise: number;
      paymentDate: string;
      paymentMethod: PaymentMethod;
      referenceNumber?: string | null;
      notes?: string | null;
    }
  ) => api.post<Payment>(`/groups/${groupId}/payments`, data),

  deletePayment: (groupId: string, paymentId: string) =>
    api.delete<{ success: boolean }>(`/groups/${groupId}/payments/${paymentId}`),

  // Summary
  getFinancialSummary: (
    groupId: string,
    filters?: {
      farmId?: string;
      cropId?: string;
      startDate?: string;
      endDate?: string;
    }
  ) => {
    const params = new URLSearchParams();
    if (filters?.farmId) params.append('farmId', filters.farmId);
    if (filters?.cropId) params.append('cropId', filters.cropId);
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    const q = params.toString() ? `?${params.toString()}` : '';
    return api.get<FinancialSummary>(`/groups/${groupId}/finance/summary${q}`);
  },
};
