import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, requireGroupMembership } from '../../middleware/auth.middleware.js';
import { IntelligenceService } from './intelligence.service.js';

const router = Router({ mergeParams: true });
const intelligenceService = new IntelligenceService();

const getParam = (req: Request, key: string): string => {
  const val = req.params[key];
  return Array.isArray(val) ? val[0] : (val || '');
};

// Apply auth and active group membership to all intelligence & report endpoints
router.use(requireAuth);
router.use(requireGroupMembership());

// 1. Dashboard summary
router.get('/dashboard', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const groupId = getParam(req, 'groupId');
    const { farmId, cropId, startDate, endDate } = req.query;

    const data = await intelligenceService.getDashboard(groupId, {
      farmId: farmId ? String(farmId) : undefined,
      cropId: cropId ? String(cropId) : undefined,
      startDate: startDate ? String(startDate) : undefined,
      endDate: endDate ? String(endDate) : undefined,
    });

    res.status(200).json({
      success: true,
      data,
    });
  } catch (err) {
    next(err);
  }
});

// 2. Tabular and analytical reports
router.get('/reports', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const groupId = getParam(req, 'groupId');
    const { type = 'financial', farmId, cropId, startDate, endDate } = req.query;

    const data = await intelligenceService.getReports(groupId, {
      type: (type as 'farms' | 'crops' | 'financial' | 'categories' | 'monthly') || 'financial',
      farmId: farmId ? String(farmId) : undefined,
      cropId: cropId ? String(cropId) : undefined,
      startDate: startDate ? String(startDate) : undefined,
      endDate: endDate ? String(endDate) : undefined,
    });

    res.status(200).json({
      success: true,
      data,
    });
  } catch (err) {
    next(err);
  }
});

// 3. UTF-8 CSV Export with formula injection prevention
router.get('/reports/export', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const groupId = getParam(req, 'groupId');
    const { dataset = 'expenses', farmId, startDate, endDate } = req.query;

    const { filename, content } = await intelligenceService.exportCsv(
      groupId,
      (dataset as 'expenses' | 'sales' | 'harvests' | 'farms') || 'expenses',
      {
        farmId: farmId ? String(farmId) : undefined,
        startDate: startDate ? String(startDate) : undefined,
        endDate: endDate ? String(endDate) : undefined,
      }
    );

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(content);
  } catch (err) {
    next(err);
  }
});

export { router as intelligenceRouter };
