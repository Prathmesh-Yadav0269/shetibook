import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, requireGroupMembership } from '../../middleware/auth.middleware.js';
import { AgricultureService } from './agriculture.service.js';
import {
  createFarmSchema,
  updateFarmSchema,
  createPlotSchema,
  updatePlotSchema,
  changeCultivationModeSchema,
  createCropSchema,
  updateCropSchema,
  changeCropStatusSchema,
  createActivitySchema,
  transitionActivitySchema,
} from '../../validators/agriculture.validator.js';

const agricultureService = new AgricultureService();

const getParam = (req: Request, key: string): string => {
  const val = req.params[key];
  return Array.isArray(val) ? val[0] : (val || '');
};

// ==========================================
// FARMS ROUTER
// Mounted at: /api/v1/groups/:groupId/farms
// ==========================================
export const farmsRouter = Router({ mergeParams: true });
farmsRouter.use(requireAuth, requireGroupMembership());

farmsRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = createFarmSchema.parse(req.body);
    const farm = await agricultureService.createFarm(
      getParam(req, 'groupId'),
      req.user!.id,
      validated,
      req.ip,
      req.get('user-agent')
    );
    res.status(201).json({ success: true, data: farm });
  } catch (err) {
    next(err);
  }
});

farmsRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const farms = await agricultureService.listFarms(getParam(req, 'groupId'));
    res.status(200).json({ success: true, data: farms });
  } catch (err) {
    next(err);
  }
});

farmsRouter.get('/:farmId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const farm = await agricultureService.getFarmDetails(getParam(req, 'groupId'), getParam(req, 'farmId'));
    res.status(200).json({ success: true, data: farm });
  } catch (err) {
    next(err);
  }
});

farmsRouter.put('/:farmId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = updateFarmSchema.parse(req.body);
    const updated = await agricultureService.updateFarm(
      getParam(req, 'groupId'),
      getParam(req, 'farmId'),
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

farmsRouter.delete('/:farmId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await agricultureService.archiveFarm(
      getParam(req, 'groupId'),
      getParam(req, 'farmId'),
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
// PLOTS ROUTER
// Mounted at: /api/v1/groups/:groupId/farms/:farmId/plots
// and /api/v1/groups/:groupId/plots
// ==========================================
export const plotsRouter = Router({ mergeParams: true });
plotsRouter.use(requireAuth, requireGroupMembership());

plotsRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const farmId = getParam(req, 'farmId') || String(req.body.farmId || '');
    const validated = createPlotSchema.parse(req.body);
    const plot = await agricultureService.createPlot(
      getParam(req, 'groupId'),
      farmId,
      req.user!.id,
      validated,
      req.ip,
      req.get('user-agent')
    );
    res.status(201).json({ success: true, data: plot });
  } catch (err) {
    next(err);
  }
});

plotsRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const farmId = getParam(req, 'farmId') || undefined;
    const plots = await agricultureService.listPlots(getParam(req, 'groupId'), farmId);
    res.status(200).json({ success: true, data: plots });
  } catch (err) {
    next(err);
  }
});

plotsRouter.get('/:plotId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const plot = await agricultureService.getPlotDetails(getParam(req, 'groupId'), getParam(req, 'plotId'));
    res.status(200).json({ success: true, data: plot });
  } catch (err) {
    next(err);
  }
});

plotsRouter.put('/:plotId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = updatePlotSchema.parse(req.body);
    const updated = await agricultureService.updatePlot(
      getParam(req, 'groupId'),
      getParam(req, 'plotId'),
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

plotsRouter.delete('/:plotId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await agricultureService.archivePlot(
      getParam(req, 'groupId'),
      getParam(req, 'plotId'),
      req.user!.id,
      req.ip,
      req.get('user-agent')
    );
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

plotsRouter.patch('/:plotId/mode', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = changeCultivationModeSchema.parse(req.body);
    const result = await agricultureService.changeCultivationMode(
      getParam(req, 'groupId'),
      getParam(req, 'plotId'),
      req.user!.id,
      validated.cultivationMode,
      req.ip,
      req.get('user-agent')
    );
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// CROPS ROUTER
// Mounted at: /api/v1/groups/:groupId/crops
// ==========================================
export const cropsRouter = Router({ mergeParams: true });
cropsRouter.use(requireAuth, requireGroupMembership());

cropsRouter.get('/metadata', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const metadata = await agricultureService.getMetadata();
    res.status(200).json({ success: true, data: metadata });
  } catch (err) {
    next(err);
  }
});

cropsRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = createCropSchema.parse(req.body);
    const crop = await agricultureService.createCrop(
      getParam(req, 'groupId'),
      req.user!.id,
      validated,
      req.ip,
      req.get('user-agent')
    );
    res.status(201).json({ success: true, data: crop });
  } catch (err) {
    next(err);
  }
});

cropsRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { farmId, plotId, status } = req.query;
    const crops = await agricultureService.listCrops(getParam(req, 'groupId'), {
      farmId: typeof farmId === 'string' ? farmId : undefined,
      plotId: typeof plotId === 'string' ? plotId : undefined,
      status: typeof status === 'string' ? status : undefined,
    });
    res.status(200).json({ success: true, data: crops });
  } catch (err) {
    next(err);
  }
});

cropsRouter.get('/:cropId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const crop = await agricultureService.getCropDetails(getParam(req, 'groupId'), getParam(req, 'cropId'));
    res.status(200).json({ success: true, data: crop });
  } catch (err) {
    next(err);
  }
});

cropsRouter.put('/:cropId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = updateCropSchema.parse(req.body);
    const updated = await agricultureService.updateCrop(
      getParam(req, 'groupId'),
      getParam(req, 'cropId'),
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

cropsRouter.patch('/:cropId/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = changeCropStatusSchema.parse(req.body);
    const updated = await agricultureService.changeCropStatus(
      getParam(req, 'groupId'),
      getParam(req, 'cropId'),
      req.user!.id,
      validated.status,
      validated.actualHarvestDate,
      req.ip,
      req.get('user-agent')
    );
    res.status(200).json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// ACTIVITIES ROUTER
// Mounted at: /api/v1/groups/:groupId/activities
// ==========================================
export const activitiesRouter = Router({ mergeParams: true });
activitiesRouter.use(requireAuth, requireGroupMembership());

activitiesRouter.get('/types', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const types = await agricultureService.getActivityTypes();
    res.status(200).json({ success: true, data: types });
  } catch (err) {
    next(err);
  }
});

activitiesRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = createActivitySchema.parse(req.body);
    const activity = await agricultureService.createActivity(
      getParam(req, 'groupId'),
      req.user!.id,
      validated,
      req.ip,
      req.get('user-agent')
    );
    res.status(201).json({ success: true, data: activity });
  } catch (err) {
    next(err);
  }
});

activitiesRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { farmId, cropId, status } = req.query;
    const activities = await agricultureService.listActivities(getParam(req, 'groupId'), {
      farmId: typeof farmId === 'string' ? farmId : undefined,
      cropId: typeof cropId === 'string' ? cropId : undefined,
      status: typeof status === 'string' ? status : undefined,
    });
    res.status(200).json({ success: true, data: activities });
  } catch (err) {
    next(err);
  }
});

activitiesRouter.get('/:activityId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const activity = await agricultureService.getActivityDetails(getParam(req, 'groupId'), getParam(req, 'activityId'));
    res.status(200).json({ success: true, data: activity });
  } catch (err) {
    next(err);
  }
});

activitiesRouter.post('/:activityId/transition', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = transitionActivitySchema.parse(req.body);
    const updated = await agricultureService.transitionActivity(
      getParam(req, 'groupId'),
      getParam(req, 'activityId'),
      req.user!.id,
      validated.transition,
      validated.notes
    );
    res.status(200).json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});
