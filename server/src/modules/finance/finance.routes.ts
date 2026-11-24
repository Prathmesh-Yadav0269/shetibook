import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, requireGroupMembership } from '../../middleware/auth.middleware.js';
import { FinanceService } from './finance.service.js';
import {
  createExpenseSchema,
  updateExpenseSchema,
  createHarvestSchema,
  updateHarvestSchema,
  createSaleSchema,
  updateSaleSchema,
  createPaymentSchema,
} from '../../validators/finance.validator.js';
import { z } from 'zod';

const financeService = new FinanceService();

const getParam = (req: Request, key: string): string => {
  const val = req.params[key];
  return Array.isArray(val) ? val[0] : (val || '');
};

// ==========================================
// 1. EXPENSES ROUTER
// Mounted at: /api/v1/groups/:groupId/expenses
// ==========================================
export const expensesRouter = Router({ mergeParams: true });
expensesRouter.use(requireAuth, requireGroupMembership());

// Categories
expensesRouter.get('/categories', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const categories = await financeService.listCategories(getParam(req, 'groupId'));
    res.status(200).json({ success: true, data: categories });
  } catch (err) {
    next(err);
  }
});

expensesRouter.post('/categories', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      nameMr: z.string().trim().min(1, 'प्रवर्गाचे मराठी नाव आवश्यक आहे'),
      nameEn: z.string().trim().min(1, 'प्रवर्गाचे इंग्रजी नाव आवश्यक आहे'),
    });
    const validated = schema.parse(req.body);
    const category = await financeService.createCategory(
      getParam(req, 'groupId'),
      req.user!.id,
      validated,
      req.ip,
      req.get('user-agent')
    );
    res.status(201).json({ success: true, data: category });
  } catch (err) {
    next(err);
  }
});

// Expenses CRUD
expensesRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = createExpenseSchema.parse(req.body);
    const expense = await financeService.createExpense(
      getParam(req, 'groupId'),
      req.user!.id,
      validated,
      req.ip,
      req.get('user-agent')
    );
    res.status(201).json({ success: true, data: expense });
  } catch (err) {
    next(err);
  }
});

expensesRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filters = {
      farmId: req.query.farmId ? String(req.query.farmId) : undefined,
      cropId: req.query.cropId ? String(req.query.cropId) : undefined,
      categoryId: req.query.categoryId ? String(req.query.categoryId) : undefined,
      startDate: req.query.startDate ? String(req.query.startDate) : undefined,
      endDate: req.query.endDate ? String(req.query.endDate) : undefined,
    };
    const expenses = await financeService.listExpenses(getParam(req, 'groupId'), filters);
    res.status(200).json({ success: true, data: expenses });
  } catch (err) {
    next(err);
  }
});

expensesRouter.get('/:expenseId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const expense = await financeService.getExpenseDetails(
      getParam(req, 'groupId'),
      getParam(req, 'expenseId')
    );
    res.status(200).json({ success: true, data: expense });
  } catch (err) {
    next(err);
  }
});

expensesRouter.put('/:expenseId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = updateExpenseSchema.parse(req.body);
    const updated = await financeService.updateExpense(
      getParam(req, 'groupId'),
      getParam(req, 'expenseId'),
      req.user!.id,
      validated,
      req.ip,
      req.get('user-agent')
    );
    res.status(200).json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

expensesRouter.delete('/:expenseId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await financeService.deleteExpense(
      getParam(req, 'groupId'),
      getParam(req, 'expenseId'),
      req.user!.id,
      req.ip,
      req.get('user-agent')
    );
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 2. HARVESTS ROUTER
// Mounted at: /api/v1/groups/:groupId/harvests
// ==========================================
export const harvestsRouter = Router({ mergeParams: true });
harvestsRouter.use(requireAuth, requireGroupMembership());

harvestsRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = createHarvestSchema.parse(req.body);
    const harvest = await financeService.createHarvest(
      getParam(req, 'groupId'),
      req.user!.id,
      validated,
      req.ip,
      req.get('user-agent')
    );
    res.status(201).json({ success: true, data: harvest });
  } catch (err) {
    next(err);
  }
});

harvestsRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filters = {
      farmId: req.query.farmId ? String(req.query.farmId) : undefined,
      cropId: req.query.cropId ? String(req.query.cropId) : undefined,
      startDate: req.query.startDate ? String(req.query.startDate) : undefined,
      endDate: req.query.endDate ? String(req.query.endDate) : undefined,
    };
    const harvests = await financeService.listHarvests(getParam(req, 'groupId'), filters);
    res.status(200).json({ success: true, data: harvests });
  } catch (err) {
    next(err);
  }
});

harvestsRouter.get('/:harvestId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const harvest = await financeService.getHarvestDetails(
      getParam(req, 'groupId'),
      getParam(req, 'harvestId')
    );
    res.status(200).json({ success: true, data: harvest });
  } catch (err) {
    next(err);
  }
});

harvestsRouter.put('/:harvestId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = updateHarvestSchema.parse(req.body);
    const updated = await financeService.updateHarvest(
      getParam(req, 'groupId'),
      getParam(req, 'harvestId'),
      req.user!.id,
      validated,
      req.ip,
      req.get('user-agent')
    );
    res.status(200).json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

harvestsRouter.delete('/:harvestId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await financeService.deleteHarvest(
      getParam(req, 'groupId'),
      getParam(req, 'harvestId'),
      req.user!.id,
      req.ip,
      req.get('user-agent')
    );
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 3. SALES ROUTER
// Mounted at: /api/v1/groups/:groupId/sales
// ==========================================
export const salesRouter = Router({ mergeParams: true });
salesRouter.use(requireAuth, requireGroupMembership());

salesRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = createSaleSchema.parse(req.body);
    const sale = await financeService.createSale(
      getParam(req, 'groupId'),
      req.user!.id,
      validated,
      req.ip,
      req.get('user-agent')
    );
    res.status(201).json({ success: true, data: sale });
  } catch (err) {
    next(err);
  }
});

salesRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filters = {
      farmId: req.query.farmId ? String(req.query.farmId) : undefined,
      cropId: req.query.cropId ? String(req.query.cropId) : undefined,
      harvestId: req.query.harvestId ? String(req.query.harvestId) : undefined,
      startDate: req.query.startDate ? String(req.query.startDate) : undefined,
      endDate: req.query.endDate ? String(req.query.endDate) : undefined,
    };
    const sales = await financeService.listSales(getParam(req, 'groupId'), filters);
    res.status(200).json({ success: true, data: sales });
  } catch (err) {
    next(err);
  }
});

salesRouter.get('/:saleId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sale = await financeService.getSaleDetails(
      getParam(req, 'groupId'),
      getParam(req, 'saleId')
    );
    res.status(200).json({ success: true, data: sale });
  } catch (err) {
    next(err);
  }
});

salesRouter.put('/:saleId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = updateSaleSchema.parse(req.body);
    const updated = await financeService.updateSale(
      getParam(req, 'groupId'),
      getParam(req, 'saleId'),
      req.user!.id,
      validated,
      req.ip,
      req.get('user-agent')
    );
    res.status(200).json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

salesRouter.delete('/:saleId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await financeService.deleteSale(
      getParam(req, 'groupId'),
      getParam(req, 'saleId'),
      req.user!.id,
      req.ip,
      req.get('user-agent')
    );
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 4. PAYMENTS ROUTER
// Mounted at: /api/v1/groups/:groupId/payments
// ==========================================
export const paymentsRouter = Router({ mergeParams: true });
paymentsRouter.use(requireAuth, requireGroupMembership());

paymentsRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = createPaymentSchema.parse(req.body);
    const payment = await financeService.recordPayment(
      getParam(req, 'groupId'),
      req.user!.id,
      validated,
      req.ip,
      req.get('user-agent')
    );
    res.status(201).json({ success: true, data: payment });
  } catch (err) {
    next(err);
  }
});

paymentsRouter.delete('/:paymentId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await financeService.deletePayment(
      getParam(req, 'groupId'),
      getParam(req, 'paymentId'),
      req.user!.id,
      req.ip,
      req.get('user-agent')
    );
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 5. FINANCE SUMMARY ROUTER
// Mounted at: /api/v1/groups/:groupId/finance
// ==========================================
export const financeRouter = Router({ mergeParams: true });
financeRouter.use(requireAuth, requireGroupMembership());

financeRouter.get('/summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filters = {
      farmId: req.query.farmId ? String(req.query.farmId) : undefined,
      cropId: req.query.cropId ? String(req.query.cropId) : undefined,
      startDate: req.query.startDate ? String(req.query.startDate) : undefined,
      endDate: req.query.endDate ? String(req.query.endDate) : undefined,
    };
    const summary = await financeService.getFinancialSummary(getParam(req, 'groupId'), filters);
    res.status(200).json({ success: true, data: summary });
  } catch (err) {
    next(err);
  }
});
