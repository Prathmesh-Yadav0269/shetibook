import { z } from 'zod';

export const paymentMethodEnum = z.enum(['cash', 'upi', 'bank_transfer', 'credit', 'other'], {
  errorMap: () => ({ message: 'अवैध पेमेंट पद्धत (Invalid payment method)' }),
});

export const harvestUnitEnum = z.enum(['kg', 'quintal', 'tonne'], {
  errorMap: () => ({ message: 'अवैध एकक (एकक किलो, क्विंटल किंवा टन असावे)' }),
});

export const expenseAllocationItemSchema = z.object({
  cropId: z.string().uuid('अवैध पीक आयडी (Invalid crop ID)'),
  amountPaise: z.number().int().positive('विभाजित रक्कम ० पेक्षा जास्त असावी (Allocation must be positive)'),
});

export const createExpenseSchema = z.object({
  farmId: z.string().uuid('अवैध शेत आयडी (Invalid farm ID)'),
  expenseCategoryId: z.string().min(1, 'खर्चाचा प्रकार निवडा (Select expense category)'),
  amountPaise: z.number().int().positive('खर्चाची रक्कम ० पेक्षा जास्त असावी (Amount must be positive)'),
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'खर्च तारीख YYYY-MM-DD स्वरूपात असावी'),
  description: z.string().trim().max(1000).optional().nullable(),
  allocations: z.array(expenseAllocationItemSchema).optional().nullable(),
}).refine((data) => {
  if (data.allocations && data.allocations.length > 0) {
    const totalAllocated = data.allocations.reduce((sum, item) => sum + item.amountPaise, 0);
    return totalAllocated <= data.amountPaise;
  }
  return true;
}, {
  message: 'पिकांना वाटप केलेली एकूण रक्कम मूळ खर्चापेक्षा जास्त असू शकत नाही (Total allocated cannot exceed expense amount)',
  path: ['allocations'],
});

export const updateExpenseSchema = z.object({
  farmId: z.string().uuid().optional(),
  expenseCategoryId: z.string().min(1).optional(),
  amountPaise: z.number().int().positive().optional(),
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  description: z.string().trim().max(1000).optional().nullable(),
  allocations: z.array(expenseAllocationItemSchema).optional().nullable(),
});

export const allocateExpenseSchema = z.object({
  allocations: z.array(expenseAllocationItemSchema),
});

export const createHarvestSchema = z.object({
  farmId: z.string().uuid('अवैध शेत आयडी (Invalid farm ID)'),
  cropId: z.string().uuid('अवैध पीक आयडी (Invalid crop ID)'),
  harvestDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'काढणी तारीख YYYY-MM-DD स्वरूपात असावी'),
  quantity: z.number().positive('उत्पादन प्रमाण ० पेक्षा जास्त असावे (Quantity must be positive)'),
  unit: harvestUnitEnum,
  notes: z.string().trim().max(1000).optional().nullable(),
});

export const updateHarvestSchema = createHarvestSchema.partial();

export const createSaleSchema = z.object({
  farmId: z.string().uuid('अवैध शेत आयडी (Invalid farm ID)'),
  cropId: z.string().uuid('अवैध पीक आयडी (Invalid crop ID)'),
  harvestId: z.string().uuid().optional().nullable(),
  saleDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'विक्री तारीख YYYY-MM-DD स्वरूपात असावी'),
  quantity: z.number().positive('विक्री प्रमाण ० पेक्षा जास्त असावे (Quantity must be positive)'),
  unit: harvestUnitEnum,
  ratePaise: z.number().int().positive('दर ० पेक्षा जास्त असावा (Rate must be positive)'),
  totalAmountPaise: z.number().int().positive().optional(),
  buyerName: z.string().trim().max(100).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
});

export const updateSaleSchema = createSaleSchema.partial();

export const createPaymentSchema = z.object({
  expenseId: z.string().uuid().optional().nullable(),
  saleId: z.string().uuid().optional().nullable(),
  amountPaise: z.number().int().positive('पेमेंट रक्कम ० पेक्षा जास्त असावी (Payment amount must be positive)'),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'पेमेंट तारीख YYYY-MM-DD स्वरूपात असावी'),
  paymentMethod: paymentMethodEnum,
  referenceNumber: z.string().trim().max(100).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
}).refine((data) => {
  const hasExpense = Boolean(data.expenseId);
  const hasSale = Boolean(data.saleId);
  return (hasExpense && !hasSale) || (!hasExpense && hasSale);
}, {
  message: 'पेमेंट केवळ खर्चासाठी किंवा विक्रीसाठीच नोंदवले जाऊ शकते (Payment must be for either expense or sale, not both)',
});
